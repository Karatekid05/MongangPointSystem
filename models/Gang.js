const mongoose = require('mongoose');

const gangSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    gangId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    // Role ID in Discord server
    roleId: {
        type: String,
        required: true
    },
    // Channel ID for gang's private chat
    channelId: {
        type: String,
        required: true
    },
    // Points assigned directly to the gang (not to individuals)
    points: {
        type: Number,
        default: 0
    },
    // Weekly points for the gang
    weeklyPoints: {
        type: Number,
        default: 0
    },
    lastWeeklyReset: {
        type: Date,
        default: Date.now
    },
    // Track different point sources for the gang
    pointsBreakdown: {
        messageActivity: { type: Number, default: 0 },
        gamer: { type: Number, default: 0 },
        artAndMemes: { type: Number, default: 0 },
        other: { type: Number, default: 0 }
    },
    // Weekly points breakdown
    weeklyPointsBreakdown: {
        messageActivity: { type: Number, default: 0 },
        gamer: { type: Number, default: 0 },
        artAndMemes: { type: Number, default: 0 },
        other: { type: Number, default: 0 }
    },
    // Cache of total member points for quicker leaderboard generation
    totalMemberPoints: {
        type: Number,
        default: 0
    },
    // Weekly member points
    weeklyMemberPoints: {
        type: Number,
        default: 0
    },
    // Count of active members for analytics
    memberCount: {
        type: Number,
        default: 0
    },
    // Activity metrics
    messageCount: {
        type: Number,
        default: 0
    },
    weeklyMessageCount: {
        type: Number,
        default: 0
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Calculate the total score (gang points + member points)
gangSchema.virtual('totalScore').get(function () {
    return this.points + this.totalMemberPoints;
});

// Calculate the weekly total score
gangSchema.virtual('weeklyTotalScore').get(function () {
    return this.weeklyPoints + this.weeklyMemberPoints;
});

// Ensure virtual fields are included when converting to JSON
gangSchema.set('toJSON', { virtuals: true });
gangSchema.set('toObject', { virtuals: true });

// Indexes for efficient queries
gangSchema.index({ guildId: 1, totalMemberPoints: -1 });
gangSchema.index({ guildId: 1, points: -1 });
gangSchema.index({ guildId: 1, weeklyPoints: -1 });
gangSchema.index({ guildId: 1, weeklyMemberPoints: -1 });
gangSchema.index({ guildId: 1, weeklyTotalScore: 1 });

module.exports = mongoose.model('Gang', gangSchema); 