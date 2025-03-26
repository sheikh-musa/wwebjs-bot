// lib/sessionManager.js - Session state tracking and management
const logger = require('./logger');

// Session state tracking
const sessionState = {
  lastSessionSave: null,
  sessionId: null,
  authEvents: [],
  connectionEvents: []
};

// Record an event in the session history
function recordEvent(eventName, data = {}) {
  const event = {
    event: eventName,
    timestamp: new Date(),
    ...data
  };
  
  // Store in the appropriate event array
  if (eventName.includes('disconnect') || eventName.includes('connect')) {
    sessionState.connectionEvents.push(event);
    // Limit array size
    if (sessionState.connectionEvents.length > 100) {
      sessionState.connectionEvents.shift();
    }
  } else {
    sessionState.authEvents.push(event);
    // Limit array size
    if (sessionState.authEvents.length > 100) {
      sessionState.authEvents.shift();
    }
  }
  
  return event;
}

// Get session state (optionally filtered)
function getSessionState(includeEvents = false) {
  const state = {
    lastSessionSave: sessionState.lastSessionSave,
    sessionId: sessionState.sessionId ? `${sessionState.sessionId.substring(0, 8)}...` : null,
    authEventCount: sessionState.authEvents.length,
    connectionEventCount: sessionState.connectionEvents.length
  };
  
  if (includeEvents) {
    state.recentAuthEvents = sessionState.authEvents.slice(-5);
    state.recentConnectionEvents = sessionState.connectionEvents.slice(-5);
  }
  
  return state;
}

// Enhance the MongoStore with additional logging
function enhanceStore(store) {
  // Save original methods
  const originalSave = store.save.bind(store);
  const originalExtract = store.extract.bind(store);
  
  // Enhance save method
  store.save = async function(session) {
    logger.debug(`Saving session to MongoDB. Session ID: ${session.id?.substring(0, 8)}...`);
    logger.debug(`Session data size: ~${JSON.stringify(session).length / 1024} KB`);
    
    sessionState.lastSessionSave = new Date();
    sessionState.sessionId = session.id;
    
    try {
      await originalSave(session);
      logger.info(`Successfully saved session to MongoDB`);
      recordEvent('session_saved', { success: true });
      return true;
    } catch (error) {
      logger.error(`Failed to save session to MongoDB:`, error);
      recordEvent('session_save_failed', { error: error.message });
      throw error;
    }
  };
  
  // Enhance extract method
  store.extract = async function() {
    logger.debug(`Attempting to extract session from MongoDB...`);
    
    try {
      const session = await originalExtract();
      if (session) {
        logger.info(`Successfully extracted session. Session ID: ${session.id?.substring(0, 8)}...`);
        recordEvent('session_extracted', { success: true });
        return session;
      } else {
        logger.warn(`No session found in MongoDB`);
        recordEvent('no_session_found');
        return null;
      }
    } catch (error) {
      logger.error(`Error extracting session from MongoDB:`, error);
      recordEvent('session_extract_failed', { error: error.message });
      throw error;
    }
  };
  
  return store;
}

// Force a session save
async function forceSaveSession() {
  try {
    const client = global.whatsappClient;
    if (client && client.authStrategy) {
      logger.info('Forcing session save...');
      await client.authStrategy.afterBrowserReset();
      sessionState.lastSessionSave = new Date();
      logger.info('Session save completed');
      return true;
    } else {
      logger.warn('Cannot force session save: client or authStrategy not available');
      return false;
    }
  } catch (error) {
    logger.error('Error forcing session save:', error);
    return false;
  }
}

module.exports = {
  recordEvent,
  getSessionState,
  enhanceStore,
  forceSaveSession,
  sessionState // Exposed for status API
};