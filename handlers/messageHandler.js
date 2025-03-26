// handlers/messageHandler.js - WhatsApp message handling
const logger = require('../lib/logger');
const ticketHandler = require('./ticketHandler');
const { validateEmail } = require('../utils/validation');

// User state to track conversation flow
const userState = {};

// Handle incoming messages
async function handleMessage(message) {
  try {
    const user = message.from;
    logger.info(`Received message from ${user}: "${message.body}"`);
    
    // Initialize user state if it doesn't exist
    if (!userState[user] && ['hi', 'hello'].includes(message.body.toLowerCase())) {
      userState[user] = { step: 'initial' };
    }
    
    // Get WhatsApp client from global context
    const client = global.whatsappClient;
    if (!client) {
      logger.error('WhatsApp client not available in message handler');
      return;
    }
    
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
    // Capture user's email
    else if (userState[user]?.step === 'get_email') {
      const email = message.body.trim();
      
      // Validate email format
      if (!validateEmail(email)) {
        await client.sendMessage(user, 'Invalid email format. Please provide a valid email address.');
        return;
      }
      
      userState[user].email = email;
      userState[user].step = 'confirm_details';
      
      // Show summary and ask for confirmation
      const summary = generateSummary(userState[user]);
      await client.sendMessage(user, summary);
    }
    // Handle confirmation or edit request
    else if (userState[user]?.step === 'confirm_details') {
      const response = message.body.toLowerCase().trim();
      
      if (response === 'confirm') {
        // Proceed with ticket creation
        userState[user].step = 'creating_ticket';
        await client.sendMessage(user, '⏳ Creating your support ticket...');
        
        try {
          const ticketId = await ticketHandler.createTicket(userState[user]);
          
          // Send confirmation message
          const confirmationMessage = `✅ Your support ticket has been created successfully!\n\n` +
            `📝 Ticket ID: ${ticketId}\n` +
            `🔍 Issue Type: ${userState[user].issueType}\n` +
            `👤 Name: ${userState[user].name}\n\n` +
            `Our support team will review your issue and get back to you shortly. ` +
            `Please reference your Ticket ID in any future communications about this issue.`;
          
          await client.sendMessage(user, confirmationMessage);
          logger.info(`Ticket created for ${userState[user].name}, ID: ${ticketId}`);
          
          // Clear user state
          delete userState[user];
        } catch (error) {
          logger.error('Error creating ticket:', error);
          await client.sendMessage(user, 'There was an error creating your ticket. Please try again later or contact support directly.');
          userState[user].step = 'confirm_details';
        }
      } 
      else if (response === 'edit') {
        // Ask which field to edit
        userState[user].step = 'select_edit_field';
        const editMenu = `Which information would you like to edit?\n` +
          `1. Issue Type\n` +
          `2. Description\n` +
          `3. Name\n` +
          `4. Email\n` +
          `Reply with the number of your choice.`;
        await client.sendMessage(user, editMenu);
      }
      else {
        // Invalid response
        await client.sendMessage(user, 'Please reply with "confirm" to create your ticket or "edit" to modify your information.');
      }
    }
    // Handle edit field selection
    else if (userState[user]?.step === 'select_edit_field') {
      const choice = message.body.trim();
      
      switch (choice) {
        case '1':
          userState[user].step = 'edit_issue_type';
          const menu = 'Please select your issue type:\n1. 🖥️ Hardware Issue\n2. 🌐 Network Issue\n3. 🛠️ Software Issue';
          await client.sendMessage(user, menu);
          break;
        case '2':
          userState[user].step = 'edit_description';
          await client.sendMessage(user, 'Please provide a new description of your issue:');
          break;
        case '3':
          userState[user].step = 'edit_name';
          await client.sendMessage(user, 'Please provide your full name:');
          break;
        case '4':
          userState[user].step = 'edit_email';
          await client.sendMessage(user, 'Please provide your email address:');
          break;
        default:
          await client.sendMessage(user, 'Invalid selection. Please reply with a number between 1 and 4.');
          break;
      }
    }
    // Handle editing issue type
    else if (userState[user]?.step === 'edit_issue_type') {
      const issueTypes = {
        '1': 'Hardware Issue',
        '2': 'Network Issue',
        '3': 'Software Issue'
      };
      const issueType = issueTypes[message.body.trim()];
      if (issueType) {
        userState[user].issueType = issueType;
        userState[user].step = 'confirm_details';
        const summary = generateSummary(userState[user]);
        await client.sendMessage(user, summary);
      } else {
        await client.sendMessage(user, 'Invalid selection. Please reply with 1, 2, or 3.');
      }
    }
    // Handle editing description
    else if (userState[user]?.step === 'edit_description') {
      userState[user].description = message.body.trim();
      userState[user].step = 'confirm_details';
      const summary = generateSummary(userState[user]);
      await client.sendMessage(user, summary);
    }
    // Handle editing name
    else if (userState[user]?.step === 'edit_name') {
      userState[user].name = message.body.trim();
      userState[user].step = 'confirm_details';
      const summary = generateSummary(userState[user]);
      await client.sendMessage(user, summary);
    }
    // Handle editing email
    else if (userState[user]?.step === 'edit_email') {
      const email = message.body.trim();
      
      if (!validateEmail(email)) {
        await client.sendMessage(user, 'Invalid email format. Please provide a valid email address.');
        return;
      }
      
      userState[user].email = email;
      userState[user].step = 'confirm_details';
      const summary = generateSummary(userState[user]);
      await client.sendMessage(user, summary);
    }
    else {
      // Handle unexpected messages or state
      await client.sendMessage(user, 'To start a support conversation, please type "hi" or "hello".');
    }
  } catch (error) {
    logger.error('Error handling message:', error);
  }
}

// Function to generate a summary of ticket details for confirmation
function generateSummary(details) {
  return `📋 *Ticket Summary*\n\n` +
    `🔍 *Issue Type:* ${details.issueType}\n` +
    `📝 *Description:* ${details.description}\n` +
    `👤 *Name:* ${details.name}\n` +
    `📧 *Email:* ${details.email}\n\n` +
    `Please review the information above. Reply with:\n` +
    `• *confirm* - to create your support ticket\n` +
    `• *edit* - to modify any information`;
}

// Get current user states (for status API)
function getUserStates() {
  return {
    activeUsers: Object.keys(userState).length,
    users: Object.keys(userState).map(id => ({
      id: id.split('@')[0], // Remove the @c.us part for privacy
      step: userState[id].step,
      issueType: userState[id].issueType
    }))
  };
}

module.exports = {
  handleMessage,
  getUserStates
};