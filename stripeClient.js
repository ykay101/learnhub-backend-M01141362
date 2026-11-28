require("dotenv").config({ path: "./config.env" });
const Stripe = require("stripe");

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

function paymentsEnabled() {
  return stripe != null && Boolean(process.env.STRIPE_PUBLISHABLE_KEY);
}

module.exports = { stripe, paymentsEnabled };
