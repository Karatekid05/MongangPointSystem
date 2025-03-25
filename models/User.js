const mongoose = require('mongoose');

// Define a schema for gang-specific points
const gangPointsSchema = new mongoose.Schema({
    gangId: { type: String, required: true },
    gangName: { type: String, required: true },
    points: { type: Number, default: 0 },
    weeklyPoints: { type: Number, default: 0 },
    // Track different point sources
    pointsBreakdown: {
        twitter: { type: Number, default: 0 },
        games: { type: Number, default: 0 },
        artAndMemes: { type: Number, default: 0 },
        activity: { type: Number, default: 0 },
        gangActivity: { type: Number, default: 0 },
        other: { type: Number, default: 0 }
    },
    // Weekly breakdown
    weeklyPointsBreakdown: {
        twitter: { type: Number, default: 0 },
        games: { type: Number, default: 0 },
        artAndMemes: { type: Number, default: 0 },
        activity: { type: Number, default: 0 },
        gangActivity: { type: Number, default: 0 },
        other: { type: Number, default: 0 }
    },
    lastActive: { type: Date }
}, { _id: false });

const userSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    // Current gang the user belongs to
    currentGangId: {
        type: String,
        required: true,
        index: true
    },
    currentGangName: {
        type: String
    },
    // For backwards compatibility
    gangId: {
        type: String,
        index: true
    },
    gangName: {
        type: String
    },
    // Total points (will now reference current gang's points)
    points: {
        type: Number,
        default: 0
    },
    // Weekly points (will now reference current gang's weekly points)
    weeklyPoints: {
        type: Number,
        default: 0
    },
    lastWeeklyReset: {
        type: Date,
        default: Date.now
    },
    // Optional Twitter username for Engage Bot integration
    twitterUsername: {
        type: String,
        default: null
    },
    // Store points for each gang the user has been a part of
    gangPoints: [gangPointsSchema],
    // Track when user was last active for rate limiting
    lastActive: {
        type: Date,
        default: Date.now
    },
    // Recent messages for spam detection
    recentMessages: [{
        content: String,
        timestamp: Date
    }]
}, {
    timestamps: true
});

// Helper method to get points for current gang
userSchema.methods.getCurrentGangPoints = function () {
    const currentGangPoints = this.gangPoints.find(g => g.gangId === this.currentGangId);
    return currentGangPoints ? currentGangPoints.points : 0;
};

// Helper method to get weekly points for current gang
userSchema.methods.getCurrentGangWeeklyPoints = function () {
    const currentGangPoints = this.gangPoints.find(g => g.gangId === this.currentGangId);
    return currentGangPoints ? currentGangPoints.weeklyPoints : 0;
};

// Helper method to add points to a specific gang
userSchema.methods.addPointsToGang = function (gangId, gangName, points, source) {
    let gangPoints = this.gangPoints.find(g => g.gangId === gangId);

    if (!gangPoints) {
        // User has never been in this gang before, create new entry
        gangPoints = {
            gangId,
            gangName,
            points: 0,
            weeklyPoints: 0,
            pointsBreakdown: {
                twitter: 0,
                games: 0,
                artAndMemes: 0,
                activity: 0,
                gangActivity: 0,
                other: 0
            },
            weeklyPointsBreakdown: {
                twitter: 0,
                games: 0,
                artAndMemes: 0,
                activity: 0,
                gangActivity: 0,
                other: 0
            }
        };
        this.gangPoints.push(gangPoints);
    }

    // Add points to the gang
    gangPoints.points += points;
    gangPoints.weeklyPoints += points;

    // Update breakdown
    if (source === 'twitter') {
        gangPoints.pointsBreakdown.twitter += points;
        gangPoints.weeklyPointsBreakdown.twitter += points;
    } else if (source === 'games') {
        gangPoints.pointsBreakdown.games += points;
        gangPoints.weeklyPointsBreakdown.games += points;
    } else if (source === 'artAndMemes') {
        gangPoints.pointsBreakdown.artAndMemes += points;
        gangPoints.weeklyPointsBreakdown.artAndMemes += points;
    } else if (source === 'activity') {
        gangPoints.pointsBreakdown.activity += points;
        gangPoints.weeklyPointsBreakdown.activity += points;
    } else if (source === 'gangActivity') {
        gangPoints.pointsBreakdown.gangActivity += points;
        gangPoints.weeklyPointsBreakdown.gangActivity += points;
    } else {
        gangPoints.pointsBreakdown.other += points;
        gangPoints.weeklyPointsBreakdown.other += points;
    }

    // If this is the current gang, also update the user's total points
    if (gangId === this.currentGangId) {
        this.points = gangPoints.points;
        this.weeklyPoints = gangPoints.weeklyPoints;
    }

    return gangPoints;
};

// Helper method to switch gang
userSchema.methods.switchGang = function (newGangId, newGangName) {
    // If already in this gang, do nothing
    if (this.currentGangId === newGangId) return;

    // Set the new gang
    this.currentGangId = newGangId;
    this.currentGangName = newGangName;

    // For backward compatibility
    this.gangId = newGangId;
    this.gangName = newGangName;

    // Check if user has been in this gang before
    const newGangPoints = this.gangPoints.find(g => g.gangId === newGangId);

    if (newGangPoints) {
        // User is returning to a gang they were in before, restore points
        this.points = newGangPoints.points;
        this.weeklyPoints = newGangPoints.weeklyPoints;
    } else {
        // User is joining a new gang, start with 0 points
        this.points = 0;
        this.weeklyPoints = 0;

        // Create new gang points entry
        this.gangPoints.push({
            gangId: newGangId,
            gangName: newGangName,
            points: 0,
            weeklyPoints: 0,
            pointsBreakdown: {
                twitter: 0,
                games: 0,
                artAndMemes: 0,
                activity: 0,
                gangActivity: 0,
                other: 0
            },
            weeklyPointsBreakdown: {
                twitter: 0,
                games: 0,
                artAndMemes: 0,
                activity: 0,
                gangActivity: 0,
                other: 0
            }
        });
    }
};

// Index for efficient leaderboard queries
userSchema.index({ points: -1 });
userSchema.index({ weeklyPoints: -1 });
userSchema.index({ currentGangId: 1, points: -1 });
userSchema.index({ currentGangId: 1, weeklyPoints: -1 });

module.exports = mongoose.model('User', userSchema); 