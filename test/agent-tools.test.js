const test = require("node:test");
const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const tools = require("../agent/tools");
const { lessons: seedLessons, teachers: seedTeachers } = require("../data/lessons");

function makeDb(orders = []) {
  let lessons = seedLessons.map(lesson => ({ ...lesson, _id: new ObjectId() }));
  let teachers = seedTeachers.map(t => ({ firstName: t.firstName, lastName: t.lastName, lessonIDs: t.lessons.map(i => lessons[i]._id) }));
  let data = { lesson: lessons, teacher: teachers, order: orders };
  return {
    lessons,
    collection(name) {
      return {
        find: query => ({
          toArray: async () => data[name].filter(doc => !query || !query.lessonIDs || doc.lessonIDs.includes(query.lessonIDs))
        })
      };
    }
  };
}

const find = (db, topic, location) => db.lessons.find(l => l.topic == topic && (!location || l.location == location));
const id = lesson => lesson._id.toString();

test("search finds lessons by interest and age", async () => {
  let db = makeDb();
  let result = await tools.searchLessons(db, { text: "drawing art", age: 8 });
  let topics = result.lessons.map(l => l.topic + "@" + l.location);
  assert.deepEqual(topics, ["Art@Golders Green"]);
  assert.equal(result.lessons[0].teacher, "Yenefa Aslav");
});

test("search filters by price and day", async () => {
  let db = makeDb();
  let cheap = await tools.searchLessons(db, { maxPrice: 60 });
  assert.ok(cheap.lessons.every(l => l.price <= 60));
  assert.equal(cheap.lessons.length, 3);
  let saturday = await tools.searchLessons(db, { day: "sat" });
  assert.ok(saturday.lessons.every(l => l.day == "Sat"));
});

test("enrolment counts booked spaces", async () => {
  let db = makeDb();
  let maths = find(db, "Maths");
  db = makeDb([{ lessonIDs: [id(maths)], spaces: [2] }]);
  maths = db.lessons.find(l => l.topic == "Maths");
  let dbWithOrders = { ...db, collection: name => name == "order" ? { find: () => ({ toArray: async () => [{ lessonIDs: [id(maths)], spaces: [2] }, { lessonIDs: ["x", id(maths)], spaces: [1, 1] }] }) } : db.collection(name) };
  let result = await tools.getEnrolment(dbWithOrders, { lessonId: id(maths) });
  assert.equal(result.enrolled, 3);
  assert.equal(result.spacesLeft, 5);
});

test("distance from Hendon to Finchley is about 2 miles", async () => {
  let db = makeDb();
  let coding = find(db, "Coding", "Finchley");
  let result = await tools.distanceFrom(db, { area: "hendon", lessonIds: [id(coding)] });
  let miles = result.miles[id(coding)];
  assert.ok(miles > 1.7 && miles < 2.3, "miles " + miles);
});

test("unknown areas are reported with the known list", async () => {
  let result = await tools.distanceFrom(makeDb(), { area: "Atlantis", lessonIds: [] });
  assert.equal(result.error, "unknown_area");
  assert.ok(result.knownAreas.includes("Hendon"));
});

test("checkWeek finds same-child and two-place clashes", async () => {
  let db = makeDb();
  let artGG = find(db, "Art", "Golders Green");
  let codingH = find(db, "Coding", "Hendon");
  let english = find(db, "English");
  let none = await tools.checkWeek(db, { picks: [{ child: "Mia", lessonId: id(artGG) }, { child: "Leo", lessonId: id(english) }] });
  assert.equal(none.clashes.length, 1);
  assert.equal(none.clashes[0].kind, "soft");
  let same = await tools.checkWeek(db, { picks: [{ child: "Mia", lessonId: id(artGG) }, { child: "Mia", lessonId: id(english) }] });
  assert.equal(same.clashes[0].kind, "hard");
  let fine = await tools.checkWeek(db, { picks: [{ child: "Mia", lessonId: id(artGG) }, { child: "Leo", lessonId: id(codingH) }] });
  assert.deepEqual(fine.clashes, []);
});

