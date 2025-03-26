// app.js - Express app configuration
const express = require("express");
const logger = require("./lib/logger");
const uiRoutes = require("./routes/ui");
const statusRoutes = require("./routes/status");
const { addCleanupRoute } = require("./utils/sessionCleanup");

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});

// Configure routes
app.use("/", uiRoutes.router);
app.use("/api", statusRoutes);

// Add session cleanup route
addCleanupRoute(app);

// Error handler
app.use((err, req, res, next) => {
  logger.error("Express error:", err);
  res.status(500).send("Internal Server Error");
});

// Export the UI routes setter for index.js to use
const setMissingEnvVars = uiRoutes.setMissingEnvVars;

module.exports = {
  app,
  setMissingEnvVars,
};
