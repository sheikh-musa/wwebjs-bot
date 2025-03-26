# WhatsApp Support Bot - Modular Architecture

This project has been restructured to use a modular architecture that improves maintainability, readability, and makes troubleshooting session persistence issues easier.

## Project Structure

The codebase is organized into the following directories:

```
📁 project-root/
│
├── 📁 config/             # Configuration modules
├── 📁 handlers/           # Message & event handlers
├── 📁 lib/                # Core functionality 
├── 📁 routes/             # Express routes
├── 📁 utils/              # Utility functions
│
├── 📄 app.js              # Express app setup
├── 📄 whatsappClient.js   # WhatsApp client initialization
└── 📄 index.js            # Main entry point
```

## Key Features

- **Enhanced Session Logging**: Detailed logs for session operations to troubleshoot persistence issues
- **Graceful Shutdown Handling**: Proper cleanup when the application is stopping, ensuring sessions are saved
- **Health Monitoring**: Regular checks on MongoDB connection and WhatsApp client status
- **Status API**: Detailed diagnostic endpoints to view system status
- **Modular Codebase**: Improved organization for easier maintenance and updates

## Implementation Guide

### Step 1: Create Directory Structure

Create the following directories in your project:

```bash
mkdir -p config handlers lib routes utils
```

### Step 2: Copy Core Files

1. Start with the entry point files:
   - Copy `index.js` to your project root
   - Copy `app.js` to your project root
   - Copy `whatsappClient.js` to your project root

2. Copy configuration files:
   - Copy `config/db.js` to the `config` folder
   - Copy `config/puppeteer.js` to the `config` folder

### Step 3: Copy Utility Modules

1. Copy library files:
   - Copy `lib/logger.js` to the `lib` folder
   - Copy `lib/sessionManager.js` to the `lib` folder
   - Copy `lib/healthCheck.js` to the `lib` folder

2. Copy utility files:
   - Copy `utils/shutdown.js` to the `utils` folder
   - Copy `utils/validation.js` to the `utils` folder

### Step 4: Copy Handlers and Routes

1. Copy handler files:
   - Copy `handlers/messageHandler.js` to the `handlers` folder
   - Copy `handlers/qrHandler.js` to the `handlers` folder
   - Copy `handlers/ticketHandler.js` to the `handlers` folder

2. Copy route files:
   - Copy `routes/ui.js` to the `routes` folder
   - Copy `routes/status.js` to the `routes` folder

### Step 5: Update Package.json

Make sure your package.json file has the correct entry point:

```json
{
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  }
}
```

## Environment Variables

The application requires the following environment variables:

- `MONGO_URL`: MongoDB connection string
- `OSTICKET_URL`: URL to osTicket API
- `OSTICKET_API_KEY`: API key for osTicket
- `PORT`: (Optional) Port for the web server (defaults to 8080)
- `LOG_LEVEL`: (Optional) Logging level (ERROR, WARN, INFO, DEBUG)
- `ADMIN_API_KEY`: (Optional) Admin API key for protected endpoints

## Troubleshooting Session Persistence

If you're experiencing issues with session persistence after redeployment, check the following:

1. **Check the logs**: Look for session-related events in the logs
2. **Access the status endpoint**: Visit `/api/status` to see detailed information about the session state
3. **Verify MongoDB connection**: Ensure MongoDB is properly connected
4. **Force a session save**: Use the `/api/force-save` endpoint with the proper admin API key
5. **Check deployment events**: Look for logs related to shutdown/startup during deployment

## Adding New Features

To add new features to the application:

1. **New message handlers**: Update `handlers/messageHandler.js`
2. **New API endpoints**: Add routes to `routes/status.js`
3. **New ticket system integration**: Update `handlers/ticketHandler.js`
4. **UI changes**: Update `routes/ui.js`

## License

This project is open source and available under the MIT License.