const { Client, RemoteAuth } = require("whatsapp-web.js");
const { MongoStore } = require("wwebjs-mongo");
const mongoose = require("mongoose");
const qrcode = require("qrcode");
const express = require("express");
const axios = require("axios");
require("dotenv").config();

// Add this near the top of your file
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, saving session before shutdown");
  // Wait a moment to allow session to save
  await new Promise((resolve) => setTimeout(resolve, 3000));
  process.exit(0);
});

// Create Express app for QR code display
const app = express();
const port = process.env.PORT || 8080;

// Store the latest QR code
let latestQR = null;
let qrTimestamp = null;

// Check for required environment variables
let missingEnvVars = [];
if (!process.env.MONGO_URL) missingEnvVars.push("MONGO_URL");

// Set up simple web server for QR code display
app.get("/", (req, res) => {
  // If there are missing environment variables, show error
  if (missingEnvVars.length > 0) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configuration Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .container {
            text-align: center;
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            max-width: 600px;
          }
          .error {
            color: red;
            background-color: #ffeeee;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
          }
          code {
            background-color: #f0f0f0;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Configuration Error</h1>
          <div class="error">
            <p>The following environment variables are missing:</p>
            <ul style="text-align: left;">
              ${missingEnvVars.map((v) => `<li><code>${v}</code></li>`).join("")}
            </ul>
          </div>
          <h2>How to Fix This</h2>
          <p>Make sure to set the required environment variables in your Railway project:</p>
          <ol style="text-align: left;">
            <li>Go to your Railway dashboard</li>
            <li>Select your project</li>
            <li>Click on the "Variables" tab</li>
            <li>Add or update the missing environment variables</li>
            <li>Redeploy your application</li>
          </ol>
          <p>For MongoDB, make sure you're using the connection string from Railway's MongoDB service.</p>
        </div>
      </body>
      </html>
    `);
  }

  // Regular QR code display logic
  if (latestQR) {
    const minutesAgo = qrTimestamp ? Math.floor((Date.now() - qrTimestamp) / 60000) : 0;
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhatsApp QR Code</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .container {
            text-align: center;
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          img {
            max-width: 300px;
            margin: 20px 0;
          }
          .timestamp {
            color: #666;
            font-size: 0.8rem;
            margin-top: 10px;
          }
          .warning {
            color: ${minutesAgo > 2 ? "red" : "#666"};
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>WhatsApp QR Code</h1>
          <p>Scan this QR code with WhatsApp to authenticate your bot</p>
          <img src="${latestQR}" alt="WhatsApp QR Code">
          <p class="timestamp">Generated ${minutesAgo} minutes ago</p>
          ${minutesAgo > 2 ? '<p class="warning">Warning: This QR code may have expired. Refresh the page to check for a new one.</p>' : ""}
          <p><button onclick="window.location.reload()">Refresh</button></p>
        </div>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Waiting for QR Code</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .container {
            text-align: center;
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .loader {
            border: 8px solid #f3f3f3;
            border-radius: 50%;
            border-top: 8px solid #3498db;
            width: 60px;
            height: 60px;
            margin: 20px auto;
            animation: spin 2s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        <script>
          // Auto refresh every 5 seconds
          setTimeout(() => window.location.reload(), 5000);
        </script>
      </head>
      <body>
        <div class="container">
          <h1>Waiting for QR Code</h1>
          <p>The QR code has not been generated yet. Please wait...</p>
          <div class="loader"></div>
          <p>This page will automatically refresh</p>
        </div>
      </body>
      </html>
    `);
  }
});

