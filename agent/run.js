const tools = require("./tools");
const { PLANNER_PROMPT, SIMILAR_PROMPT } = require("./prompts");

const MAX_ROUNDS = 8;
const MAX_PLAN_RETRIES = 2;
const MAX_CALLS_PER_ROUND = 6;

const pickSchema = {
  type: "object",
  properties: {
    child: { type: "string" },
    age: { type: ["integer", "null"] },
    lessonId: { type: "string" },
    reason: { type: "string" }
  },
  required: ["child", "lessonId", "reason"]
};

const TOOL_SPECS = [
  {
    type: "function",
    function: {
      name: "search_lessons",
      description: "Search 2Learn lessons. text matches subject, place, description or teacher. Filters are optional.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          age: { type: "integer" },
          maxPrice: { type: "number" },
          day: { type: "string", enum: tools.DAYS }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_enrolment",
      description: "How many spaces have been booked for a lesson, and how many are left.",
      parameters: { type: "object", properties: { lessonId: { type: "string" } }, required: ["lessonId"] }
    }
  },
  {
    type: "function",
    function: {
      name: "distance_from",
      description: "Distance in miles from a North London area to each lesson.",
      parameters: { type: "object", properties: { area: { type: "string" }, lessonIds: { type: "array", items: { type: "string" } } }, required: ["area", "lessonIds"] }
    }
  },
  {
    type: "function",
    function: {
      name: "check_week",
      description: "Check a set of picks for timetable clashes.",
      parameters: { type: "object", properties: { picks: { type: "array", items: { type: "object", properties: { child: { type: "string" }, lessonId: { type: "string" } }, required: ["child", "lessonId"] } } }, required: ["picks"] }
    }
  },
  {
    type: "function",
    function: {
      name: "propose_plan",
      description: "Final step: the plan to show the parent.",
      parameters: {
        type: "object",
        properties: {
          picks: { type: "array", items: pickSchema },
          budget: { type: ["number", "null"] },
          area: { type: ["string", "null"] },
          note: { type: "string" }
        },
        required: ["picks"]
      }
    }
  }
];

const RUNNERS = {
  search_lessons: tools.searchLessons,
  get_enrolment: tools.getEnrolment,
  distance_from: tools.distanceFrom,
  check_week: tools.checkWeek
};

function userMessage(mode, message, profile) {
  let lines = [];
  if (mode == "similar") {
    lines.push("The fully booked lesson is: " + message);
  } else {
    lines.push("Parent's request: " + message);
  }
  if (profile.homeArea) lines.push("Saved home area: " + profile.homeArea);
  if (profile.children && profile.children.length) {
    lines.push("Saved children: " + profile.children.map(child => child.name + ", age " + child.age + (child.interests ? ", loves " + child.interests : "")).join("; "));
  }
  return lines.join("\n");
}

function parseArgs(text) {
  try {
    return JSON.parse(text || "{}");
  } catch (error) {
    return null;
  }
}

async function runAgent({ client, model, db, mode, message, profile, emit, signal, onStart }) {
  let messages = [
    { role: "system", content: mode == "similar" ? SIMILAR_PROMPT : PLANNER_PROMPT },
    { role: "user", content: userMessage(mode, message, profile || {}) }
  ];
  let planAttempts = 0;
  let started = false;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (signal && signal.aborted) return;
      if (!started) {
        started = true;
        if (onStart) await onStart();
      }
      let response = await client.chat.completions.create({ model: model, messages: messages, tools: TOOL_SPECS }, { signal: signal });
      if (signal && signal.aborted) return;
      let reply = response.choices[0].message;
      messages.push(reply);

      if (!reply.tool_calls || reply.tool_calls.length == 0) {
        messages.push({ role: "user", content: "Please finish by calling propose_plan." });
        continue;
      }

      for (let i = 0; i < reply.tool_calls.length; i++) {
        let toolCall = reply.tool_calls[i];
        let name = toolCall.function.name;
        if (i >= MAX_CALLS_PER_ROUND && name != "propose_plan") {
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: "Too many tool calls at once. Use fewer." }) });
          continue;
        }
        let args = parseArgs(toolCall.function.arguments);

        if (args == null) {
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: "Arguments were not valid JSON" }) });
          continue;
        }

        if (name == "propose_plan") {
          emit({ type: "step", ...tools.describeStep(name, args) });
          let saved = mode == "similar" ? [] : (profile && profile.children) || [];
          let result = await tools.validatePlan(db, args, saved);
          if (result.ok || planAttempts >= MAX_PLAN_RETRIES || round == MAX_ROUNDS - 1) {
            let plan = result.plan;
            if (!result.ok) {
              plan.note = (plan.note ? plan.note + " " : "") + "I couldn't fit everything: " + result.errors.join(" ");
            }
            emit({ type: "plan", plan: plan });
            return;
          }
          planAttempts++;
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ ok: false, errors: result.errors, hint: "Fix these picks and call propose_plan again." }) });
          continue;
        }

        let runner = RUNNERS[name];
        if (!runner) {
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: "Unknown tool " + name }) });
          continue;
        }
        emit({ type: "step", ...tools.describeStep(name, args) });
        let result = await runner(db, args);
        emit({ type: "step_done", detail: tools.summarise(name, result) });
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
    }
    emit({ type: "error", message: "The planner took too many steps. Please try a simpler request." });
  } catch (error) {
    if (signal && signal.aborted) return;
    console.log("  Planner error: " + error.message);
    emit({ type: "error", message: "The planner isn't available right now. Please try again in a moment." });
  }
}

module.exports = { runAgent, TOOL_SPECS };