test("validatePlan totals from the database and flags budget", async () => {
  let db = makeDb();
  let art = find(db, "Art", "Golders Green");
  let coding = find(db, "Coding", "Finchley");
  let result = await tools.validatePlan(db, { picks: [{ child: "Mia", age: 8, lessonId: id(art), reason: "loves drawing" }, { child: "Leo", age: 12, lessonId: id(coding), reason: "wants to code" }], budget: 150, area: "Hendon" });
  assert.equal(result.ok, true);
  assert.equal(result.plan.total, 190);
  assert.equal(result.plan.overBudget, true);
  assert.equal(result.plan.picks[0].lesson.topic, "Art");
});

test("validatePlan rejects unknown, full and wrong-age picks", async () => {
  let db = makeDb();
  let art = find(db, "Art", "Golders Green");
  art.space = 0;
  let coding = find(db, "Coding", "Finchley");
  let result = await tools.validatePlan(db, { picks: [
    { child: "Mia", age: 8, lessonId: "nope" },
    { child: "Mia", age: 8, lessonId: id(art) },
    { child: "Leo", age: 6, lessonId: id(coding) }
  ] });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 3);
  assert.equal(result.validPicks.length, 0);
});

test("step labels describe what the agent is doing", () => {
  assert.deepEqual(tools.describeStep("search_lessons", { text: "art", age: 8 }), { icon: "search", label: "Searching lessons for an 8-year-old who likes art" });
  assert.equal(tools.describeStep("check_week", { picks: [1, 2] }).label, "Checking the week for clashes");
  assert.equal(tools.summarise("search_lessons", { lessons: [1, 2] }), "2 found");
  assert.equal(tools.summarise("check_week", { clashes: [] }), "no clashes");
});

test("saved ages are used even when the model leaves them out", async () => {
  let db = makeDb();
  let coding = find(db, "Coding", "Finchley");
  let result = await tools.validatePlan(db, { picks: [{ child: "Leo", age: null, lessonId: id(coding) }] }, [{ name: "Leo", age: 6 }]);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /ages 11-15/);
});

test("a pick with no known age is refused in a family plan", async () => {
  let db = makeDb();
  let coding = find(db, "Coding", "Finchley");
  let result = await tools.validatePlan(db, { picks: [{ child: "Zed", lessonId: id(coding) }] }, []);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /age/);
});

test("hard clashes are removed from the final plan", async () => {
  let db = makeDb();
  let art = find(db, "Art", "Golders Green");
  let english = find(db, "English");
  let result = await tools.validatePlan(db, { picks: [{ child: "Mia", age: 8, lessonId: id(art) }, { child: "Mia", age: 8, lessonId: id(english) }] });
  assert.equal(result.ok, false);
  assert.equal(result.validPicks.length, 1);
  assert.equal(result.plan.picks.length, 1);
  assert.equal(result.plan.total, 70);
});

test("two children cannot take the last space of the same lesson", async () => {
  let db = makeDb();
  let art = find(db, "Art", "Golders Green");
  art.space = 1;
  let result = await tools.validatePlan(db, { picks: [{ child: "Mia", age: 8, lessonId: id(art) }, { child: "Ivy", age: 8, lessonId: id(art) }] });
  assert.equal(result.plan.picks.length, 1);
  assert.match(result.errors[0], /only 1 space/i);
});

test("broken orders do not break the enrolment tool", async () => {
  let db = makeDb();
  let maths = find(db, "Maths");
  let broken = { ...db, collection: name => name == "order" ? { find: () => ({ toArray: async () => [{ lessonIDs: [id(maths)] }, { lessonIDs: [id(maths)], spaces: ["2"] }] }) } : db.collection(name) };
  let result = await tools.getEnrolment(broken, { lessonId: id(maths) });
  assert.equal(result.enrolled, 2);
});

test("model text is trimmed to a sensible length", async () => {
  let db = makeDb();
  let art = find(db, "Art", "Golders Green");
  let result = await tools.validatePlan(db, { picks: [{ child: "M".repeat(100), age: 8, lessonId: id(art), reason: "x".repeat(900) }] });
  assert.ok(result.plan.picks[0].reason.length <= 300);
  assert.ok(result.plan.picks[0].child.length <= 30);
});
