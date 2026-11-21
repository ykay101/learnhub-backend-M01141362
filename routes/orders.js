var express = require("express");
const db = require("../db");

var router = express.Router();

router.post("/orders", async function (request, response) {
  let collection = db.collection("order");
  let result = await collection.insertOne(request.body);
  response.send(result);
});

router.get("/enrolment/:lessonid", async function (request, response) {
  let lessonID = request.params.lessonid;
  let collection = db.collection("order");
  let orders = await collection.find({ lessonIDs: lessonID }).toArray();
  let total = 0;
  for (let order of orders) {
    let index = order.lessonIDs.indexOf(lessonID);
    total = total + order.spaces[index];
  }
  response.send({ lessonID: lessonID, enrolment: total });
});

module.exports = router;
