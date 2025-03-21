const { Client, LocalAuth  } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const path = require('path');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: process.env.RAILWAY
            ? '/railway/whatsapp-session' // Railway deployment
            : path.join(__dirname, '.wwebjs_auth') // local development
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Display QR code for authentication
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Confirm client is ready
client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

// Initialize the client
client.initialize();

// Object to track user states
const userState = {};

// Handle incoming messages
client.on('message', async (message) => {
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
});

// Function to create a ticket in osTicket
async function createOsTicket(details) {
    const osTicketUrl = 'http://66.96.212.114:6784/api/tickets.json';
    const apiKey = '8D1E1B0EFC2B9EEEEB5762145B4F5C20';

    const ticketData = {
        name: details.name,
        email: details.email,
        subject: `${details.issueType} reported via WhatsApp`,
        message: details.description,
        ip: '0.0.0.0', // Replace with the user's IP if available
        topicId: 1 // Replace with the appropriate topic ID
    };

    const config = {
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
        }
    };

    const response = await axios.post(osTicketUrl, ticketData, config);

    if (response.status === 201) {
        return response.data.ticket_id;
    } else {
        throw new Error(`Failed to create ticket: ${response.statusText}`);
    }
}

// Function to validate email format
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}