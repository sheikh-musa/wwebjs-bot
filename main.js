const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

// Create Express app for QR code display
const app = express();
const port = process.env.PORT || 8080;

// Store the latest QR code
let latestQR = null;
let qrTimestamp = null;

// Check for required environment variables
let missingEnvVars = [];
if (!process.env.MONGO_URL) missingEnvVars.push('MONGO_URL');

// Set up simple web server
app.get('/', (req, res) => {
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
              ${missingEnvVars.map(v => `<li><code>${v}</code></li>`).join('')}
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
            color: ${minutesAgo > 2 ? 'red' : '#666'};
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
          ${minutesAgo > 2 ? '<p class="warning">Warning: This QR code may have expired. Refresh the page to check for a new one.</p>' : ''}
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

// User state to track conversation flow
const userState = {};

// Start the web server
app.listen(port, () => {
  console.log(`QR code server running at http://localhost:${port}`);
  console.log(`When deployed on Railway, the URL will be available in your project dashboard`);
  
  // Log environment variables status
  if (missingEnvVars.length > 0) {
    console.error('ERROR: Missing required environment variables:', missingEnvVars.join(', '));
    console.error('The application will not fully function until these are provided.');
    console.error('Please check the web interface for more information.');
  } else {
    // Only start WhatsApp client if all required environment variables are present
    initWhatsAppClient();
  }
});

// IIFE to handle WhatsApp client initialization
async function initWhatsAppClient() {
  try {
    // Get MongoDB URL and log a redacted version for debugging
    const mongoUrl = process.env.MONGO_URL;
    
    // Log a safe version of the MongoDB URL for debugging
    const redactedUrl = mongoUrl ? mongoUrl.replace(/:([^@/]+)@/, ':****@') : 'undefined';
    console.log('Using MongoDB URL:', redactedUrl);
    
    // Additional mongoose connection options
    const mongooseOptions = {
      serverSelectionTimeoutMS: 15000, // Timeout after 15 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };
    
    // Connect to MongoDB and wait for connection to be established
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, mongooseOptions);
    console.log('Successfully connected to MongoDB');
    
    // Initialize MongoStore with session name
    const store = new MongoStore({
      mongoose: mongoose,
      session: 'whatsapp-support-bot' // Consistent session name
    });
    
    console.log('Initializing WhatsApp client...');
    
    // Initialize WhatsApp client optimized for Railway environment
    const client = new Client({
      authStrategy: new RemoteAuth({
        store: store,
        backupSyncIntervalMs: 300000, // Sync session every 5 minutes
        clientId: 'whatsapp-support-bot' // Consistent client ID
      }),
      puppeteer: {
        // Railway-optimized Puppeteer settings
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });
    
    // QR Code Handler - Generate QR code and make it available on the web server
    client.on('qr', async (qr) => {
      console.log('New QR code received');
      
      // Update timestamp
      qrTimestamp = Date.now();
      
      // Generate QR code as data URL
      try {
        latestQR = await qrcode.toDataURL(qr);
        console.log('QR code generated and available at http://localhost:' + port);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    });
    
    // Authentication Success Handler - Remove QR code when authenticated
    client.on('authenticated', () => {
      console.log('Authenticated successfully!');
      latestQR = null; // Clear QR code since it's no longer needed
    });
    
    // Authentication Failed Handler
    client.on('auth_failure', (error) => {
      console.error('Authentication failed:', error);
    });
    
    // Disconnected Handler
    client.on('disconnected', (reason) => {
      console.log('Client disconnected:', reason);
      // Clear QR code when disconnected, so a new one can be generated
      latestQR = null;
    });
    
    // Ready Handler
    client.on('ready', () => {
      console.log('WhatsApp client ready!');
    });
    
    // Handle incoming messages
    client.on('message', async (message) => {
      try {
        const user = message.from;
        
        // Greet user and present issue options
        if (['hi', 'hello'].includes(message.body.toLowerCase())) {
          const menu = 'Welcome to IT Support!\nPlease select your issue type by replying with the corresponding number:\n1. 🖥️ Hardware Issue\n2. 🌐 Network Issue\n3. 🛠️ Software Issue';
          await client.sendMessage(user, menu);
          userState[user] = { step: 'select_issue' };
        }
        // Process user's issue selection
        else if (userState[user]?.step === 'select_issue') {
          const issueTypes = {
            '1': 'Hardware Issue',
            '2': 'Network Issue',
            '3': 'Software Issue'
          };
          const issueType = issueTypes[message.body.trim()];
          if (issueType) {
            userState[user] = { step: 'describe_issue', issueType };
            await client.sendMessage(user, `You selected: ${issueType}\nPlease provide a brief description of your issue.`);
          } else {
            await client.sendMessage(user, 'Invalid selection. Please reply with 1, 2, or 3 to select your issue type.');
          }
        }
        // Capture issue description
        else if (userState[user]?.step === 'describe_issue') {
          userState[user].description = message.body.trim();
          userState[user].step = 'get_name';
          await client.sendMessage(user, 'Thank you. Please provide your full name.');
        }
        // Capture user's full name
        else if (userState[user]?.step === 'get_name') {
          userState[user].name = message.body.trim();
          userState[user].step = 'get_email';
          await client.sendMessage(user, 'Please provide your email address.');
        }
        // Capture user's email and create ticket
        else if (userState[user]?.step === 'get_email') {
          userState[user].email = message.body.trim();
          
          // Validate email format
          if (!validateEmail(userState[user].email)) {
            await client.sendMessage(user, 'Invalid email format. Please provide a valid email address.');
            return;
          }
          
          // Create ticket in osTicket
          const ticketDetails = userState[user];
          try {
            const ticketId = await createOsTicket(ticketDetails);
            await client.sendMessage(user, `Your ticket has been created successfully! Your ticket ID is ${ticketId}.`);
          } catch (error) {
            console.error('Error creating ticket:', error);
            await client.sendMessage(user, 'There was an error creating your ticket. Please try again later.');
          }
          
          // Clear user state
          delete userState[user];
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
    
    // Function to create a ticket in osTicket
    async function createOsTicket(details) {
      const osTicketUrl = process.env.OSTICKET_URL;
      const apiKey = process.env.OSTICKET_API_KEY;
      
      const ticketData = {
        name: details.name,
        email: details.email,
        subject: `${details.issueType} reported via WhatsApp`,
        message: details.description,
        ip: '0.0.0.0',
        topicId: 1
      };
      
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        }
      };
      
      try {
        const response = await axios.post(osTicketUrl, ticketData, config);
        
        if (response.status === 201) {
          return response.data.ticket_id;
        } else {
          throw new Error(`Failed to create ticket: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error in osTicket API call:', error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        throw error;
      }
    }
    
    // Function to validate email format
    function validateEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
    }
    
    console.log('Initializing WhatsApp client...');
    // Initialize the client
    await client.initialize();
    console.log('Initialization process completed');
    
  } catch (error) {
    console.error('Fatal error encountered:', error);
    // Don't exit the process, keep the web server running
    console.error('WhatsApp client initialization failed, but web server is still running.');
    console.error('Check the configuration and restart the application.');
  }
}