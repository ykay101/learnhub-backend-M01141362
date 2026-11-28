const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 7;

async function hashPassword(password) {
  let salt = crypto.randomBytes(16).toString("hex");
  let key = await scrypt(password, salt, 64);
  return { hash: key.toString("hex"), salt: salt };
}

async function verifyPassword(password, hash, salt) {
  let key = await scrypt(password, salt, 64);
  let stored = Buffer.from(hash, "hex");
  return stored.length == key.length && crypto.timingSafeEqual(stored, key);
}

function validName(name) {
  return typeof name == "string" && /^[A-Za-z ]+$/.test(name) && /[A-Za-z]/.test(name);
}

function validateRegistration(body) {
  if (!validName(body.name) || body.name.trim().length > 40) {
    return "Please enter your name using letters only";
  }
  if (typeof body.email != "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return "Please enter a valid email address";
  }
  if (typeof body.password != "string" || body.password.length < 8) {
    return "Your password needs at least 8 characters";
  }
  return null;
}

function validateProfile(body) {
  if (body.phone && !/^[0-9]+$/.test(body.phone)) {
    return "Please use numbers only for the phone";
  }
  if (body.homeArea && (typeof body.homeArea != "string" || body.homeArea.length > 40)) {
    return "Please keep the home area under 40 characters";
  }
  if (!Array.isArray(body.children)) {
    return "Children must be a list";
  }
  if (body.children.length > 6) {
    return "You can save up to 6 children";
  }
  for (let child of body.children) {
    if (!child || typeof child != "object") {
      return "Please give each child a name using letters only";
    }
    if (!validName(child.name) || child.name.trim().length > 30) {
      return "Please give each child a name using letters only";
    }
    if (!Number.isInteger(child.age) || child.age < 3 || child.age > 17) {
      return "Each child's age must be a whole number from 3 to 17";
    }
    if (child.interests && (typeof child.interests != "string" || child.interests.length > 80)) {
      return "Please keep interests under 80 characters";
    }
  }
  return null;
}

function cleanLogBody(url, body) {
  if (url.startsWith("/auth/")) {
    return { email: body.email };
  }
  if (body && body.password !== undefined) {
    return { ...body, password: "***" };
  }
  return body;
}

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    homeArea: user.homeArea || "",
    children: user.children || []
  };
}

async function createSession(userId) {
  const db = require("./db");
  let token = crypto.randomBytes(32).toString("hex");
  await db.collection("session").insertOne({ token: token, userId: userId, createdAt: new Date() });
  return token;
}

async function readUser(request, response, next) {
  const db = require("./db");
  request.user = null;
  let header = request.headers.authorization || "";
  let match = header.match(/^Bearer ([0-9a-f]{64})$/);
  if (match) {
    let oldest = new Date(Date.now() - SESSION_DAYS * 24 * 60 * 60 * 1000);
    let session = await db.collection("session").findOne({ token: match[1], createdAt: { $gt: oldest } });
    if (session) {
      request.user = await db.collection("user").findOne({ _id: session.userId });
      request.token = match[1];
    }
  }
  next();
}

function requireUser(request, response, next) {
  if (!request.user) {
    return response.status(401).send({ error: "Please sign in" });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  validateRegistration,
  validateProfile,
  cleanLogBody,
  publicUser,
  createSession,
  readUser,
  requireUser
};
