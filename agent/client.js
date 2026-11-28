require("dotenv").config({ path: "./config.env", quiet: true });
const OpenAI = require("openai");

let client = null;
if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

module.exports = { client, model };
