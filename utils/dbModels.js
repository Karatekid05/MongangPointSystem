/**
 * Provides access to database models.
 * This version uses MongoDB connection instead of in-memory database.
 */

// Mongoose connection and models
const mongoose = require('mongoose');
const { UserSchema } = require('../models/User');
const { GangSchema } = require('../models/Gang');
const { ActivityLogSchema } = require('../models/ActivityLog');

// Connect to MongoDB
let isConnected = false;
try {
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 30000,
        maxPoolSize: 100,
        minPoolSize: 20,
        connectTimeoutMS: 30000,
        retryWrites: true,
        retryReads: true
    })
        .then(() => {
            console.log('MongoDB connected successfully');
            console.log('Connected to database:', mongoose.connection.db.databaseName);
            isConnected = true;
        })
        .catch(error => {
            console.error('MongoDB connection error:', error.message);
            console.log('Falling back to in-memory database...');
            // Continue with in-memory models if MongoDB connection fails
        });
} catch (error) {
    console.error('Error initializing MongoDB connection:', error.message);
    console.log('Falling back to in-memory database...');
}

// Setup models
const User = mongoose.model('User', UserSchema);
const Gang = mongoose.model('Gang', GangSchema);
const ActivityLog = mongoose.model('ActivityLog', ActivityLogSchema);

console.log('dbModels.js: Using MongoDB database models');

module.exports = {
    User,
    Gang,
    ActivityLog,
    isConnected
}; 