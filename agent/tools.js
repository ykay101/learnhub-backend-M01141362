const { areas } = require("../data/areas");

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function loadLessons(db) {
  let lessons = await db.collection("lesson").find({}).toArray();
  let teachers = await db.collection("teacher").find({}).toArray();
  return lessons.map(lesson => {
    let teacher = teachers.find(t => t.lessonIDs.some(id => id.toString() == lesson._id.toString()));
    return { ...lesson, teacher: teacher ? teacher.firstName + " " + teacher.lastName : "" };
  });
}

function summary(lesson) {
  return {
    id: lesson._id.toString(),
    topic: lesson.topic,
    location: lesson.location,
    price: lesson.price,
    spaces: lesson.space,
    day: lesson.day,
    time: lesson.time,
    ageMin: lesson.ageMin,
    ageMax: lesson.ageMax,
    teacher: lesson.teacher,
    description: lesson.description
  };
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function searchLessons(db, args) {
  let lessons = await loadLessons(db);
  let words = String(args.text || "").toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 1);
  let day = args.day ? String(args.day).slice(0, 3).toLowerCase() : "";

  let matches = lessons.map(lesson => {
    let haystack = [lesson.topic, lesson.location, lesson.description, lesson.teacher].join(" ").toLowerCase();
    let score = words.filter(word => new RegExp("\\b" + escape(word)).test(haystack)).length;
    return { lesson, score };
  }).filter(({ lesson, score }) => {
    if (words.length > 0 && score == 0) return false;
    if (args.age && (args.age < lesson.ageMin || args.age > lesson.ageMax)) return false;
    if (args.maxPrice && lesson.price > args.maxPrice) return false;
    if (day && lesson.day.toLowerCase() != day) return false;
    return true;
  });

  matches.sort((a, b) => b.score - a.score || a.price - b.price);
  return { lessons: matches.slice(0, 12).map(match => summary(match.lesson)) };
}

async function getEnrolment(db, args) {
  let lessons = await loadLessons(db);
  let lesson = lessons.find(l => l._id.toString() == args.lessonId);
  if (!lesson) return { error: "unknown_lesson" };
  let orders = await db.collection("order").find({ lessonIDs: args.lessonId }).toArray();
  let enrolled = 0;
  for (let order of orders) {
    let index = Array.isArray(order.lessonIDs) ? order.lessonIDs.indexOf(args.lessonId) : -1;
    let count = Array.isArray(order.spaces) ? Number(order.spaces[index]) : 0;
    enrolled = enrolled + (count > 0 ? count : 0);
  }
  return { lessonId: args.lessonId, enrolled: enrolled, spacesLeft: lesson.space };
}

function findArea(name) {
  let key = Object.keys(areas).find(area => area.toLowerCase() == String(name || "").trim().toLowerCase());
  return key ? { name: key, ...areas[key] } : null;
}

