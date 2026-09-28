/**
 * Vercel Serverless Function Entry Point
 * Routes all /api/* requests to the Express application with auto-seeded DB.
 */
const { app, initializeDatabase } = require("../backend/app");

let globalServerlessPromise = null;

module.exports = async (req, res) => {
  try {
    if (!globalServerlessPromise) {
      globalServerlessPromise = initializeDatabase();
    }
    await globalServerlessPromise;
    return app(req, res);
  } catch (err) {
    globalServerlessPromise = null; // Reset so next invocation retries cleanly
    console.error("[Vercel Serverless Function Error]", err);
    return res.status(500).json({
      error: "Serverless initialization failed",
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  }
};
