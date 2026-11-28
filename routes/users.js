var express = require("express");
const { ObjectId } = require("mongodb");
const db = require("../db");
const auth = require("../auth");

var router = express.Router();

const failedLogins = new Map();
const LOGIN_WINDOW = 15 * 60 * 1000;
const LOGIN_LIMIT = 10;
let dummy = null;

function tooManyAttempts(email) {
  let entry = failedLogins.get(email);
  return entry && entry.count >= LOGIN_LIMIT && Date.now() - entry.first < LOGIN_WINDOW;
}

function recordFailure(email) {
  let entry = failedLogins.get(email);
  if (!entry || Date.now() - entry.first >= LOGIN_WINDOW) {
    entry = { count: 0, first: Date.now() };
  }
  entry.count = entry.count + 1;
  failedLogins.set(email, entry);
}

router.post("/auth/register", async function (request, response) {
  let problem = auth.validateRegistration(request.body);
  if (problem) {
    return response.status(400).send({ error: problem });
  }
  let email = request.body.email.trim().toLowerCase();
  let users = db.collection("user");
  if (await users.findOne({ email: email })) {
    return response.status(409).send({ error: "That email already has an account. Please sign in." });
  }
  let { hash, salt } = await auth.hashPassword(request.body.password);
  let user = {
    name: request.body.name.trim(),
    email: email,
    passwordHash: hash,
    salt: salt,
    phone: "",
    homeArea: "",
    children: [],
    createdAt: new Date()
  };
  try {
    let result = await users.insertOne(user);
    user._id = result.insertedId;
  } catch (error) {
    if (error.code == 11000) {
      return response.status(409).send({ error: "That email already has an account. Please sign in." });
    }
    throw error;
  }
  let token = await auth.createSession(user._id);
  response.send({ token: token, user: auth.publicUser(user) });
});

router.post("/auth/login", async function (request, response) {
  let email = typeof request.body.email == "string" ? request.body.email.trim().toLowerCase() : "";
  let password = typeof request.body.password == "string" ? request.body.password : "";
  if (tooManyAttempts(email)) {
    return response.status(429).send({ error: "Too many attempts. Please wait 15 minutes and try again." });
  }
  let user = email ? await db.collection("user").findOne({ email: email }) : null;
  if (!dummy) {
    dummy = await auth.hashPassword("not-a-real-password");
  }
  let matches = false;
  if (user) {
    matches = await auth.verifyPassword(password, user.passwordHash, user.salt);
  } else {
    await auth.verifyPassword(password, dummy.hash, dummy.salt);
  }
  if (!matches) {
    recordFailure(email);
    return response.status(401).send({ error: "Wrong email or password" });
  }
  failedLogins.delete(email);
  let token = await auth.createSession(user._id);
  response.send({ token: token, user: auth.publicUser(user) });
});

router.post("/auth/logout", auth.requireUser, async function (request, response) {
  await db.collection("session").deleteOne({ token: request.token });
  response.send({ ok: true });
});

router.get("/auth/me", auth.requireUser, function (request, response) {
  response.send({ user: auth.publicUser(request.user) });
});

router.put("/me/profile", auth.requireUser, async function (request, response) {
  let body = {
    phone: typeof request.body.phone == "string" ? request.body.phone.trim() : "",
    homeArea: typeof request.body.homeArea == "string" ? request.body.homeArea.trim() : "",
    children: request.body.children
  };
  let problem = auth.validateProfile(body);
  if (problem) {
    return response.status(400).send({ error: problem });
  }
  body.children = body.children.map(child => ({
    name: child.name.trim(),
    age: child.age,
    interests: (child.interests || "").trim()
  }));
  await db.collection("user").updateOne({ _id: request.user._id }, { $set: body });
  let user = await db.collection("user").findOne({ _id: request.user._id });
  response.send({ user: auth.publicUser(user) });
});

router.get("/orders/mine", auth.requireUser, async function (request, response) {
  let orders = await db.collection("order").find({ userId: request.user._id }).sort({ createdAt: -1 }).toArray();
  let ids = [];
  for (let order of orders) {
    for (let id of order.lessonIDs || []) {
      if (ObjectId.isValid(id)) ids.push(new ObjectId(id));
    }
  }
  let lessons = await db.collection("lesson").find({ _id: { $in: ids } }).toArray();
  let result = orders.map(order => ({
    _id: order._id,
    createdAt: order.createdAt,
    status: order.status,
    amount: order.amount,
    cardLast4: order.cardLast4,
    spaces: order.spaces,
    lessons: (order.lessonIDs || []).map(id => {
      let lesson = lessons.find(l => l._id.toString() == id);
      return lesson
        ? { _id: lesson._id, topic: lesson.topic, location: lesson.location, day: lesson.day, time: lesson.time, price: lesson.price, image: lesson.image }
        : { _id: id, topic: "Lesson no longer listed" };
    })
  }));
  response.send(result);
});

module.exports = router;
