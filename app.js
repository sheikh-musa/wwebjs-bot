// app.js - Express app configuration
const express = require('express');
const logger = require('./lib/logger');
const uiRoutes = require('./routes/ui');
const statusRoutes = require('./routes/status');

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
app.use('/', uiRoutes);
app.use('/api', statusRoutes);

// Error handler
app.use((err, req, res, next) => {
  logger.error('Express error:', err);
  res.status(500).send('Internal Server Error');
});

module.exports = app;