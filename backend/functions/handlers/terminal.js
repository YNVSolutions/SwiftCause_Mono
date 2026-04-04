const {stripe, ensureStripeInitialized} = require("../services/stripe");
const cors = require("../middleware/cors");

/**
 * Create Terminal connection token for Tap to Pay
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const createConnectionToken = (req, res) => {
  cors(req, res, async () => {
    try {
      // Ensure Stripe is initialized
      const stripeClient = ensureStripeInitialized();

      console.log("=== Creating Terminal Connection Token ===");

      // Create connection token
      const connectionToken = await stripeClient.terminal.connectionTokens.create();

      console.log("Connection token created successfully");

      return res.status(200).json({
        secret: connectionToken.secret,
      });
    } catch (error) {
      console.error("=== Connection Token Creation Failed ===");
      console.error("Error:", error.message);
      console.error("Stack:", error.stack);

      return res.status(500).json({
        error: error.message || "Failed to create connection token",
      });
    }
  });
};

module.exports = {
  createConnectionToken,
};
