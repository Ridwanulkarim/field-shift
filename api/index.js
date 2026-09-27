/**
 * Vercel Serverless Function Entry Point
 * Routes all /api/* requests to the Express application with auto-seeded DB.
 */
const { app, initializeDatabase } = require("../backend/app");

module.exports = async (req, res) => {
  try {
    await initializeDatabase();
    return app(req, res);
  } catch (err) {
    console.error("[Vercel Serverless Function Error]", err);
    return res.status(500).json({
      error: "Serverless initialization failed",
      message: err.message
    });
  }
};
