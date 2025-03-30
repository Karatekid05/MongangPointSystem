/**
 * Provides access to database models.
 * For development, we're using in-memory database models.
 */

// Use in-memory models
console.log('dbModels.js: Using in-memory database models');
const inMemoryDb = require('./inMemoryDb');

module.exports = {
    User: global.User || inMemoryDb.User,
    Gang: global.Gang || inMemoryDb.Gang,
    ActivityLog: global.ActivityLog || inMemoryDb.ActivityLog,
    isConnected: true
}; 