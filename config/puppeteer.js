// config/puppeteer.js - Puppeteer browser configuration
const logger = require('../lib/logger');

// Get optimized Puppeteer options for Railway environment
function getPuppeteerOptions() {
  logger.debug('Configuring Puppeteer options');
  
  return {
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
    ],
    // Additional browser launch options
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // Use custom Chromium path if set
    handleSIGINT: false, // Let our custom handler manage SIGINT
    handleSIGTERM: false, // Let our custom handler manage SIGTERM
    timeout: 120000 // 2 minutes timeout for browser launch
  };
}

// Custom browser launching function if needed
async function launchBrowser(customOptions = {}) {
  const puppeteer = require('puppeteer');
  const options = {
    ...getPuppeteerOptions(),
    ...customOptions
  };
  
  logger.debug('Launching browser with options:', options);
  
  try {
    const browser = await puppeteer.launch(options);
    return browser;
  } catch (error) {
    logger.error('Failed to launch browser:', error);
    throw error;
  }
}

module.exports = {
  getPuppeteerOptions,
  launchBrowser
};