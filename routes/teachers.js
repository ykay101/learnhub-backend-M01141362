var express = require("express");
const { ObjectId } = require("mongodb");
const db = require("../db");

var router = express.Router();

router.get("/teachers", async function (request, response) {
  let collection = db.collection("teacher");
  let results = await collection.find({}).toArray();
  response.send(results);
});

router.get("/teachers/:id/lessons", async function (request, response) {
  if (!ObjectId.isValid(request.params.id)) {
    return response.status(400).send({ message: "Invalid teacher id" });
  }
  let teacher = await db.collection("teacher").findOne({ _id: new ObjectId(request.params.id) });
  if (!teacher) {
    return response.status(404).send({ message: "Teacher not found" });
  }
  let lessons = await db.collection("lesson").find({ _id: { $in: teacher.lessonIDs } }).toArray();
  response.send(lessons);
});

module.exports = router;
