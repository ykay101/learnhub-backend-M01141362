const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { lessons, teachers } = require("../data/lessons");

test("there are 16 lessons with 5 spaces", () => {
  assert.equal(lessons.length, 16);
  for (let lesson of lessons) assert.equal(lesson.space, 5);
});

test("every lesson has the marked and schedule fields", () => {
  let days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let lesson of lessons) {
    assert.ok(typeof lesson.topic == "string" && lesson.topic.length > 0);
    assert.ok(typeof lesson.location == "string" && lesson.location.length > 0);
    assert.ok(typeof lesson.price == "number" && lesson.price > 0);
    assert.ok(days.includes(lesson.day), lesson.topic + " day");
    assert.match(lesson.time, /^\d{2}:\d{2}$/);
    assert.ok(lesson.ageMin < lesson.ageMax, lesson.topic + " ages");
    assert.ok(lesson.description.length > 10);
    assert.equal(typeof lesson.lat, "number");
    assert.equal(typeof lesson.lng, "number");
  }
});

test("every image file exists", () => {
  for (let lesson of lessons) {
    assert.ok(fs.existsSync(path.join(__dirname, "../images", lesson.image)), lesson.image);
  }
});

test("every lesson has exactly one teacher", () => {
  let all = teachers.flatMap(t => t.lessons).sort((a, b) => a - b);
  assert.deepEqual(all, [...Array(16).keys()]);
});

test("teachers are the four from v1", () => {
  assert.deepEqual(teachers.map(t => t.firstName + " " + t.lastName), ["Aoife Murphy", "Lars Haugen", "Jamal Iris", "Elif Yilmaz"]);
});
