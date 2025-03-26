// config/db.js - MongoDB connection configuration
const mongoose = require('mongoose');
const logger = require('../lib/logger');

// MongoDB connection options
const mongooseOptions = {
  serverSelectionTimeoutMS: 15000, // Timeout after 15 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
};

// Connect to MongoDB
async function connectToDatabase() {
  try {
    // Get MongoDB URL
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) {
      throw new Error('MONGO_URL environment variable is not set');
    }
    
    // Log a safe version of the MongoDB URL for debugging
    const redactedUrl = mongoUrl.replace(/:([^@/]+)@/, ':****@');
    logger.info('Connecting to MongoDB:', redactedUrl);
    
    // Register connection event handlers
    registerMongoEventHandlers();
    
    // Connect to MongoDB
    await mongoose.connect(mongoUrl, mongooseOptions);
    logger.info('Successfully connected to MongoDB');
    
    return mongoose.connection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

// Register event handlers for MongoDB connection
function registerMongoEventHandlers() {
  mongoose.connection.on('connecting', () => {
    logger.info('Connecting to MongoDB...');
  });

  mongoose.connection.on('connected', () => {
    logger.info('Connected to MongoDB');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('Disconnected from MongoDB');
    // Try to reconnect after a delay
    setTimeout(async () => {
      try {
        if (mongoose.connection.readyState !== 1) {
          logger.info('Attempting to reconnect to MongoDB...');
          await mongoose.connect(process.env.MONGO_URL, mongooseOptions);
        }
      } catch (err) {
        logger.error('MongoDB reconnection attempt failed:', err);
      }
    }, 5000);
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('Reconnected to MongoDB');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });
}

// Close the MongoDB connection
async function closeDatabase() {
  try {
    if (mongoose.connection.readyState !== 0) {
      logger.info('Closing MongoDB connection');
      await mongoose.connection.close();
      logger.info('MongoDB connection closed successfully');
    }
  } catch (err) {
    logger.error('Error closing MongoDB connection:', err);
    throw err;
  }
}

module.exports = {
  connectToDatabase,
  closeDatabase,
  getConnection: () => mongoose.connection
};