function miles(a, b) {
  let radians = value => value * Math.PI / 180;
  let dLat = radians(b.lat - a.lat);
  let dLng = radians(b.lng - a.lng);
  let h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

async function distanceFrom(db, args) {
  let area = findArea(args.area);
  if (!area) return { error: "unknown_area", knownAreas: Object.keys(areas) };
  let lessons = await loadLessons(db);
  let result = {};
  for (let id of args.lessonIds || []) {
    let lesson = lessons.find(l => l._id.toString() == id);
    if (lesson) result[id] = miles(area, lesson);
  }
  return { area: area.name, miles: result };
}

function minutes(time) {
  let [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function overlaps(a, b) {
  if (a.day != b.day) return false;
  let startA = minutes(a.time);
  let startB = minutes(b.time);
  return startA < startB + 60 && startB < startA + 60;
}

function findClashes(picks) {
  let clashes = [];
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      let a = picks[i];
      let b = picks[j];
      if (!overlaps(a.lesson, b.lesson)) continue;
      if (a.child == b.child) {
        clashes.push({ kind: "hard", children: [a.child], message: a.child + " can't do " + a.lesson.topic + " and " + b.lesson.topic + " at the same time on " + a.lesson.day });
      } else if (a.lesson.location != b.lesson.location) {
        clashes.push({ kind: "soft", children: [a.child, b.child], message: a.child + " and " + b.child + " are in " + a.lesson.location + " and " + b.lesson.location + " at the same time on " + a.lesson.day + ", so one adult can't do both runs" });
      }
    }
  }
  return clashes;
}

async function checkWeek(db, args) {
  let lessons = await loadLessons(db);
  let picks = (args.picks || []).map(pick => ({ child: pick.child, lesson: lessons.find(l => l._id.toString() == pick.lessonId) })).filter(pick => pick.lesson);
  return { clashes: findClashes(picks) };
}

function savedAge(savedChildren, name) {
  let child = (savedChildren || []).find(c => c.name.trim().toLowerCase() == String(name || "").trim().toLowerCase());
  return child ? child.age : null;
}

async function validatePlan(db, args, savedChildren) {
  let lessons = await loadLessons(db);
  let errors = [];
  let validPicks = [];
  for (let pick of Array.isArray(args.picks) ? args.picks : []) {
    let child = String(pick.child || "").trim().slice(0, 30);
    let lesson = lessons.find(l => l._id.toString() == pick.lessonId);
    if (!lesson) {
      errors.push("Lesson " + pick.lessonId + " does not exist. Only use ids from search_lessons.");
      continue;
    }
    let used = validPicks.filter(p => p.lesson === lesson).length;
    if (!(lesson.space > used)) {
      errors.push(used == 0 ? lesson.topic + " in " + lesson.location + " has no spaces left." : lesson.topic + " in " + lesson.location + " has only " + lesson.space + " space left.");
      continue;
    }
    let age = savedAge(savedChildren, child) || (Number.isInteger(pick.age) ? pick.age : null);
    if (child && age == null) {
      errors.push("Please give " + child + "'s age.");
      continue;
    }
    if (age != null && (age < lesson.ageMin || age > lesson.ageMax)) {
      errors.push(lesson.topic + " in " + lesson.location + " is for ages " + lesson.ageMin + "-" + lesson.ageMax + ", but " + (child || "the child") + " is " + age + ".");
      continue;
    }
    let candidate = { child: child, age: age, reason: String(pick.reason || "").slice(0, 300), lesson: lesson };
    let clash = child ? findClashes(validPicks.filter(p => p.child == child).concat([candidate])).find(c => c.kind == "hard") : null;
    if (clash) {
      errors.push(clash.message + ".");
      continue;
    }
    validPicks.push(candidate);
  }

  let clashes = findClashes(validPicks.filter(pick => pick.child));
  let budget = Number(args.budget) > 0 ? Number(args.budget) : null;
  let total = validPicks.reduce((sum, pick) => sum + pick.lesson.price, 0);
  let area = findArea(args.area);
  let plan = {
    picks: validPicks.map(pick => ({
      child: pick.child,
      age: pick.age,
      reason: pick.reason,
      miles: area ? miles(area, pick.lesson) : null,
      lesson: { ...summary(pick.lesson), _id: pick.lesson._id.toString(), image: pick.lesson.image }
    })),
    total: total,
    budget: budget,
    overBudget: budget != null && total > budget,
    clashes: clashes.filter(c => c.kind == "soft"),
    area: area ? area.name : null,
    note: String(args.note || "").slice(0, 400)
  };
  return { ok: errors.length == 0, errors: errors, validPicks: validPicks, plan: plan };
}

function describeStep(name, args) {
  if (name == "search_lessons") {
    let parts = [];
    if (args.age) parts.push("for " + ([8, 11, 18].includes(args.age) ? "an " : "a ") + args.age + "-year-old");
    if (args.text) parts.push("who likes " + args.text);
    if (args.maxPrice) parts.push("under £" + args.maxPrice);
    if (args.day) parts.push("on " + args.day);
    return { icon: "search", label: "Searching lessons" + (parts.length ? " " + parts.join(" ") : "") };
  }
  if (name == "get_enrolment") return { icon: "bar-chart", label: "Checking how popular a lesson is" };
  if (name == "distance_from") return { icon: "map-marker", label: "Measuring distances from " + (args.area || "home") };
  if (name == "check_week") return { icon: "calendar", label: "Checking the week for clashes" };
  if (name == "propose_plan") return { icon: "magic", label: "Putting the plan together" };
  return { icon: "cog", label: "Working" };
}

function summarise(name, result) {
  if (result.error == "unknown_area") return "area not known";
  if (result.error) return "not found";
  if (name == "search_lessons") return result.lessons.length + " found";
  if (name == "get_enrolment") return result.enrolled + " booked, " + result.spacesLeft + " spaces left";
  if (name == "distance_from") {
    let values = Object.values(result.miles);
    if (values.length == 0) return "done";
    return Math.min(...values) + "–" + Math.max(...values) + " miles";
  }
  if (name == "check_week") return result.clashes.length == 0 ? "no clashes" : result.clashes.length + (result.clashes.length == 1 ? " clash" : " clashes");
  return "done";
}

module.exports = { searchLessons, getEnrolment, distanceFrom, checkWeek, validatePlan, describeStep, summarise, DAYS };
