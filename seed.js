require("dotenv").config({ path: "./config.env" });
const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_PREFIX +
  process.env.MONGODB_USERNAME + ":" +
  process.env.MONGODB_PASSWORD +
  process.env.MONGODB_URL;
const client = new MongoClient(uri);
const db = client.db("learnhub");

const lessons = [
  { topic: "Maths",    location: "Hendon",        price: 100, space: 5, image: "maths.svg" },
  { topic: "English",  location: "Colindale",     price: 80,  space: 5, image: "english.svg" },
  { topic: "Science",  location: "Brent Cross",   price: 90,  space: 5, image: "science.svg" },
  { topic: "Art",      location: "Golders Green", price: 70,  space: 5, image: "art.svg" },
  { topic: "Music",    location: "Hendon",        price: 95,  space: 5, image: "music.svg" },
  { topic: "Coding",   location: "Finchley",      price: 120, space: 5, image: "coding.svg" },
  { topic: "Drama",    location: "Edgware",       price: 75,  space: 5, image: "drama.svg" },
  { topic: "Chess",    location: "Mill Hill",     price: 60,  space: 5, image: "chess.svg" },
  { topic: "Football", location: "Colindale",     price: 50,  space: 5, image: "football.svg" },
  { topic: "Swimming", location: "Barnet",        price: 110, space: 5, image: "swimming.svg" }
];

async function seed() {
  await db.collection("lesson").deleteMany({});
  await db.collection("teacher").deleteMany({});
  await db.collection("order").deleteMany({});

  let result = await db.collection("lesson").insertMany(lessons);
  let ids = result.insertedIds;

  const teachers = [
    { firstName: "Aoife", lastName: "Murphy", lessonIDs: [ids[0], ids[2], ids[5]] },
    { firstName: "Lars", lastName: "Haugen", lessonIDs: [ids[1], ids[6]] },
    { firstName: "Jamal", lastName: "Iris", lessonIDs: [ids[3], ids[4]] },
    { firstName: "Elif", lastName: "Yilmaz", lessonIDs: [ids[7], ids[8], ids[9]] }
  ];
  await db.collection("teacher").insertMany(teachers);

  console.log("Inserted " + lessons.length + " lessons and " + teachers.length + " teachers.");
  await client.close();
}

seed();
