require("dotenv").config({ path: "./config.env" });
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_PREFIX +
  process.env.MONGODB_USERNAME + ":" +
  process.env.MONGODB_PASSWORD +
  process.env.MONGODB_URL;
const client = new MongoClient(uri);
const db = client.db(process.env.MONGODB_DB || "2learn");

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    await db.collection("order").createIndex(
      { paymentId: 1 },
      { unique: true, partialFilterExpression: { paymentId: { $type: "string" } } }
    );
    await db.collection("user").createIndex({ email: 1 }, { unique: true });
    await db.collection("session").createIndex({ token: 1 }, { unique: true });
    await db.collection("session").createIndex({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
    await db.collection("agent_usage").createIndex({ date: 1 }, { unique: true });
  } catch (err) {
    console.dir(err);
  }
}
connectToMongoDB();

module.exports = db;
