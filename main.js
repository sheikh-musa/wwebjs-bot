const { Client, Buttons } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Client initialization
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.once('ready', () => {
    console.log('WhatsApp client is ready!');
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();

// Start conversation flow when user initiates conversation
client.on('message_create', async (message) => {

    if (message.body.toLowerCase() === 'hi' || message.body.toLowerCase() === 'hello') {
        const buttonReply = new Buttons(
            'Welcome to IT Support! How can we assist you today?', 
            [{ body: '🖥️ Hardware Issue' }, { body: '🌐 Network Issue' }, { body: '🛠️ Software Issue' }],
            'IT Support Agent',
            'Choose the type of issue below:'
        );

        await client.sendMessage(message.from, buttonReply);
    }

    // Handle responses to buttons
    else if (message.type === 'buttons_response') {
        const issueType = message.body;
        await message.reply(`You selected: *${issueType}*\nPlease provide a brief description of your issue.`);
        
        // Store user’s selection for ticket creation
        userState[message.from] = { issueType };
    }

    // Capture user’s description and create ticket
    else if (userState[message.from] && userState[message.from].issueType && !userState[message.from].description) {
        userState[message.from].description = message.body;

        // Ask for user's name
        await message.reply('Thank you. Please provide your full name.');
    }

    // Capture user's name
    else if (userState[message.from] && userState[message.from].description && !userState[message.from].name) {
        userState[message.from].name = message.body;

        // Ask for user's email
        await message.reply('Lastly, please provide your email address.');
    }

    // Capture user's email and create the ticket in osTicket
    else if (userState[message.from] && userState[message.from].name && !userState[message.from].email) {
        userState[message.from].email = message.body;

        // Now create a ticket with osTicket
        const ticketDetails = userState[message.from];
        try {
            const ticketResponse = await createOsTicket(ticketDetails);
            await message.reply(`🎫 Your ticket has been created successfully! Your ticket ID is *${ticketResponse}*.`);
        } catch (error) {
            console.error(error);
            await message.reply('⚠️ There was an error creating your ticket. Please try again later.');
        }

        // Clear user state after ticket creation
        delete userState[message.from];
    }
});

// Temporary in-memory state storage
const userState = {};

// osTicket API integration
async function createOsTicket(details) {
    const osTicketUrl = 'http://66.96.212.114:6784/api/http.php/tickets.json';
    const osTicketApiKey = '8D1E1B0EFC2B9EEEEB5762145B4F5C20';

    const ticketData = {
        alert: true,
        autorespond: true,
        source: 'WhatsApp',
        name: details.name,
        email: details.email,
        subject: `${details.issueType} reported via WhatsApp`,
        message: details.description,
        ip: '127.0.0.1',
    };

    const config = {
        headers: {
            'X-API-Key': osTicketApiKey,
            'Content-Type': 'application/json',
        }
    };

    const response = await axios.post(osTicketUrl, ticketData, config);

    if (response.status === 201) {
        return response.data.ticket_number;
    } else {
        throw new Error('Failed to create osTicket');
    }
}
