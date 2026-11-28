const test = require("node:test");
const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const { runAgent } = require("../agent/run");
const { lessons: seedLessons, teachers: seedTeachers } = require("../data/lessons");

function makeDb() {
  let lessons = seedLessons.map(lesson => ({ ...lesson, _id: new ObjectId() }));
  let teachers = seedTeachers.map(t => ({ firstName: t.firstName, lastName: t.lastName, lessonIDs: t.lessons.map(i => lessons[i]._id) }));
  let data = { lesson: lessons, teacher: teachers, order: [] };
  return {
    lessons,
    collection: name => ({ find: () => ({ toArray: async () => data[name] }) })
  };
}

function call(id, name, args) {
  return { id: id, type: "function", function: { name: name, arguments: JSON.stringify(args) } };
}

function scripted(replies) {
  let requests = [];
  return {
    requests,
    chat: {
      completions: {
        create: async (params, options) => {
          requests.push(JSON.parse(JSON.stringify(params.messages)));
          if (options && options.signal && options.signal.aborted) throw new Error("aborted");
          let next = replies.shift();
          if (typeof next == "function") next = next(params);
          return { choices: [{ message: next || { role: "assistant", content: "hmm" } }] };
        }
      }
    }
  };
}

async function run(client, extra = {}) {
  let events = [];
  await runAgent({ client, model: "test-model", db: extra.db || makeDb(), mode: extra.mode || "plan", message: "My daughter Mia is 8 and loves drawing, budget 100", profile: extra.profile || { children: [], homeArea: "Hendon" }, emit: event => events.push(event), signal: extra.signal, onStart: extra.onStart });
  return events;
}

test("steps are emitted in order and a valid plan is sent", async () => {
  let db = makeDb();
  let art = db.lessons.find(l => l.topic == "Art" && l.location == "Golders Green");
  let client = scripted([
    { role: "assistant", content: null, tool_calls: [call("1", "search_lessons", { text: "art", age: 8 })] },
    { role: "assistant", content: null, tool_calls: [call("2", "check_week", { picks: [{ child: "Mia", lessonId: art._id.toString() }] })] },
    { role: "assistant", content: null, tool_calls: [call("3", "propose_plan", { picks: [{ child: "Mia", age: 8, lessonId: art._id.toString(), reason: "She loves drawing" }], budget: 100, area: "Hendon", note: "One lesson fits." })] }
  ]);
  let events = await run(client, { db });
  assert.deepEqual(events.map(e => e.type), ["step", "step_done", "step", "step_done", "step", "plan"]);
  assert.equal(events[0].label, "Searching lessons for an 8-year-old who likes art");
  assert.equal(events[1].detail, "1 found");
  let plan = events.at(-1).plan;
  assert.equal(plan.total, 70);
  assert.equal(plan.overBudget, false);
  assert.equal(plan.picks[0].lesson.topic, "Art");
});

test("a bad plan goes back to the model and the fixed plan is used", async () => {
  let db = makeDb();
  let art = db.lessons.find(l => l.topic == "Art" && l.location == "Golders Green");
  let client = scripted([
    { role: "assistant", content: null, tool_calls: [call("1", "propose_plan", { picks: [{ child: "Mia", age: 8, lessonId: "made-up" }] })] },
    { role: "assistant", content: null, tool_calls: [call("2", "propose_plan", { picks: [{ child: "Mia", age: 8, lessonId: art._id.toString() }] })] }
  ]);
  let events = await run(client, { db });
  let toolReply = client.requests[1].find(m => m.role == "tool");
  assert.match(toolReply.content, /does not exist/);
  assert.equal(events.at(-1).type, "plan");
  assert.equal(events.at(-1).plan.picks.length, 1);
});

