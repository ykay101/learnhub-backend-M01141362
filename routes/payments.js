var express = require("express");
const db = require("../db");
const stripe = require("../stripeClient");
const { createIntent, PaymentError } = require("../payments");

var router = express.Router();

router.get("/payments/config", function (request, response) {
  if (!stripe || !process.env.STRIPE_PUBLISHABLE_KEY) {
    return response.send({ enabled: false });
  }
  response.send({ enabled: true, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

router.use("/payments", function (request, response, next) {
  if (!stripe || !process.env.STRIPE_PUBLISHABLE_KEY) {
    return response.status(503).send({ error: "Payments are not set up" });
  }
  next();
});

router.post("/payments/intent", async function (request, response) {
  try {
    let result = await createIntent(db, stripe, request.body.lessonIDs, request.body.spaces);
    response.send(result);
  } catch (error) {
    if (error instanceof PaymentError) {
      return response.status(error.status).send({ error: error.message });
    }
    console.log("  Payment error: " + error.message);
    response.status(502).send({ error: "The payment service is not available right now" });
  }
});

module.exports = router;
