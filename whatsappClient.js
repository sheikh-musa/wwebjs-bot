// whatsappClient.js - WhatsApp client initialization and event handling
const { Client, RemoteAuth } = require("whatsapp-web.js");
// const { MongoStore } = require('wwebjs-mongo');
const EnhancedMongoStore = require("./lib/customMongoStore");
const mongoose = require("mongoose");
const qrHandler = require("./handlers/qrHandler");
const messageHandler = require("./handlers/messageHandler");
const logger = require("./lib/logger");
const { startHealthCheck } = require("./lib/healthCheck");
const { getPuppeteerOptions } = require("./config/puppeteer");
const sessionManager = require("./lib/sessionManager");

const fs = require("fs");
const path = require("path");

// Add this function to create necessary directories
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    logger.info(`Creating directory: ${directory}`);
    fs.mkdirSync(directory, { recursive: true });
  }
}

// Global client reference
let whatsappClient = null;

logger.info("Setting up puppeteer launch args");
const puppeteerArgs = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--single-process",
  "--disable-gpu",
  "--disable-extensions",
  "--js-flags=--expose-gc",
  "--ignore-certificate-errors",
];
logger.info("Puppeteer args:", puppeteerArgs.join(", "));

// Initialize WhatsApp client
async function initWhatsAppClient() {
  logger.info("About to initialize WhatsApp client with puppeteer...");

  try {
    logger.info("Calling client.initialize()");
    await whatsappClient.initialize();
    logger.info("WhatsApp client initialization completed successfully");
    // Make sure MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      logger.error("MongoDB not connected. Cannot initialize WhatsApp client.");
      return;
    }

    // Create session directory
    const sessionDir = path.resolve("./whatsapp-session");
    ensureDirectoryExists(sessionDir);
    logger.info(`Session directory: ${sessionDir}`);

    // Verify MongoDB collections
    await verifyMongoConnection();

    // Initialize enhanced MongoStore with session name and explicit collection
    const store = new EnhancedMongoStore({
      mongoose: mongoose,
      collection: "whatsapp-sessions", // Explicitly define collection name
      session: "whatsapp-support-bot", // Consistent session name
    });

    // Extend store with logging
    sessionManager.enhanceStore(store);

    // Create RemoteAuth strategy with enhanced configuration
    const authStrategy = new RemoteAuth({
      store: store,
      clientId: "whatsapp-support-bot", // Consistent client ID
      backupSyncIntervalMs: 300000, // Sync session every 5 minutes (5 * 60 * 1000)
      dataPath: sessionDir,
      // CRITICAL: Set tempPath to our valid directory
      tempPath: sessionDir,
      // Don't throw error if session ZIP isn't found
      throwOnError: false,
      puppeteerOptions: {
        timeout: 120000, // Increase timeout for high-latency environments (2 minutes)
      },
      retryRequestDelayMs: 5000, // Retry delay for failed requests
      saveCreds: () => {
        logger.info("Credentials saved to store", new Date().toISOString());
        sessionManager.recordEvent("creds_saved");
      },
      connectFailure: (error) => {
        logger.error("Connection failure:", error);
        sessionManager.recordEvent("connect_failure", { error: error.toString() });
      },
    });

    // Initialize WhatsApp client with error handling
    whatsappClient = new Client({
      authStrategy: authStrategy,
      puppeteer: getPuppeteerOptions(),
      webVersionCache: {
        type: "local", // Changed to local for Railway environment
        path: path.join(sessionDir, "webCache"),
      },
      restartOnAuthFail: true,
      takeoverOnConflict: false, // Changed to false to prevent conflicts
      takeoverTimeoutMs: 0, // Disable takeover
      userAgent:
        "WhatsApp/2.2329.9 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
      logger: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        stream: {
          write: (message) => {
            if (message.includes("ERR!") || message.includes("error")) {
              logger.error(`WHATSAPP: ${message.trim()}`);
            } else if (message.includes("session") || message.includes("auth")) {
              logger.info(`WHATSAPP_AUTH: ${message.trim()}`);
            } else {
              logger.debug(`WHATSAPP: ${message.trim()}`);
            }
          },
        },
      },
    });

    // Register event handlers
    registerEventHandlers(whatsappClient);

    logger.info("Initializing WhatsApp client...");
    // Initialize the client
    await whatsappClient.initialize();
    logger.info("WhatsApp client initialization completed");

    // Set global reference
    global.whatsappClient = whatsappClient;

    return whatsappClient;
  } catch (error) {
    logger.error("Fatal error encountered during WhatsApp client initialization:", error);
    // Don't exit the process, keep the web server running
    logger.error("WhatsApp client initialization failed, but web server is still running.");
    logger.error("Check the configuration and restart the application.");
    return null;
  }
}

