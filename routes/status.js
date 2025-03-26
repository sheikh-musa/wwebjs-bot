// routes/status.js - API routes for status information
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../lib/logger');
const sessionManager = require('../lib/sessionManager');
const qrHandler = require('../handlers/qrHandler');
const messageHandler = require('../handlers/messageHandler');
const ticketHandler = require('../handlers/ticketHandler');

// Health check endpoint
router.get('/health', (req, res) => {
  const isHealthy = mongoose.connection.readyState === 1 && global.whatsappClient;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'unhealthy',
    mongodb: mongoose.connection.readyState === 1,
    whatsapp: !!global.whatsappClient,
    time: new Date().toISOString()
  });
});

// Detailed status endpoint
router.get('/status', async (req, res) => {
  try {
    // Get client info
    const client = global.whatsappClient;
    const clientInfo = client ? {
      initialized: !!client.info,
      authenticated: client.authStrategy?.isAuthenticated() || false,
      // Don't include potentially sensitive info like phone number
    } : null;
    
    // Get ticket system status
    const ticketingStatus = await ticketHandler.checkApiStatus();
    
    // Get system status
    res.json({
      serverInfo: {
        uptime: Math.floor(process.uptime()),
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        currentTime: new Date().toISOString(),
        nodeVersion: process.version,
        memoryUsage: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        }
      },
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        mongodbVersion: mongoose.connection.db?.serverConfig?.s?.options?.serverApi?.version || 'unknown'
      },
      sessionState: sessionManager.getSessionState(true),
      whatsapp: clientInfo,
      qrState: qrHandler.getQRState(),
      userState: messageHandler.getUserStates(),
      ticketing: {
        status: ticketingStatus
      },
      deploymentInfo: {
        environment: process.env.NODE_ENV || 'development',
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || 'local',
        buildId: process.env.RAILWAY_BUILD_ID || 'development'
      }
    });
  } catch (error) {
    logger.error('Error generating status response:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error generating status information',
      time: new Date().toISOString()
    });
  }
});

// Force session save endpoint (admin only)
router.post('/force-save', async (req, res) => {
  try {
    // Simple security check - this should be improved with proper auth
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      });
    }
    
    // Force session save
    const result = await sessionManager.forceSaveSession();
    
    res.json({
      status: result ? 'success' : 'failed',
      message: result ? 'Session saved successfully' : 'Failed to save session',
      time: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in force-save endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error processing request',
      time: new Date().toISOString()
    });
  }
});

module.exports = router;