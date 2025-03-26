// config/puppeteer.js - Puppeteer browser configuration
const logger = require("../lib/logger");

// Get optimized Puppeteer options for Railway environment
function getPuppeteerOptions() {
  logger.debug("Configuring Puppeteer options");

  return {
    // Railway-optimized Puppeteer settings
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
      "--disable-extensions",
      "--disable-features=site-per-process",
      "--js-flags=--expose-gc",
    ],
    ignoreHTTPSErrors: true,
    timeout: 60000,
  };
}

// Custom browser launching function if needed
async function launchBrowser(customOptions = {}) {
  const puppeteer = require("puppeteer");
  const options = {
    ...getPuppeteerOptions(),
    ...customOptions,
  };

  logger.debug("Launching browser with options:", options);

  try {
    const browser = await puppeteer.launch(options);
    return browser;
  } catch (error) {
    logger.error("Failed to launch browser:", error);
    throw error;
  }
}

module.exports = {
  getPuppeteerOptions,
  launchBrowser,
};