// MongoDB verification function
async function verifyMongoConnection() {
  try {
    logger.info("Verifying MongoDB collections...");
    const collections = await mongoose.connection.db.listCollections().toArray();
    logger.info(`Available collections: ${collections.map((c) => c.name).join(", ")}`);

    // Check if our collection exists, if not create it
    const collectionExists = collections.some((c) => c.name === "whatsapp-sessions");
    if (!collectionExists) {
      logger.info("Creating whatsapp-sessions collection");
      await mongoose.connection.db.createCollection("whatsapp-sessions");
      logger.info("Collection created successfully");
    }

    // Verify the collection is accessible
    const sessionsColl = mongoose.connection.db.collection("whatsapp-sessions");
    logger.info("Session collection accessible:", !!sessionsColl);

    return true;
  } catch (error) {
    logger.error("Error verifying MongoDB:", error);
    return false;
  }
}

// Register all event handlers for the WhatsApp client
function registerEventHandlers(client) {
  // QR Code Handler - Generate QR code and make it available on the web server
  client.on("qr", qrHandler.handleQR);

  // Authentication Success Handler
  client.on("authenticated", (session) => {
    logger.info("Authenticated successfully!");
    logger.info("Authentication time:", new Date().toISOString());
    if (session) {
      logger.info("Session ID:", session.WABrowserId?.substring(0, 8) + "...");
      logger.info("Session expires:", new Date(session.WAToken1).toISOString());
    }
    global.latestQR = null; // Clear QR code since it's no longer needed
    sessionManager.recordEvent("authenticated", { hasSessionData: !!session });
  });

  // RemoteAuth session saved event
  client.on("remote_session_saved", () => {
    logger.info("Session saved remotely at", new Date().toISOString());
    sessionManager.recordEvent("remote_session_saved");
  });

  // Authentication Failed Handler
  client.on("auth_failure", (error) => {
    logger.error("Authentication failed at", new Date().toISOString(), ":", error);
    logger.error("Error details:", JSON.stringify(error));
    sessionManager.recordEvent("auth_failure", { error: error.toString() });
  });

  // Loading Screen Handler
  client.on("loading_screen", (percent, message) => {
    logger.info(`WhatsApp loading: ${percent}% - ${message}`);
  });

  // Disconnected Handler
  client.on("disconnected", (reason) => {
    logger.warn("Client disconnected at", new Date().toISOString());
    logger.warn("Disconnection reason:", reason);
    sessionManager.recordEvent("disconnected", { reason });
    global.latestQR = null; // Clear QR code when disconnected, so a new one can be generated
  });

  // Ready Handler
  client.on("ready", () => {
    logger.info("WhatsApp client ready!");
    // Start health checks after client is ready
    startHealthCheck();
    // Reset QR code
    global.latestQR = null;
    sessionManager.recordEvent("client_ready");
  });

  // Message Handler
  client.on("message", messageHandler.handleMessage);
}

// Export the client and initialization function
module.exports = {
  initWhatsAppClient,
  getClient: () => whatsappClient,
};
