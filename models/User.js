const mongoose = require('mongoose');

// Define a schema for gang-specific points
const gangPointsSchema = new mongoose.Schema({
    gangId: { type: String, required: true },
    gangName: { type: String, required: true },
    points: { type: Number, default: 0 },
    weeklyPoints: { type: Number, default: 0 },
    // Track different point sources
    pointsBreakdown: {
        messageActivity: { type: Number, default: 0 },
        gamer: { type: Number, default: 0 },
        artAndMemes: { type: Number, default: 0 },
        other: { type: Number, default: 0 }
    },
    // Weekly breakdown
    weeklyPointsBreakdown: {
        messageActivity: { type: Number, default: 0 },
        gamer: { type: Number, default: 0 },
        artAndMemes: { type: Number, default: 0 },
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
                messageActivity: 0,
                gamer: 0,
                artAndMemes: 0,
                other: 0
            },
            weeklyPointsBreakdown: {
                messageActivity: 0,
                gamer: 0,
                artAndMemes: 0,
                other: 0
            }
        };
        this.gangPoints.push(gangPoints);
    }

    // Add points to the gang
    gangPoints.points += points;
    gangPoints.weeklyPoints += points;

    // Update breakdown based on source
    switch (source) {
        case 'messageActivity':
            gangPoints.pointsBreakdown.messageActivity += points;
            gangPoints.weeklyPointsBreakdown.messageActivity += points;
            break;
        case 'gamer':
            gangPoints.pointsBreakdown.gamer += points;
            gangPoints.weeklyPointsBreakdown.gamer += points;
            break;
        case 'artAndMemes':
            gangPoints.pointsBreakdown.artAndMemes += points;
            gangPoints.weeklyPointsBreakdown.artAndMemes += points;
            break;
        default:
            gangPoints.pointsBreakdown.other += points;
            gangPoints.weeklyPointsBreakdown.other += points;
    }

    // Ensure no category goes below 0
    const categories = ['messageActivity', 'gamer', 'artAndMemes', 'other'];
    for (const category of categories) {
        if (gangPoints.pointsBreakdown[category] < 0) {
            gangPoints.pointsBreakdown[category] = 0;
        }
        if (gangPoints.weeklyPointsBreakdown[category] < 0) {
            gangPoints.weeklyPointsBreakdown[category] = 0;
        }
    }

    // Recalculate total points from breakdown
    gangPoints.points = Object.values(gangPoints.pointsBreakdown).reduce((a, b) => a + b, 0);
    gangPoints.weeklyPoints = Object.values(gangPoints.weeklyPointsBreakdown).reduce((a, b) => a + b, 0);

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
                messageActivity: 0,
                gamer: 0,
                artAndMemes: 0,
                other: 0
            },
            weeklyPointsBreakdown: {
                messageActivity: 0,
                gamer: 0,
                artAndMemes: 0,
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