// utils/shutdown.js - Graceful shutdown handling
const mongoose = require('mongoose');
const logger = require('../lib/logger');
const sessionManager = require('../lib/sessionManager');
const { stopHealthCheck } = require('../lib/healthCheck');

// Set up graceful shutdown handlers
function setupGracefulShutdown() {
  // Handle termination signals
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received, starting graceful shutdown');
    gracefulShutdown();
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received, starting graceful shutdown');
    gracefulShutdown();
  });
  
  // Handle uncaught exceptions and unhandled promise rejections
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    gracefulShutdown(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection:', reason);
    // Don't shutdown for unhandled rejections, just log them
  });
  
  logger.info('Graceful shutdown handlers registered');
}

// Perform graceful shutdown
async function gracefulShutdown(exitCode = 0) {
  try {
    logger.info('Starting shutdown process');
    
    // Stop health checks
    stopHealthCheck();
    
    // Save WhatsApp session
    await saveWhatsAppSession();
    
    // Close WhatsApp client
    await closeWhatsAppClient();
    
    // Close database connection
    await closeMongoDBConnection();
    
    logger.info('Graceful shutdown completed');
    process.exit(exitCode);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Save WhatsApp session before shutdown
async function saveWhatsAppSession() {
  try {
    // Log current session state
    const sessionState = sessionManager.getSessionState();
    logger.info('Current session state:', sessionState);
    
    // Force a session save if client is available
    const client = global.whatsappClient;
    if (client && client.authStrategy) {
      logger.info('Attempting to save WhatsApp session before exit');
      try {
        // Trigger a session save
        await sessionManager.forceSaveSession();
        
        // Give some time for the save to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        logger.error('Error saving session:', err);
      }
    } else {
      logger.warn('WhatsApp client not available for session save');
    }
  } catch (error) {
    logger.error('Error saving WhatsApp session:', error);
  }
}

// Close WhatsApp client
async function closeWhatsAppClient() {
  try {
    const client = global.whatsappClient;
    if (client) {
      logger.info('Closing WhatsApp client');
      try {
        await client.destroy();
        logger.info('WhatsApp client closed successfully');
      } catch (err) {
        logger.error('Error closing WhatsApp client:', err);
      }
    }
  } catch (error) {
    logger.error('Error closing WhatsApp client:', error);
  }
}

// Close MongoDB connection
async function closeMongoDBConnection() {
  try {
    if (mongoose.connection.readyState !== 0) {
      logger.info('Closing MongoDB connection');
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed successfully');
      } catch (err) {
        logger.error('Error closing MongoDB connection:', err);
      }
    }
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
  }
}

module.exports = {
  setupGracefulShutdown,
  gracefulShutdown
};