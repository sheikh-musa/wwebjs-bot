// utils/validation.js - Input validation utilities
const logger = require('../lib/logger');

// Validate email format
function validateEmail(email) {
  if (!email) return false;
  
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = re.test(email);
  
  if (!isValid) {
    logger.warn(`Invalid email format: ${email}`);
  }
  
  return isValid;
}

// Validate phone number format (optional)
function validatePhone(phone) {
  if (!phone) return false;
  
  // Basic phone number validation - numbers, spaces, dashes, and parentheses
  const re = /^[\d\s\-()]+$/;
  const isValid = re.test(phone) && phone.replace(/[^\d]/g, '').length >= 7; // At least 7 digits
  
  if (!isValid) {
    logger.warn(`Invalid phone format: ${phone}`);
  }
  
  return isValid;
}

// Validate that required fields are present
function validateRequiredFields(data, requiredFields) {
  const missingFields = [];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    logger.warn(`Missing required fields: ${missingFields.join(', ')}`);
    return { valid: false, missingFields };
  }
  
  return { valid: true };
}

// Sanitize string input (remove HTML, etc.)
function sanitizeString(str) {
  if (!str) return '';
  
  // Replace HTML tags and control characters
  return String(str)
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII
    .trim();
}

module.exports = {
  validateEmail,
  validatePhone,
  validateRequiredFields,
  sanitizeString
};