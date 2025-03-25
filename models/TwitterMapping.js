const mongoose = require('mongoose');

const twitterMappingSchema = new mongoose.Schema({
    // Discord user ID
    discordId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // Discord username (for display)
    discordUsername: {
        type: String,
        required: true
    },
    // Twitter username (without @)
    twitterUsername: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // Last time points were synced from Engage Bot
    lastSyncedAt: {
        type: Date,
        default: null
    },
    // Last Twitter engagement count from Engage Bot (to calculate deltas)
    lastEngagementCount: {
        type: Number,
        default: 0
    },
    // Total points awarded via Twitter engagement
    totalPointsAwarded: {
        type: Number,
        default: 0
    },
    // Whether this mapping is verified (approved by mods)
    verified: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TwitterMapping', twitterMappingSchema); 