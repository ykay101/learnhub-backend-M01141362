var express = require("express");
const { ObjectId } = require("mongodb");
const db = require("../db");

var router = express.Router();

router.get("/lessons", async function (request, response) {
  let collection = db.collection("lesson");
  let results = await collection.find({}).toArray();
  response.send(results);
});

router.put("/lessons/:id", async function (request, response) {
  if (!ObjectId.isValid(request.params.id)) {
    return response.status(400).send({ message: "Invalid lesson id" });
  }
  let collection = db.collection("lesson");
  const query = { _id: new ObjectId(request.params.id) };
  const updates = { $set: request.body };
  let result = await collection.updateOne(query, updates);
  response.send(result);
});

router.get("/search", async function (request, response) {
  let searchText = request.query.q || "";
  let safeText = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let collection = db.collection("lesson");
  let results = await collection.find({
    $or: [
      { topic: { $regex: safeText, $options: "i" } },
      { location: { $regex: safeText, $options: "i" } },
      { $expr: { $regexMatch: { input: { $toString: "$price" }, regex: safeText } } }
    ]
  }).toArray();
  response.send(results);
});

module.exports = router;
