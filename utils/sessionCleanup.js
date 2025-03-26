// utils/sessionCleanup.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const logger = require("../lib/logger");

/**
 * Utility to clean up WhatsApp sessions
 */
async function cleanupSessions() {
  try {
    logger.info("Starting session cleanup");

    // 1. Clean up file system
    const sessionDir = path.resolve("./whatsapp-session");
    cleanFileSystem(sessionDir);

    // 2. Clean up database
    await cleanDatabase();

    logger.info("Session cleanup completed successfully");
    return true;
  } catch (error) {
    logger.error("Error during session cleanup:", error);
    return false;
  }
}

/**
 * Clean up file system session files
 */
function cleanFileSystem(sessionDir) {
  try {
    // Check if directory exists
    if (!fs.existsSync(sessionDir)) {
      logger.info(`Session directory doesn't exist: ${sessionDir}`);
      fs.mkdirSync(sessionDir, { recursive: true });
      logger.info(`Created session directory: ${sessionDir}`);
      return;
    }

    // List files in directory
    const files = fs.readdirSync(sessionDir);
    logger.info(`Found ${files.length} files in session directory`);

    // Delete session-related files
    for (const file of files) {
      if (file.includes("RemoteAuth") || file.includes(".zip") || file.includes("session")) {
        const filePath = path.join(sessionDir, file);
        fs.unlinkSync(filePath);
        logger.info(`Deleted file: ${file}`);
      }
    }

    logger.info("File system cleanup completed");
  } catch (error) {
    logger.error("Error cleaning file system:", error);
  }
}

/**
 * Clean up database session collections
 */
async function cleanDatabase() {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      logger.warn("MongoDB not connected. Cannot clean database");
      return;
    }

    // Drop the session collection
    try {
      await mongoose.connection.db.collection("whatsapp-sessions").drop();
      logger.info("Dropped whatsapp-sessions collection");
    } catch (error) {
      if (error.code === 26) {
        logger.info("whatsapp-sessions collection does not exist");
      } else {
        throw error;
      }
    }

    // Clean up GridFS collections if they exist
    try {
      await mongoose.connection.db.collection("whatsapp-RemoteAuth-whatsapp-support-bot.files").drop();
      logger.info("Dropped RemoteAuth files collection");
    } catch (error) {
      if (error.code === 26) {
        logger.info("RemoteAuth files collection does not exist");
      } else {
        throw error;
      }
    }

    try {
      await mongoose.connection.db.collection("whatsapp-RemoteAuth-whatsapp-support-bot.chunks").drop();
      logger.info("Dropped RemoteAuth chunks collection");
    } catch (error) {
      if (error.code === 26) {
        logger.info("RemoteAuth chunks collection does not exist");
      } else {
        throw error;
      }
    }

    // Create fresh session collection
    await mongoose.connection.db.createCollection("whatsapp-sessions");
    logger.info("Created new whatsapp-sessions collection");

    logger.info("Database cleanup completed");
  } catch (error) {
    logger.error("Error cleaning database:", error);
    throw error;
  }
}

// Add a route to trigger cleanup
function addCleanupRoute(app) {
  app.post("/api/cleanup-sessions", async (req, res) => {
    // Simple security check - this should be improved with proper auth
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    try {
      const result = await cleanupSessions();
      res.json({
        status: result ? "success" : "error",
        message: result ? "Sessions cleaned up successfully" : "Error cleaning up sessions",
        time: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error in cleanup endpoint:", error);
      res.status(500).json({
        status: "error",
        message: "Error processing cleanup request",
        time: new Date().toISOString(),
      });
    }
  });

  logger.info("Session cleanup route added: POST /api/cleanup-sessions");
}

module.exports = {
  cleanupSessions,
  addCleanupRoute,
};
