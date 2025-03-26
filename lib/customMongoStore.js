// lib/customMongoStore.js
const { MongoStore } = require('wwebjs-mongo');
const logger = require('./logger');

/**
 * Extended MongoStore with better error handling and debugging
 */
class EnhancedMongoStore extends MongoStore {
    constructor(options) {
        super(options);
        
        // Store additional options
        this.collectionName = options.collection || 'whatsapp-sessions';
        this.sessionName = options.session || 'session';
        
        logger.info(`Initialized EnhancedMongoStore with collection: ${this.collectionName}, session: ${this.sessionName}`);
    }
    
    async save(session) {
        try {
            logger.info(`Saving session to MongoDB. ID: ${session.id?.substring(0, 8)}...`);
            
            // Get reference to collection
            const collection = this.mongoose.connection.db.collection(this.collectionName);
            if (!collection) {
                logger.error('Collection not found, creating it');
                await this.mongoose.connection.db.createCollection(this.collectionName);
            }
            
            // Insert or update session
            const result = await collection.updateOne(
                { _id: this.sessionName },
                { $set: { data: session } },
                { upsert: true }
            );
            
            logger.info(`Session saved: ${result.acknowledged ? 'Success' : 'Failed'}`);
            return true;
        } catch (error) {
            logger.error('Error saving session to MongoDB:', error);
            throw error;
        }
    }
    
    async extract() {
        try {
            logger.info('Extracting session from MongoDB');
            
            // Get reference to collection
            let collection;
            try {
                collection = this.mongoose.connection.db.collection(this.collectionName);
            } catch (err) {
                logger.error('Collection not accessible:', err);
                return null;
            }
            
            if (!collection) {
                logger.warn(`Collection ${this.collectionName} not found`);
                return null;
            }
            
            // Find session document
            const sessionDoc = await collection.findOne({ _id: this.sessionName });
            
            if (!sessionDoc) {
                logger.warn('No session found in MongoDB');
                return null;
            }
            
            if (!sessionDoc.data) {
                logger.warn('Session document found but data field is missing');
                return null;
            }
            
            logger.info(`Session extracted. ID: ${sessionDoc.data.id?.substring(0, 8)}...`);
            return sessionDoc.data;
        } catch (error) {
            logger.error('Error extracting session from MongoDB:', error);
            return null; // Return null instead of throwing to let WhatsApp Web continue
        }
    }
    
    async delete() {
        try {
            logger.info('Deleting session from MongoDB');
            
            // Get reference to collection
            const collection = this.mongoose.connection.db.collection(this.collectionName);
            if (!collection) {
                logger.warn(`Collection ${this.collectionName} not found`);
                return false;
            }
            
            // Delete session document
            const result = await collection.deleteOne({ _id: this.sessionName });
            
            logger.info(`Session deletion: ${result.deletedCount ? 'Success' : 'Not found'}`);
            return result.deletedCount > 0;
        } catch (error) {
            logger.error('Error deleting session from MongoDB:', error);
            throw error;
        }
    }
}

module.exports = EnhancedMongoStore;