app.get("/cleanup-session", async (req, res) => {
  try {
    console.log("Cleaning up session data...");

    // First destroy the client if it exists
    if (client) {
      try {
        console.log("Destroying client before cleanup...");
        await client.destroy();
        client = null;
        console.log("Client destroyed");
      } catch (err) {
        console.error("Error destroying client:", err);
      }
    }

    // Reset QR code
    latestQR = null;
    qrTimestamp = null;

    // Drop the collections if they exist
    if (mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.db.collection("whatsapp-sessions").drop();
        console.log("Dropped whatsapp-sessions collection");
      } catch (err) {
        console.log("No whatsapp-sessions collection to drop");
      }

      try {
        await mongoose.connection.db.collection("whatsapp-RemoteAuth-whatsapp-support-bot.files").drop();
        console.log("Dropped RemoteAuth files collection");
      } catch (err) {
        console.log("No RemoteAuth files collection to drop");
      }

      try {
        await mongoose.connection.db.collection("whatsapp-RemoteAuth-whatsapp-support-bot.chunks").drop();
        console.log("Dropped RemoteAuth chunks collection");
      } catch (err) {
        console.log("No RemoteAuth chunks collection to drop");
      }
    }

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Restart the client
    console.log("Restarting client after cleanup...");
    await initWhatsAppClient();

    res.send('Session data cleaned. <a href="/">Go back</a> and refresh to get a new QR code.');
  } catch (error) {
    console.error("Error cleaning up session:", error);
    res.status(500).send("Error cleaning up session: " + error.message);
  }
});

