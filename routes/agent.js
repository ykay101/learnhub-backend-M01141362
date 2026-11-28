var express = require("express");
const { ObjectId } = require("mongodb");
const db = require("../db");
const { requireUser } = require("../auth");
const { client, model } = require("../agent/client");
const { runAgent } = require("../agent/run");

var router = express.Router();

const USER_DAILY_LIMIT = 20;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

function dailyCap() {
  let cap = parseInt(process.env.AGENT_DAILY_CAP, 10);
  return Number.isInteger(cap) && cap >= 0 ? cap : 300;
}

async function bumpUser(user, date) {
  let users = db.collection("user");
  let updated = await users.findOneAndUpdate({ _id: user._id, "agentRuns.date": date }, { $inc: { "agentRuns.count": 1 } }, { returnDocument: "after" });
  if (!updated) {
    updated = await users.findOneAndUpdate({ _id: user._id, "agentRuns.date": { $ne: date } }, { $set: { agentRuns: { date: date, count: 1 } } }, { returnDocument: "after" });
  }
  if (!updated) {
    updated = await users.findOneAndUpdate({ _id: user._id, "agentRuns.date": date }, { $inc: { "agentRuns.count": 1 } }, { returnDocument: "after" });
  }
  return updated.agentRuns.count;
}

async function bumpGlobal(date) {
  let usage = db.collection("agent_usage");
  try {
    return (await usage.findOneAndUpdate({ date: date }, { $inc: { count: 1 } }, { upsert: true, returnDocument: "after" })).count;
  } catch (error) {
    if (error.code != 11000) throw error;
    return (await usage.findOneAndUpdate({ date: date }, { $inc: { count: 1 } }, { returnDocument: "after" })).count;
  }
}

async function releaseRun(user, date) {
  await db.collection("user").updateOne({ _id: user._id, "agentRuns.date": date }, { $inc: { "agentRuns.count": -1 } });
  await db.collection("agent_usage").updateOne({ date: date }, { $inc: { count: -1 } });
}

async function reserveRun(user) {
  let date = today();
  let mine = await bumpUser(user, date);
  if (mine > USER_DAILY_LIMIT) {
    await db.collection("user").updateOne({ _id: user._id, "agentRuns.date": date }, { $inc: { "agentRuns.count": -1 } });
    return { error: "You've used today's " + USER_DAILY_LIMIT + " plans. Please come back tomorrow." };
  }
  let everyone = await bumpGlobal(date);
  if (everyone > dailyCap()) {
    await releaseRun(user, date);
    return { error: "The planner is very busy today. Please try again tomorrow." };
  }
  return { date: date };
}

async function stream(request, response, mode, message) {
  let reservation = await reserveRun(request.user);
  if (reservation.error) {
    return response.status(429).send({ error: reservation.error });
  }
  let started = false;

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
    onStart: () => { started = true; }
  });
  if (!started) {
    await releaseRun(request.user, reservation.date);
  }
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
