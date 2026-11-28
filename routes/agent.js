var express = require("express");
const { ObjectId } = require("mongodb");
const db = require("../db");
const { requireUser } = require("../auth");
const { client, model } = require("../agent/client");
const { runAgent } = require("../agent/run");

var router = express.Router();

const USER_DAILY_LIMIT = 20;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dailyCap() {
  return Number(process.env.AGENT_DAILY_CAP) || 300;
}

async function checkLimits(user) {
  let runs = user.agentRuns && user.agentRuns.date == today() ? user.agentRuns.count : 0;
  if (runs >= USER_DAILY_LIMIT) {
    return "You've used today's " + USER_DAILY_LIMIT + " plans. Please come back tomorrow.";
  }
  let usage = await db.collection("agent_usage").findOne({ date: today() });
  if (usage && usage.count >= dailyCap()) {
    return "The planner is very busy today. Please try again tomorrow.";
  }
  return null;
}

async function countRun(user) {
  let date = today();
  if (user.agentRuns && user.agentRuns.date == date) {
    await db.collection("user").updateOne({ _id: user._id }, { $inc: { "agentRuns.count": 1 } });
  } else {
    await db.collection("user").updateOne({ _id: user._id }, { $set: { agentRuns: { date: date, count: 1 } } });
  }
  await db.collection("agent_usage").updateOne({ date: date }, { $inc: { count: 1 } }, { upsert: true });
}

async function stream(request, response, mode, message) {
  let problem = await checkLimits(request.user);
  if (problem) {
    return response.status(429).send({ error: problem });
  }

  response.setHeader("Content-Type", "application/x-ndjson");
  response.setHeader("Cache-Control", "no-cache");
  response.flushHeaders();

  let controller = new AbortController();
  response.on("close", function () {
    if (!response.writableEnded) controller.abort();
  });

  await runAgent({
    client: client,
    model: model,
    db: db,
    mode: mode,
    message: message,
    profile: { homeArea: request.user.homeArea, children: request.user.children || [] },
    emit: event => response.write(JSON.stringify(event) + "\n"),
    signal: controller.signal,
    onStart: () => countRun(request.user)
  });
  response.end();
}

router.use("/agent", requireUser, function (request, response, next) {
  if (!client) {
    return response.status(503).send({ error: "The planner isn't switched on yet." });
  }
  next();
});

router.post("/agent/plan", async function (request, response) {
  let message = typeof request.body.message == "string" ? request.body.message.trim() : "";
  if (message.length == 0 || message.length > 500) {
    return response.status(400).send({ error: "Please describe your family in up to 500 characters." });
  }
  await stream(request, response, "plan", message);
});

router.post("/agent/similar", async function (request, response) {
  let id = request.body.lessonId;
  if (typeof id != "string" || !ObjectId.isValid(id)) {
    return response.status(400).send({ error: "Unknown lesson" });
  }
  let lesson = await db.collection("lesson").findOne({ _id: new ObjectId(id) });
  if (!lesson) {
    return response.status(400).send({ error: "Unknown lesson" });
  }
  let description = lesson.topic + " in " + lesson.location + " on " + lesson.day + " at " + lesson.time + ", ages " + lesson.ageMin + "-" + lesson.ageMax + ", £" + lesson.price + " (id " + id + ")";
  await stream(request, response, "similar", description);
});

module.exports = router;
