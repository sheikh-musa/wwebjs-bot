// lib/healthCheck.js - System health monitoring
const mongoose = require('mongoose');
const logger = require('./logger');
const sessionManager = require('./sessionManager');

// Health check interval reference
let healthCheckInterval = null;

// Start periodic health checks
function startHealthCheck(intervalMinutes = 10) {
  // Clear any existing interval
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  // Start a new health check interval
  const intervalMs = intervalMinutes * 60 * 1000;
  healthCheckInterval = setInterval(performHealthCheck, intervalMs);
  
  logger.info(`Health check scheduled to run every ${intervalMinutes} minutes`);
  
  // Run initial health check
  performHealthCheck();
  
  return healthCheckInterval;
}

// Stop health checks
function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.info('Health checks stopped');
  }
}

// Perform a health check
async function performHealthCheck() {
  try {
    logger.info('Running periodic health check at', new Date().toISOString());
    
    // Check MongoDB connection
    await checkMongoConnection();
    
    // Check WhatsApp client state
    await checkWhatsAppClient();
    
    // Log memory usage
    logMemoryUsage();
    
    logger.info('Health check completed successfully');
  } catch (error) {
    logger.error('Error during health check:', error);
  }
}

// Check MongoDB connection status
async function checkMongoConnection() {
  const mongoStatus = mongoose.connection.readyState;
  const statusText = 
    mongoStatus === 0 ? 'disconnected' :
    mongoStatus === 1 ? 'connected' :
    mongoStatus === 2 ? 'connecting' :
    mongoStatus === 3 ? 'disconnecting' : 'unknown';
  
  logger.info('MongoDB connection status:', statusText);
  
  if (mongoStatus !== 1) {
    logger.warn('MongoDB is not connected! Attempting to reconnect...');
    try {
      await mongoose.connect(process.env.MONGO_URL);
      logger.info('MongoDB reconnection successful');
    } catch (mongoErr) {
      logger.error('MongoDB reconnection failed:', mongoErr);
    }
  }
  
  return mongoStatus === 1;
}

// Check WhatsApp client state
async function checkWhatsAppClient() {
  const client = global.whatsappClient;
  
  if (!client) {
    logger.error('WhatsApp client is not available!');
    return false;
  }
  
  // Check if client is authenticated
  const isAuthenticated = client.authStrategy?.isAuthenticated() || false;
  logger.info('WhatsApp authentication status:', isAuthenticated ? 'authenticated' : 'not authenticated');
  
  // Check if client is initialized
  const isInitialized = !!client.info;
  logger.info('WhatsApp client initialized:', isInitialized ? 'yes' : 'no');
  
  // Force session save if authenticated
  if (isAuthenticated) {
    try {
      logger.info('Triggering manual session save...');
      await sessionManager.forceSaveSession();
    } catch (saveErr) {
      logger.error('Error during manual session save:', saveErr);
    }
  }
  
  // If client should be authenticated but puppeteer browser is disconnected,
  // attempt to recover the session
  if (isAuthenticated && !client.pupBrowser?.isConnected()) {
    logger.warn('Browser disconnected but session is authenticated. Attempting recovery...');
    try {
      // Try to re-initialize the client
      await client.initialize();
      logger.info('Client re-initialization successful');
    } catch (initErr) {
      logger.error('Client re-initialization failed:', initErr);
    }
  }
  
  // Log session state info
  const sessionState = sessionManager.getSessionState();
  logger.info('Session state:', sessionState);
  
  return isAuthenticated && isInitialized;
}

// Log memory usage statistics
function logMemoryUsage() {
  const memUsage = process.memoryUsage();
  logger.info('Memory usage:', {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
  });
}

module.exports = {
  startHealthCheck,
  stopHealthCheck,
  performHealthCheck
}