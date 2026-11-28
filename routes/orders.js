var express = require("express");
const db = require("../db");
const stripe = require("../stripeClient");
const { verifyPayment, PaymentError } = require("../payments");

var router = express.Router();

router.post("/orders", async function (request, response) {
  let order = request.body;
  let collection = db.collection("order");

  if (order.paymentId) {
    if (!stripe) {
      return response.status(503).send({ error: "Payments are not set up" });
    }
    try {
      let payment = await verifyPayment(db, stripe, order);
      let paidOrder = {
        name: order.name,
        phone: order.phone,
        lessonIDs: order.lessonIDs,
        spaces: order.spaces,
        paymentId: order.paymentId,
        amount: payment.amount,
        cardLast4: payment.cardLast4,
        status: "paid",
        createdAt: new Date()
      };
      let result = await collection.insertOne(paidOrder);
      return response.send({ ...result, amount: payment.amount, cardLast4: payment.cardLast4 });
    } catch (error) {
      if (error instanceof PaymentError) {
        return response.status(error.status).send({ error: error.message });
      }
      console.log("  Payment check error: " + error.message);
      return response.status(502).send({ error: "We couldn't check the payment right now" });
    }
  }

  let result = await collection.insertOne({ ...order, status: "unpaid", createdAt: new Date() });
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
