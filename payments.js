const { ObjectId } = require("mongodb");

class PaymentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function priceOrder(db, lessonIDs, spaces) {
  if (!Array.isArray(lessonIDs) || !Array.isArray(spaces) || lessonIDs.length == 0 || lessonIDs.length != spaces.length) {
    throw new PaymentError(400, "The order must list lessons and spaces");
  }
  if (new Set(lessonIDs).size != lessonIDs.length) {
    throw new PaymentError(400, "Each lesson can only appear once");
  }
  for (let id of lessonIDs) {
    if (typeof id != "string" || !ObjectId.isValid(id)) {
      throw new PaymentError(400, "Unknown lesson");
    }
  }
  for (let count of spaces) {
    if (!Number.isInteger(count) || count < 1) {
      throw new PaymentError(400, "Spaces must be whole numbers above zero");
    }
  }

  let ids = lessonIDs.map(id => new ObjectId(id));
  let lessons = await db.collection("lesson").find({ _id: { $in: ids } }).toArray();

  let amount = 0;
  for (let i = 0; i < lessonIDs.length; i++) {
    let lesson = lessons.find(l => l._id.toString() == lessonIDs[i]);
    if (!lesson) {
      throw new PaymentError(400, "Unknown lesson");
    }
    if (lesson.space < spaces[i]) {
      throw new PaymentError(409, "Only " + lesson.space + " spaces left for " + lesson.topic);
    }
    amount = amount + lesson.price * 100 * spaces[i];
  }

  return { amount: amount, lessons: lessons };
}

async function createIntent(db, stripe, lessonIDs, spaces) {
  let { amount } = await priceOrder(db, lessonIDs, spaces);
  let intent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "gbp",
    automatic_payment_methods: { enabled: true },
    metadata: { lessonIDs: lessonIDs.join(","), spaces: spaces.join(",") }
  });
  return { clientSecret: intent.client_secret, amount: amount };
}

async function verifyPayment(db, stripe, order) {
  let used = await db.collection("order").findOne({ paymentId: order.paymentId });
  if (used) {
    throw new PaymentError(409, "This payment has already been used for an order");
  }

  let intent = await stripe.paymentIntents.retrieve(order.paymentId, { expand: ["latest_charge"] });
  if (intent.status != "succeeded") {
    throw new PaymentError(402, "The payment has not been completed");
  }

  let { amount } = await priceOrder(db, order.lessonIDs, order.spaces);
  if (intent.amount != amount) {
    throw new PaymentError(400, "The payment does not match the order total");
  }

  let card = intent.latest_charge && intent.latest_charge.payment_method_details && intent.latest_charge.payment_method_details.card;
  return { amount: amount, cardLast4: card ? card.last4 : null };
}

module.exports = { priceOrder, createIntent, verifyPayment, PaymentError };
