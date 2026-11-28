const test = require("node:test");
const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const { priceOrder, createIntent, verifyPayment, PaymentError } = require("../payments");

const art = { _id: new ObjectId(), topic: "Art", price: 70, space: 5 };
const coding = { _id: new ObjectId(), topic: "Coding", price: 120, space: 5 };

function fakeDb(lessons, orders = []) {
  function matches(doc, query) {
    if (query._id && query._id.$in) return query._id.$in.some(id => id.equals(doc._id));
    if (query.paymentId) return doc.paymentId == query.paymentId;
    return true;
  }
  let data = { lesson: lessons, order: orders };
  return {
    collection(name) {
      return {
        find: query => ({ toArray: async () => data[name].filter(doc => matches(doc, query)) }),
        findOne: async query => data[name].find(doc => matches(doc, query)) || null
      };
    }
  };
}

function fakeStripe(intent) {
  let calls = [];
  return {
    calls,
    paymentIntents: {
      create: async params => { calls.push(params); return { id: "pi_1", client_secret: "pi_1_secret" }; },
      retrieve: async () => intent
    }
  };
}

const paidIntent = (amount) => ({
  id: "pi_1",
  status: "succeeded",
  amount: amount,
  latest_charge: { payment_method_details: { card: { last4: "4242" } } }
});

async function rejectsWith(promise, status, text) {
  await assert.rejects(promise, error => {
    assert.ok(error instanceof PaymentError, "PaymentError expected");
    assert.equal(error.status, status);
    if (text) assert.match(error.message, text);
    return true;
  });
}

test("amount comes from the database, not the client", async () => {
  let db = fakeDb([art, coding]);
  let result = await priceOrder(db, [art._id.toString(), coding._id.toString()], [2, 1]);
  assert.equal(result.amount, 26000);
});

test("refuses when not enough spaces", async () => {
  let db = fakeDb([{ ...art, space: 1 }]);
  await rejectsWith(priceOrder(db, [art._id.toString()], [2]), 409, /Only 1 spaces left for Art/);
});

test("rejects bad input", async () => {
  let db = fakeDb([art]);
  let id = art._id.toString();
  await rejectsWith(priceOrder(db, [], []), 400);
  await rejectsWith(priceOrder(db, [id], [1, 2]), 400);
  await rejectsWith(priceOrder(db, ["nope"], [1]), 400);
  await rejectsWith(priceOrder(db, [new ObjectId().toString()], [1]), 400);
  await rejectsWith(priceOrder(db, [id], [0]), 400);
  await rejectsWith(priceOrder(db, [id], [1.5]), 400);
  await rejectsWith(priceOrder(db, "x", [1]), 400);
});

test("createIntent sends pence in gbp", async () => {
  let stripe = fakeStripe();
  let result = await createIntent(fakeDb([art]), stripe, [art._id.toString()], [1]);
  assert.equal(stripe.calls[0].amount, 7000);
  assert.equal(stripe.calls[0].currency, "gbp");
  assert.deepEqual(stripe.calls[0].automatic_payment_methods, { enabled: true });
  assert.deepEqual(result, { clientSecret: "pi_1_secret", amount: 7000 });
});

test("verifyPayment accepts a succeeded intent with the right amount", async () => {
  let order = { lessonIDs: [art._id.toString()], spaces: [1], paymentId: "pi_1" };
  let result = await verifyPayment(fakeDb([art]), fakeStripe(paidIntent(7000)), order);
  assert.deepEqual(result, { amount: 7000, cardLast4: "4242" });
});

test("verifyPayment rejects an unpaid intent", async () => {
  let order = { lessonIDs: [art._id.toString()], spaces: [1], paymentId: "pi_1" };
  let intent = { ...paidIntent(7000), status: "requires_payment_method" };
  await rejectsWith(verifyPayment(fakeDb([art]), fakeStripe(intent), order), 402);
});

test("order total must match the payment", async () => {
  let order = { lessonIDs: [art._id.toString()], spaces: [2], paymentId: "pi_1" };
  await rejectsWith(verifyPayment(fakeDb([art]), fakeStripe(paidIntent(7000)), order), 400);
});

test("a payment id can only be used once", async () => {
  let order = { lessonIDs: [art._id.toString()], spaces: [1], paymentId: "pi_1" };
  let db = fakeDb([art], [{ paymentId: "pi_1" }]);
  await rejectsWith(verifyPayment(db, fakeStripe(paidIntent(7000)), order), 409);
});