app.get("/debug", (req, res) => {
  try {
    const clientStatus = {
      exists: client !== null,
      initialized: client ? typeof client.initialize === "function" : false,
      authenticated: client && client.authStrategy ? client.authStrategy.isAuthenticated() : false,
      qrCode: latestQR ? "Available" : "Not available",
      qrTimestamp: qrTimestamp ? new Date(qrTimestamp).toISOString() : "Never",
    };

    res.json({
      client: clientStatus,
      mongoConnected: mongoose.connection.readyState === 1,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
});

app.get("/restart-client", async (req, res) => {
  try {
    const result = await restartClient();
    res.send(result ? "Client restarted successfully" : "Failed to restart client");
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

// User state to track conversation flow
const userState = {};

// Start the web server
app.listen(port, () => {
  console.log(`QR code server running at http://localhost:${port}`);
  console.log(`When deployed on Railway, the URL will be available in your project dashboard`);

  // Log environment variables status
  if (missingEnvVars.length > 0) {
    console.error("ERROR: Missing required environment variables:", missingEnvVars.join(", "));
    console.error("The application will not fully function until these are provided.");
    console.error("Please check the web interface for more information.");
  } else {
    // Only start WhatsApp client if all required environment variables are present
    initWhatsAppClient();
  }
});

// Function to initialize WhatsApp client
async function initWhatsAppClient() {
  try {
    // Get MongoDB URL
    const mongoUrl = process.env.MONGO_URL;

    // Log a safe version of the MongoDB URL for debugging
    const redactedUrl = mongoUrl ? mongoUrl.replace(/:([^@/]+)@/, ":****@") : "undefined";
    console.log("Using MongoDB URL:", redactedUrl);

    // Additional mongoose connection options
    const mongooseOptions = {
      serverSelectionTimeoutMS: 15000, // Timeout after 15 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    // Connect to MongoDB and wait for connection to be established
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUrl, mongooseOptions);
    console.log("Successfully connected to MongoDB");

    // Initialize MongoStore with session name
    const store = new MongoStore({
      mongoose: mongoose,
      collection: "whatsapp-sessions", // Explicitly set collection name
      session: "whatsapp-support-bot", // Consistent session name
    });

    console.log("Initializing WhatsApp client...");

    // Initialize WhatsApp client optimized for Railway environment
    client = new Client({
      authStrategy: new RemoteAuth({
        store: store,
        backupSyncIntervalMs: 300000,
        clientId: "whatsapp-support-bot",
      }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ],
        // Add timeout to avoid hanging
        timeout: 60000,
      },
      // Add these options
      webVersion: "2.2329.9", // Specify a known working version
      webVersionCache: {
        type: "none", // Disable web version caching to prevent issues
      },
      // Improved message handling
      qrMaxRetries: 3,
      takeoverOnConflict: false, // Disable takeover to prevent multi-device issues
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    // QR Code Handler - Generate QR code and make it available on the web server
    client.on("qr", async (qr) => {
      console.log("New QR code received at:", new Date().toISOString());

      // Update timestamp
      qrTimestamp = Date.now();

      // Generate QR code as data URL
      try {
        latestQR = await qrcode.toDataURL(qr);
        console.log("QR code generated and available at http://localhost:" + port);
      } catch (err) {
        console.error("Error generating QR code:", err);
      }
    });

    // Authentication Success Handler - Remove QR code when authenticated
    client.on("authenticated", () => {
      console.log("Authenticated successfully!");
      latestQR = null; // Clear QR code since it's no longer needed
    });

    // Authentication Failed Handler
    client.on("auth_failure", (error) => {
      console.error("Authentication failed:", error);
    });

    // Disconnected Handler
    client.on("disconnected", (reason) => {
      console.log("Client disconnected:", reason);
      // Clear QR code when disconnected, so a new one can be generated
      latestQR = null;
    });

    // Ready Handler
    client.on("ready", () => {
      console.log("WhatsApp client ready!");

      // Test if messaging works
      setTimeout(async () => {
        try {
          const chats = await client.getChats();
          console.log(`Number of chats available: ${chats.length}`);

          // Log info about WhatsApp connection
          console.log(`WhatsApp connection info: ${client.info ? "Available" : "Not available"}`);
          if (client.info) {
            console.log(`Connected as: ${client.info.wid.user}`);
          }
        } catch (error) {
          console.error("Error checking client status:", error);
        }
      }, 5000);
    });

    // Handle incoming messages
    client.on("message", async (message) => {
      try {
        const user = message.from;
        console.log(`Received message from ${user}: "${message.body}"`);

        // Test if this basic message sending works
        if (message.body.toLowerCase() === "test") {
          console.log("Sending test response...");
          await client.sendMessage(user, "Test response received");
          console.log("Test response sent successfully");
          return;
        }

        // Initialize user state if it doesn't exist
        if (!userState[user] && ["hi", "hello"].includes(message.body.toLowerCase())) {
          userState[user] = { step: "initial" };
        }

        // Greet user and present issue options
        if (["hi", "hello"].includes(message.body.toLowerCase())) {
          const menu =
            "Welcome to IT Support!\nPlease select your issue type by replying with the corresponding number:\n1. 🖥️ Hardware Issue\n2. 🌐 Network Issue\n3. 🛠️ Software Issue";
          await client.sendMessage(user, menu);
          userState[user] = { step: "select_issue" };
        }
        // Add the rest of your message handling logic here
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });

    // Handle uncaught exceptions to prevent app crash
    process.on("uncaughtException", (error) => {
      console.error("Uncaught exception:", error);
      // Don't crash the server
    });

    console.log("Initializing WhatsApp client...");
    // Initialize the client
    await client.initialize();
    console.log("Initialization process completed");
    return client;
  } catch (error) {
    console.error("Fatal error encountered:", error);
    // Don't exit the process, keep the web server running
    console.error("WhatsApp client initialization failed, but web server is still running.");
    return null;
  }
}

async function restartClient() {
  try {
    console.log("Attempting to restart WhatsApp client...");

    // If there's an existing client, try to close it properly
    if (client && typeof client.destroy === "function") {
      console.log("Destroying existing client...");
      await client.destroy();
      console.log("Existing client destroyed");
    } else {
      console.log("No valid client to destroy");
    }

    // Wait a moment before restarting
    console.log("Waiting 5 seconds before restart...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Re-initialize
    console.log("Starting new initialization...");
    await initWhatsAppClient();
    console.log("Client re-initialized");

    return true;
  } catch (error) {
    console.error("Error restarting client:", error);
    return false;
  }
}
