const Stripe = require("stripe");
const { env } = require("../config/env");

const stripe = env.stripe.secretKey ? new Stripe(env.stripe.secretKey) : null;

module.exports = { stripe };
