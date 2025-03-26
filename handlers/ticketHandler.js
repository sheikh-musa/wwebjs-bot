// handlers/ticketHandler.js - osTicket integration
const axios = require('axios');
const logger = require('../lib/logger');

// Create a ticket in osTicket system
async function createTicket(details) {
  try {
    const osTicketUrl = process.env.OSTICKET_URL;
    const apiKey = process.env.OSTICKET_API_KEY;
    
    if (!osTicketUrl || !apiKey) {
      throw new Error('Missing osTicket configuration (OSTICKET_URL or OSTICKET_API_KEY)');
    }
    
    logger.info('Creating ticket with details:', {
      name: details.name,
      email: details.email,
      subject: `${details.issueType} reported via WhatsApp`,
      // Don't log full description for privacy
      descriptionLength: details.description ? details.description.length : 0
    });
    
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
    
    const response = await axios.post(osTicketUrl, ticketData, config);
    
    if (response.status === 201) {
      const ticketId = response.data;
      logger.info(`Successfully created ticket with ID: ${ticketId}`);
      return ticketId;
    } else {
      throw new Error(`Failed to create ticket: ${response.statusText}`);
    }
  } catch (error) {
    logger.error('Error in osTicket API call:', error.message);
    if (error.response) {
      logger.error('Response status:', error.response.status);
      logger.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Check osTicket API status
async function checkApiStatus() {
  try {
    const osTicketUrl = process.env.OSTICKET_URL;
    const apiKey = process.env.OSTICKET_API_KEY;
    
    if (!osTicketUrl || !apiKey) {
      return {
        available: false,
        reason: 'Missing configuration',
        configured: false
      };
    }
    
    // We can't easily test the API without making a ticket,
    // so we'll just check if the URL seems valid
    const urlValid = osTicketUrl.startsWith('http') && 
                    (osTicketUrl.includes('api') || osTicketUrl.includes('ticket'));
    
    return {
      available: true,
      configured: true,
      urlValid: urlValid,
      url: osTicketUrl.replace(/\/[^\/]*$/, '/***/') // Redact the endpoint for security
    };
  } catch (error) {
    logger.error('Error checking osTicket API status:', error);
    return {
      available: false,
      reason: error.message,
      configured: true
    };
  }
}

module.exports = {
  createTicket,
  checkApiStatus
};