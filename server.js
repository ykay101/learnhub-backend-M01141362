var express = require("express");
var cors = require("cors");
var path = require("path");
require("dotenv").config({ path: "./config.env" });

const { MongoClient, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_PREFIX +
  process.env.MONGODB_USERNAME + ":" +
  process.env.MONGODB_PASSWORD +
  process.env.MONGODB_URL;
const client = new MongoClient(uri);
const db = client.db("learnhub");

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
  } catch (err) {
    console.dir(err);
  }
}
connectToMongoDB();

var app = express();
app.use(cors());
app.use(express.json());

app.use(function (request, response, next) {
  console.log(new Date().toISOString() + " " + request.method + " " + request.url);
  if (request.method == "POST" || request.method == "PUT") {
    console.log("  Body: " + JSON.stringify(request.body));
  }
  next();
});

var imagesPath = path.resolve(__dirname, "images");
app.use("/images", express.static(imagesPath));
app.use("/images", function (request, response) {
  response.status(404).send("Image not found!");
});

app.get("/lessons", async function (request, response) {
  let collection = db.collection("lesson");
  let results = await collection.find({}).toArray();
  response.send(results);
});

app.get("/search", async function (request, response) {
  let searchText = request.query.q || "";
  let safeText = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let collection = db.collection("lesson");
  let results = await collection.find({
    $or: [
      { topic: { $regex: safeText, $options: "i" } },
      { location: { $regex: safeText, $options: "i" } },
      { $expr: { $regexMatch: { input: { $toString: "$price" }, regex: safeText } } },
      { $expr: { $regexMatch: { input: { $toString: "$space" }, regex: safeText } } }
    ]
  }).toArray();
  response.send(results);
});

app.post("/orders", async function (request, response) {
  let collection = db.collection("order");
  let result = await collection.insertOne(request.body);
  response.send(result);
});

app.put("/lessons/:id", async function (request, response) {
  if (!ObjectId.isValid(request.params.id)) {
    return response.status(400).send({ message: "Invalid lesson id" });
  }
  let collection = db.collection("lesson");
  const query = { _id: new ObjectId(request.params.id) };
  const updates = { $set: request.body };
  let result = await collection.updateOne(query, updates);
  response.send(result);
});

app.get("/enrolment/:lessonid", async function (request, response) {
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

app.get("/teachers", async function (request, response) {
  let collection = db.collection("teacher");
  let results = await collection.find({}).toArray();
  response.send(results);
});

app.get("/teachers/:id/lessons", async function (request, response) {
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

app.use(function (request, response) {
  response.status(404).send("Page not found!");
});

var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("App started on port " + port);
});
