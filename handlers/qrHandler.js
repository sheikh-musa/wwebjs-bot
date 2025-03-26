// handlers/qrHandler.js - QR code generation and handling
const qrcode = require('qrcode');
const logger = require('../lib/logger');

// Handle QR code generation
async function handleQR(qr) {
  logger.info('New QR code received');
  
  // Update timestamp in global context
  global.qrTimestamp = Date.now();
  
  // Generate QR code as data URL
  try {
    global.latestQR = await qrcode.toDataURL(qr);
    logger.info('QR code generated and available on web interface');
  } catch (err) {
    logger.error('Error generating QR code:', err);
  }
}

// Get current QR code state
function getQRState() {
  const minutesAgo = global.qrTimestamp ? Math.floor((Date.now() - global.qrTimestamp) / 60000) : 0;
  
  return {
    hasQR: !!global.latestQR,
    timestamp: global.qrTimestamp,
    age: minutesAgo,
    isExpired: minutesAgo > 2 // QR codes usually expire after 2-3 minutes
  };
}

// Clear QR code (e.g., after authentication)
function clearQR() {
  global.latestQR = null;
  global.qrTimestamp = null;
  logger.info('QR code cleared');
}

module.exports = {
  handleQR,
  getQRState,
  clearQR
};