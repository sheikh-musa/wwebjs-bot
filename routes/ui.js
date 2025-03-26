// routes/ui.js - Web UI routes
const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const qrHandler = require('../handlers/qrHandler');

// Main route for QR code display
router.get('/', (req, res) => {
  // Get references to global variables
  const { missingEnvVars } = require('../index');
  const latestQR = global.latestQR;
  const qrState = qrHandler.getQRState();
  
  // If there are missing environment variables, show error
  if (missingEnvVars && missingEnvVars.length > 0) {
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
    const minutesAgo = qrState.age;
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

module.exports = router;