const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    // Can be 'user' or 'gang'
    targetType: {
        type: String,
        required: true,
        enum: ['user', 'gang']
    },
    // Discord ID of the user or gang ID
    targetId: {
        type: String,
        required: true,
        index: true
    },
    // Name of user or gang (for display purposes)
    targetName: {
        type: String,
        required: true
    },
    // The action: 'award', 'deduct', 'sync', etc.
    action: {
        type: String,
        required: true
    },
    // Points awarded/deducted (positive or negative)
    points: {
        type: Number,
        required: true
    },
    // Source of points: 'twitter', 'games', 'art', 'activity', etc.
    source: {
        type: String,
        required: true
    },
    // Who awarded the points (moderator Discord ID)
    awardedBy: {
        type: String
    },
    // Moderator username (for display)
    awardedByUsername: {
        type: String
    },
    // Optional reason for the points
    reason: {
        type: String
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ targetId: 1, createdAt: -1 });
activityLogSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema); 