test("after two bad plans the invalid picks are dropped with a note", async () => {
  let db = makeDb();
  let art = db.lessons.find(l => l.topic == "Art" && l.location == "Golders Green");
  let bad = { picks: [{ child: "Mia", age: 8, lessonId: art._id.toString() }, { child: "Leo", age: 12, lessonId: "made-up" }] };
  let client = scripted([1, 2, 3].map(n => ({ role: "assistant", content: null, tool_calls: [call(String(n), "propose_plan", bad)] })));
  let events = await run(client, { db });
  let plan = events.at(-1).plan;
  assert.equal(plan.picks.length, 1);
  assert.match(plan.note, /couldn't/i);
});

test("the round limit ends with a friendly error", async () => {
  let client = scripted(Array(10).fill({ role: "assistant", content: null, tool_calls: [call("x", "search_lessons", { text: "art" })] }));
  let events = await run(client);
  assert.equal(events.at(-1).type, "error");
  assert.ok(client.requests.length <= 8);
});

test("a stop without tools is nudged to propose a plan", async () => {
  let db = makeDb();
  let art = db.lessons.find(l => l.topic == "Art" && l.location == "Golders Green");
  let client = scripted([
    { role: "assistant", content: "Here is my idea in words." },
    { role: "assistant", content: null, tool_calls: [call("1", "propose_plan", { picks: [{ child: "Mia", age: 8, lessonId: art._id.toString() }] })] }
  ]);
  let events = await run(client, { db });
  assert.equal(events.at(-1).type, "plan");
});

test("aborts when the client disconnects", async () => {
  let controller = new AbortController();
  let client = scripted([
    () => { controller.abort(); return { role: "assistant", content: null, tool_calls: [call("1", "search_lessons", { text: "art" })] }; },
    { role: "assistant", content: null, tool_calls: [call("2", "search_lessons", { text: "art" })] }
  ]);
  await run(client, { signal: controller.signal });
  assert.equal(client.requests.length, 1);
});

test("the run is counted once when the model is first called", async () => {
  let starts = 0;
  let client = scripted([{ role: "assistant", content: null, tool_calls: [call("1", "propose_plan", { picks: [] })] }]);
  await run(client, { onStart: () => { starts++; } });
  assert.equal(starts, 1);
});

test("saved children and home area reach the model", async () => {
  let client = scripted([{ role: "assistant", content: null, tool_calls: [call("1", "propose_plan", { picks: [] })] }]);
  await run(client, { profile: { homeArea: "Hendon", children: [{ name: "Mia", age: 8, interests: "drawing" }] } });
  let user = client.requests[0].find(m => m.role == "user").content;
  assert.match(user, /Mia, age 8, loves drawing/);
  assert.match(user, /Hendon/);
});

test("model failures become a friendly error", async () => {
  let client = { chat: { completions: { create: async () => { throw new Error("500 upstream"); } } } };
  let events = await run(client);
  assert.equal(events.at(-1).type, "error");
  assert.doesNotMatch(events.at(-1).message, /upstream/);
});

test("a bad plan in the last round still returns the valid picks", async () => {
  let db = makeDb();
  let art = db.lessons.find(l => l.topic == "Art" && l.location == "Golders Green");
  let search = { role: "assistant", content: null, tool_calls: [call("s", "search_lessons", { text: "art" })] };
  let bad = { role: "assistant", content: null, tool_calls: [call("p", "propose_plan", { picks: [{ child: "Mia", age: 8, lessonId: art._id.toString() }, { child: "Leo", age: 12, lessonId: "made-up" }] })] };
  let client = scripted([search, search, search, search, search, search, search, bad]);
  let events = await run(client, { db });
  assert.equal(events.at(-1).type, "plan");
  assert.equal(events.at(-1).plan.picks.length, 1);
});

test("only a handful of tool calls run per round", async () => {
  let many = Array.from({ length: 20 }, (_, i) => call("s" + i, "search_lessons", { text: "art" }));
  let client = scripted([{ role: "assistant", content: null, tool_calls: many }]);
  let events = await run(client);
  assert.ok(events.filter(e => e.type == "step").length <= 6);
  let replies = client.requests[1].filter(m => m.role == "tool");
  assert.equal(replies.length, 20);
});

test("saved children's ages reach plan validation", async () => {
  let db = makeDb();
  let coding = db.lessons.find(l => l.topic == "Coding" && l.location == "Finchley");
  let client = scripted([1, 2, 3].map(n => ({ role: "assistant", content: null, tool_calls: [call(String(n), "propose_plan", { picks: [{ child: "Leo", lessonId: coding._id.toString(), reason: "code" }] })] })));
  let events = await run(client, { db, profile: { children: [{ name: "Leo", age: 6, interests: "" }] } });
  assert.equal(events.at(-1).plan.picks.length, 0);
});
