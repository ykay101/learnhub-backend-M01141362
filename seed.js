require("dotenv").config({ path: "./config.env" });
const { MongoClient } = require("mongodb");
const { lessons, teachers } = require("./data/lessons");

const uri = process.env.MONGODB_PREFIX +
  process.env.MONGODB_USERNAME + ":" +
  process.env.MONGODB_PASSWORD +
  process.env.MONGODB_URL;
const client = new MongoClient(uri);
if (!process.env.MONGODB_DB) {
  console.log("Set MONGODB_DB in config.env (for example learnhub) before seeding.");
  process.exit(1);
}
const db = client.db(process.env.MONGODB_DB);

async function seed() {
  await db.collection("lesson").deleteMany({});
  await db.collection("teacher").deleteMany({});
  await db.collection("order").deleteMany({});

  let result = await db.collection("lesson").insertMany(lessons.map(lesson => ({ ...lesson })));
  let ids = result.insertedIds;

  let teacherDocs = teachers.map(teacher => ({
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    lessonIDs: teacher.lessons.map(index => ids[index])
  }));
  await db.collection("teacher").insertMany(teacherDocs);

  console.log("Seeded database " + process.env.MONGODB_DB + ".");
  console.log("Inserted " + lessons.length + " lessons and " + teacherDocs.length + " teachers.");
  await client.close();
}

seed();
