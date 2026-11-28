const test = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword, validateRegistration, validateProfile, cleanLogBody } = require("../auth");

test("a password hashes and verifies", async () => {
  let { hash, salt } = await hashPassword("correct horse");
  assert.equal(hash.length, 128);
  assert.equal(salt.length, 32);
  assert.equal(await verifyPassword("correct horse", hash, salt), true);
  assert.equal(await verifyPassword("wrong horse", hash, salt), false);
});

test("the same password gets a different salt each time", async () => {
  let a = await hashPassword("same password");
  let b = await hashPassword("same password");
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

test("registration needs a name, email and 8 character password", () => {
  assert.equal(validateRegistration({ name: "Ann Lee", email: "ann@example.com", password: "12345678" }), null);
  assert.match(validateRegistration({ name: "Ann1", email: "ann@example.com", password: "12345678" }), /name/i);
  assert.match(validateRegistration({ name: "   ", email: "ann@example.com", password: "12345678" }), /name/i);
  assert.match(validateRegistration({ name: "Ann", email: "ann", password: "12345678" }), /email/i);
  assert.match(validateRegistration({ name: "Ann", email: "ann@example.com", password: "short" }), /8/);
  assert.match(validateRegistration({ name: "Ann", email: "ann@example.com" }), /8/);
});

test("profiles check phone, area and children", () => {
  let good = { phone: "07123", homeArea: "Hendon", children: [{ name: "Mia", age: 8, interests: "drawing" }] };
  assert.equal(validateProfile(good), null);
  assert.equal(validateProfile({ phone: "", homeArea: "", children: [] }), null);
  assert.match(validateProfile({ ...good, phone: "07a" }), /phone/i);
  assert.match(validateProfile({ ...good, homeArea: "x".repeat(41) }), /area/i);
  assert.match(validateProfile({ ...good, children: [{ name: "Mia2", age: 8, interests: "" }] }), /name/i);
  assert.match(validateProfile({ ...good, children: [{ name: "Mia", age: 2, interests: "" }] }), /age/i);
  assert.match(validateProfile({ ...good, children: [{ name: "Mia", age: 8.5, interests: "" }] }), /age/i);
  assert.match(validateProfile({ ...good, children: Array(7).fill({ name: "Mia", age: 8, interests: "" }) }), /6/);
  assert.match(validateProfile({ ...good, children: "nope" }), /children/i);
});

test("the logger never sees passwords", () => {
  assert.deepEqual(cleanLogBody("/auth/login", { email: "a@b.com", password: "secret123" }), { email: "a@b.com" });
  assert.deepEqual(cleanLogBody("/auth/register", { name: "Ann", email: "a@b.com", password: "secret123" }), { email: "a@b.com" });
  assert.deepEqual(cleanLogBody("/orders", { name: "Ann", password: "x" }), { name: "Ann", password: "***" });
});
