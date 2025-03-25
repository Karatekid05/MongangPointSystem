const User = require('../models/User');
const Gang = require('../models/Gang');
const ActivityLog = require('../models/ActivityLog');
const { gangsConfig } = require('../config/gangs');
const mongoose = require('mongoose');

/**
 * Award points to a user
 * @param {Object} options - Award options
 * @param {String} options.guildId - Discord server ID
 * @param {String} options.userId - Discord user ID
 * @param {String} options.username - Discord username
 * @param {Number} options.points - Points to award (positive or negative)
 * @param {String} options.source - Source of points (twitter, games, art, activity, etc.)
 * @param {String} options.awardedBy - Discord ID of moderator awarding points (optional)
 * @param {String} options.awardedByUsername - Username of moderator (optional)
 * @param {String} options.reason - Reason for awarding points (optional)
 * @returns {Promise<Object>} - Updated user object
 */
async function awardUserPoints(options) {
    // Get the user or create if doesn't exist
    let user = await User.findOne({ discordId: options.userId });

    if (!user) {
        throw new Error('User not found in database. Please register the user first.');
    }

    // Award points to the user's current gang
    user.addPointsToGang(
        user.currentGangId,
        user.currentGangName,
        options.points,
        options.source
    );

    await user.save();

    // Log the activity
    await ActivityLog.create({
        guildId: options.guildId,
        targetType: 'user',
        targetId: options.userId,
        targetName: options.username,
        action: options.points >= 0 ? 'award' : 'deduct',
        points: options.points,
        source: options.source,
        awardedBy: options.awardedBy || null,
        awardedByUsername: options.awardedByUsername || null,
        reason: options.reason || null
    });

    // Update the gang's totalMemberPoints
    await updateGangTotalPoints(user.currentGangId);
    await updateGangWeeklyPoints(user.currentGangId);

    return user;
}

/**
 * Award points to a gang
 * @param {Object} options - Award options
 * @param {String} options.guildId - Discord server ID
 * @param {String} options.gangId - Gang ID
 * @param {Number} options.points - Points to award (positive or negative)
 * @param {String} options.source - Source of points (events, competitions, other)
 * @param {String} options.awardedBy - Discord ID of moderator awarding points (optional)
 * @param {String} options.awardedByUsername - Username of moderator (optional)
 * @param {String} options.reason - Reason for awarding points (optional)
 * @returns {Promise<Object>} - Updated gang object
 */
async function awardGangPoints(options) {
    // Get the gang
    const gang = await Gang.findOne({ gangId: options.gangId, guildId: options.guildId });

    if (!gang) {
        throw new Error('Gang not found');
    }

    // Award points
    gang.points += options.points;
    gang.weeklyPoints += options.points;

    // Update the specific points category
    if (options.source === 'events') {
        gang.pointsBreakdown.events += options.points;
        gang.weeklyPointsBreakdown.events += options.points;
    } else if (options.source === 'competitions') {
        gang.pointsBreakdown.competitions += options.points;
        gang.weeklyPointsBreakdown.competitions += options.points;
    } else {
        gang.pointsBreakdown.other += options.points;
        gang.weeklyPointsBreakdown.other += options.points;
    }

    await gang.save();

    // Log the activity
    await ActivityLog.create({
        guildId: options.guildId,
        targetType: 'gang',
        targetId: options.gangId,
        targetName: gang.name,
        action: options.points >= 0 ? 'award' : 'deduct',
        points: options.points,
        source: options.source,
        awardedBy: options.awardedBy || null,
        awardedByUsername: options.awardedByUsername || null,
        reason: options.reason || null
    });

    return gang;
}

/**
 * Register a new user or update existing user
 * @param {Object} options - User registration options
 * @param {String} options.guildId - Discord server ID
 * @param {String} options.userId - Discord user ID
 * @param {String} options.username - Discord username
 * @param {String} options.gangId - Gang ID
 * @param {String} options.gangName - Gang name
 * @returns {Promise<Object>} - Created/updated user object
 */
async function registerUser(options) {
    let user = await User.findOne({ discordId: options.userId });

    if (user) {
        // User exists, check if gang changed
        if (user.currentGangId !== options.gangId) {
            // Gang has changed, switch gangs
            user.switchGang(options.gangId, options.gangName);
        }

        // Update username
        user.username = options.username;
    } else {
        // Create new user
        user = new User({
            discordId: options.userId,
            username: options.username,
            currentGangId: options.gangId,
            currentGangName: options.gangName,
            gangId: options.gangId,  // For backward compatibility
            gangName: options.gangName,
            points: 0,
            weeklyPoints: 0,
            gangPoints: [{
                gangId: options.gangId,
                gangName: options.gangName,
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
            }]
        });
    }

    await user.save();

    // Update gang member count
    await updateGangMemberCount(options.gangId, options.guildId);

    return user;
}

/**
 * Update a user's gang based on their roles
 * @param {Object} options - Options
 * @param {String} options.guildId - Discord server ID
 * @param {String} options.userId - Discord user ID
 * @param {String} options.username - Discord username
 * @param {Array} options.roles - Array of role IDs the user has
 * @returns {Promise<Object>} - Updated user object or null if no change
 */
async function updateUserGang(options) {
    // Find matching gang from config
    const matchingGang = gangsConfig.find(gang => options.roles.includes(gang.roleId));

    if (!matchingGang) {
        // User doesn't have any recognized gang roles
        return null;
    }

    // Find the user
    let user = await User.findOne({ discordId: options.userId });

    if (user) {
        // User exists, check if gang has changed
        if (user.currentGangId !== matchingGang.gangId) {
            // Gang has changed, switch gangs
            user.switchGang(matchingGang.gangId, matchingGang.name);
            await user.save();

            // Update gang member counts
            await updateGangMemberCount(matchingGang.gangId, options.guildId);

            return user;
        }

        // No change needed
        return null;
    } else {
        // Register new user
        return registerUser({
            guildId: options.guildId,
            userId: options.userId,
            username: options.username,
            gangId: matchingGang.gangId,
            gangName: matchingGang.name
        });
    }
}

/**
 * Update gang's totalMemberPoints
 * @param {String} gangId - Gang ID
 * @returns {Promise<void>}
 */
async function updateGangTotalPoints(gangId) {
    // Calculate sum of all members' points in the gang
    const result = await User.aggregate([
        { $match: { currentGangId: gangId } },
        { $group: { _id: null, totalPoints: { $sum: '$points' }, count: { $sum: 1 } } }
    ]);

    if (result.length > 0) {
        const totalPoints = result[0].totalPoints;
        const memberCount = result[0].count;

        // Update the gang
        await Gang.updateOne(
            { gangId: gangId },
            {
                $set: {
                    totalMemberPoints: totalPoints,
                    memberCount: memberCount
                }
            }
        );
    }
}

/**
 * Update gang's weekly member points
 * @param {String} gangId - Gang ID
 * @returns {Promise<void>}
 */
async function updateGangWeeklyPoints(gangId) {
    // Calculate sum of all members' weekly points
    const result = await User.aggregate([
        { $match: { currentGangId: gangId } },
        { $group: { _id: null, totalWeeklyPoints: { $sum: '$weeklyPoints' } } }
    ]);

    if (result.length > 0) {
        const totalWeeklyPoints = result[0].totalWeeklyPoints;

        // Update the gang
        await Gang.updateOne(
            { gangId: gangId },
            { $set: { weeklyMemberPoints: totalWeeklyPoints } }
        );
    }
}

/**
 * Update gang member count
 * @param {String} gangId - Gang ID
 * @param {String} guildId - Guild ID
 * @returns {Promise<void>}
 */
async function updateGangMemberCount(gangId, guildId) {
    const count = await User.countDocuments({ currentGangId: gangId });
    await Gang.updateOne(
        { gangId: gangId, guildId: guildId },
        { $set: { memberCount: count } }
    );
}

/**
 * Get user leaderboard
 * @param {String} guildId - Discord server ID
 * @param {Number} limit - Number of users to return
 * @param {Number} skip - Number of users to skip (for pagination)
 * @returns {Promise<Array>} - Array of top users
 */
async function getUserLeaderboard(guildId, limit = 100, skip = 0) {
    return User.find({ guildId: guildId })
        .sort({ points: -1 })
        .skip(skip)
        .limit(limit);
}

/**
 * Get weekly user leaderboard
 * @param {String} guildId - Discord server ID
 * @param {Number} limit - Number of users to return
 * @param {Number} skip - Number of users to skip (for pagination)
 * @returns {Promise<Array>} - Array of top users for this week
 */
async function getWeeklyUserLeaderboard(guildId, limit = 100, skip = 0) {
    return User.find({ guildId: guildId })
        .sort({ weeklyPoints: -1 })
        .skip(skip)
        .limit(limit);
}

/**
 * Get gang leaderboard
 * @param {String} guildId - Discord server ID
 * @returns {Promise<Array>} - Array of gangs with stats
 */
async function getGangLeaderboard(guildId) {
    return Gang.find({ guildId: guildId })
        .sort({ totalScore: -1 });
}

/**
 * Get weekly gang leaderboard
 * @param {String} guildId - Discord server ID
 * @returns {Promise<Array>} - Array of gangs with weekly stats
 */
async function getWeeklyGangLeaderboard(guildId) {
    return Gang.find({ guildId: guildId })
        .sort({ weeklyTotalScore: -1 });
}

/**
 * Get gang member leaderboard
 * @param {String} gangId - Gang ID
 * @param {Number} limit - Number of users to return
 * @param {Number} skip - Number of users to skip (for pagination)
 * @returns {Promise<Array>} - Array of top gang members
 */
async function getGangMemberLeaderboard(gangId, limit = 100, skip = 0) {
    console.log(`Getting gang member leaderboard for gangId: ${gangId}, limit: ${limit}, skip: ${skip}`);

    // Get the users
    const users = await User.find({ currentGangId: gangId, points: { $gt: 0 } })
        .sort({ points: -1 })
        .skip(skip)
        .limit(limit);

    console.log(`Found ${users.length} users for gang ${gangId}`);

    return users;
}

/**
 * Get weekly gang-specific user leaderboard
 * @param {String} gangId - Gang ID
 * @param {Number} limit - Number of users to return
 * @param {Number} skip - Number of users to skip (for pagination)
 * @returns {Promise<Array>} - Array of top users in the gang for this week
 */
async function getWeeklyGangMemberLeaderboard(gangId, limit = 100, skip = 0) {
    return User.find({ currentGangId: gangId, weeklyPoints: { $gt: 0 } })
        .sort({ weeklyPoints: -1 })
        .skip(skip)
        .limit(limit);
}

/**
 * Reset weekly points for all users and gangs
 * @param {String} guildId - Discord server ID
 * @returns {Promise<Object>} - Results summary
 */
async function resetWeeklyPoints(guildId) {
    const now = new Date();

    // Reset all users' weekly points
    // First, get all users
    const users = await User.find();

    // For each user, reset weekly points in all their gangs
    for (const user of users) {
        for (const gangPoints of user.gangPoints) {
            gangPoints.weeklyPoints = 0;
            gangPoints.weeklyPointsBreakdown = {
                twitter: 0,
                games: 0,
                artAndMemes: 0,
                activity: 0,
                gangActivity: 0,
                other: 0
            };
        }

        // Also reset main weekly points if applicable
        if (user.currentGangId) {
            const currentGangPoints = user.gangPoints.find(g => g.gangId === user.currentGangId);
            user.weeklyPoints = currentGangPoints ? 0 : 0;
        } else {
            user.weeklyPoints = 0;
        }

        user.lastWeeklyReset = now;
        await user.save();
    }

    // Reset all gangs' weekly points
    const gangResult = await Gang.updateMany(
        { guildId: guildId },
        {
            $set: {
                weeklyPoints: 0,
                weeklyMemberPoints: 0,
                weeklyMessageCount: 0,
                weeklyPointsBreakdown: {
                    events: 0,
                    competitions: 0,
                    other: 0
                },
                lastWeeklyReset: now
            }
        }
    );

    return {
        usersReset: users.length,
        gangsReset: gangResult.modifiedCount,
        timestamp: now
    };
}

/**
 * Reset all points (weekly and total) for all users and gangs
 * @param {String} guildId - Discord server ID
 * @returns {Promise<Object>} - Results summary
 */
async function resetAllPoints(guildId) {
    const now = new Date();

    // Reset all users' points
    // First, get all users
    const users = await User.find();

    // For each user, reset all points in all their gangs
    for (const user of users) {
        for (const gangPoints of user.gangPoints) {
            // Reset total points
            gangPoints.points = 0;
            gangPoints.pointsBreakdown = {
                twitter: 0,
                games: 0,
                artAndMemes: 0,
                activity: 0,
                gangActivity: 0,
                other: 0
            };

            // Reset weekly points
            gangPoints.weeklyPoints = 0;
            gangPoints.weeklyPointsBreakdown = {
                twitter: 0,
                games: 0,
                artAndMemes: 0,
                activity: 0,
                gangActivity: 0,
                other: 0
            };
        }

        // Also reset main points if applicable
        if (user.currentGangId) {
            user.points = 0;
            user.weeklyPoints = 0;
        }

        user.lastWeeklyReset = now;
        await user.save();
    }

    // Reset all gangs' points
    const gangResult = await Gang.updateMany(
        { guildId: guildId },
        {
            $set: {
                // Reset total points
                points: 0,
                totalMemberPoints: 0,
                messageCount: 0,
                pointsBreakdown: {
                    events: 0,
                    competitions: 0,
                    other: 0
                },

                // Reset weekly points
                weeklyPoints: 0,
                weeklyMemberPoints: 0,
                weeklyMessageCount: 0,
                weeklyPointsBreakdown: {
                    events: 0,
                    competitions: 0,
                    other: 0
                },
                lastWeeklyReset: now
            }
        }
    );

    return {
        usersReset: users.length,
        gangsReset: gangResult.modifiedCount,
        timestamp: now
    };
}

/**
 * Reset points for a specific user
 * @param {String} userId - Discord user ID
 * @returns {Promise<Object>} - Updated user object
 */
async function resetUserPoints(userId) {
    const user = await User.findOne({ discordId: userId });

    if (!user) {
        throw new Error('User not found');
    }

    // Reset all gang points
    for (const gangPoints of user.gangPoints) {
        // Reset total points
        gangPoints.points = 0;
        gangPoints.pointsBreakdown = {
            twitter: 0,
            games: 0,
            artAndMemes: 0,
            activity: 0,
            gangActivity: 0,
            other: 0
        };

        // Reset weekly points
        gangPoints.weeklyPoints = 0;
        gangPoints.weeklyPointsBreakdown = {
            twitter: 0,
            games: 0,
            artAndMemes: 0,
            activity: 0,
            gangActivity: 0,
            other: 0
        };
    }

    // Reset main user points
    user.points = 0;
    user.weeklyPoints = 0;

    await user.save();

    // Update gang total points if user has a current gang
    if (user.currentGangId) {
        await updateGangTotalPoints(user.currentGangId);
        await updateGangWeeklyPoints(user.currentGangId);
    }

    return user;
}

/**
 * Tracks a message for activity points
 * @param {Object} message - Discord.js message object
 * @returns {Object|null} Result of the operation, or null if no points were awarded
 */
async function trackMessage(message) {
    try {
        const { guild, author, channel, content } = message;
        const userId = author.id;
        const guildId = guild.id;
        const channelId = channel.id;
        const messageContent = content;

        console.log(`Tracking message from ${author.tag} in channel ${channel.name}`);

        // Get the gang channel IDs from config
        const { gangsConfig } = require('../config/gangs');

        // Find which gang this channel belongs to
        const gangConfig = gangsConfig.find(g => g.channelId.trim() === channelId);

        if (!gangConfig) {
            return null;
        }

        const gangId = gangConfig.gangId;

        // Use findOneAndUpdate to atomically get or create the gang to prevent race conditions
        let gang = await Gang.findOneAndUpdate(
            { gangId },
            {
                $setOnInsert: {
                    guildId,
                    gangId,
                    name: gangConfig.name,
                    roleId: gangConfig.roleId,
                    channelId: gangConfig.channelId
                }
            },
            {
                new: true,
                upsert: true
            }
        );

        // Use findOne with session to prevent race conditions when reading user data
        const session = await mongoose.startSession();
        let result = null;

        try {
            await session.withTransaction(async () => {
                // Check if user exists
                let user = await User.findOne({ discordId: userId }).session(session);

                if (!user) {
                    // Create the user in the database and assign to this gang
                    user = new User({
                        discordId: userId,
                        username: author.username,
                        currentGangId: gangId,
                        currentGangName: gangConfig.name,
                        gangId: gangId,  // For backward compatibility
                        gangName: gangConfig.name,
                        points: 0,
                        weeklyPoints: 0,
                        messageCount: 0,
                        weeklyMessageCount: 0,
                        gangPoints: [{
                            gangId: gangId,
                            gangName: gangConfig.name,
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
                        }],
                        recentMessages: []
                    });
                } else if (user.currentGangId !== gangId) {
                    // Update user's gang
                    user.switchGang(gangId, gangConfig.name);
                }

                // Skip if message is too short or common greeting
                const trimmedContent = messageContent.trim();

                const commonMessages = ['hi', 'hey', 'hello', 'gm', 'good morning', 'gn', 'good night', '.', '..', '...'];
                if (trimmedContent.length < 5 || commonMessages.includes(trimmedContent.toLowerCase())) {
                    return;
                }

                // Check for spam by looking at recent messages
                const now = new Date();
                const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

                // Filter recent messages to only include those from the last 5 minutes
                user.recentMessages = user.recentMessages.filter(msg =>
                    new Date(msg.timestamp) > fiveMinutesAgo
                );

                // Check for duplicate messages to prevent spam
                const isDuplicate = user.recentMessages.some(msg =>
                    msg.content === trimmedContent
                );

                if (isDuplicate) {
                    // Add to recent messages but don't award points
                    user.recentMessages.push({
                        content: trimmedContent,
                        timestamp: now
                    });

                    await user.save({ session });
                    return;
                }

                // Check cooldown - only award points once per 5 minutes
                if (user.lastActive && now - user.lastActive < 5 * 60 * 1000) {
                    await user.save({ session }); // Save the updated recent messages without awarding points
                    return;
                }

                // Add to user's recent messages
                user.recentMessages.push({
                    content: trimmedContent,
                    timestamp: now
                });

                // Award points and update activity timestamp
                user.points += 1;
                user.weeklyPoints += 1;
                user.lastActive = now;
                user.messageCount += 1;
                user.weeklyMessageCount += 1;

                // Update user's points for this gang
                const gangPointsIndex = user.gangPoints.findIndex(g => g.gangId === gangId);
                if (gangPointsIndex >= 0) {
                    user.gangPoints[gangPointsIndex].points += 1;
                    user.gangPoints[gangPointsIndex].weeklyPoints += 1;
                    user.gangPoints[gangPointsIndex].pointsBreakdown.gangActivity += 1;
                    user.gangPoints[gangPointsIndex].weeklyPointsBreakdown.gangActivity += 1;
                } else {
                    // If user doesn't have a record for this gang, create one
                    user.gangPoints.push({
                        gangId: gangId,
                        gangName: gangConfig.name,
                        points: 1,
                        weeklyPoints: 1,
                        pointsBreakdown: {
                            twitter: 0,
                            games: 0,
                            artAndMemes: 0,
                            activity: 0,
                            gangActivity: 1,
                            other: 0
                        },
                        weeklyPointsBreakdown: {
                            twitter: 0,
                            games: 0,
                            artAndMemes: 0,
                            activity: 0,
                            gangActivity: 1,
                            other: 0
                        }
                    });
                }

                // Update gang activity
                await Gang.updateOne(
                    { gangId },
                    {
                        $inc: {
                            messageCount: 1,
                            weeklyMessageCount: 1,
                            totalMemberPoints: 1,
                            weeklyMemberPoints: 1,
                            points: 1,         // Add points to gang's total
                            weeklyPoints: 1    // Add points to gang's weekly total
                        },
                        $set: { lastActive: now }
                    }
                );

                await user.save({ session });

                // Log activity
                await ActivityLog.create([{
                    guildId: guildId,
                    targetType: 'user',
                    targetId: userId,
                    targetName: user.username,
                    action: 'award',
                    reason: 'activity',
                    points: 1,
                    source: 'activity'
                }], { session });

                result = user;
            });

            return result;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error('Error tracking message:', error);
        return null;
    }
}

/**
 * Deletes gangs that are no longer in the config
 */
async function cleanupOldGangs() {
    try {
        const { gangsConfig } = require('../config/gangs');

        // Get all active gang IDs from config
        const activeGangIds = gangsConfig.map(g => g.gangId);

        // Find gangs in the database that aren't in the config
        const gangsToDelete = await Gang.find({ gangId: { $nin: activeGangIds } });

        if (gangsToDelete.length > 0) {
            console.log(`Found ${gangsToDelete.length} gangs to delete: ${gangsToDelete.map(g => g.name).join(', ')}`);

            // Delete gangs that aren't in the config
            const result = await Gang.deleteMany({ gangId: { $nin: activeGangIds } });
            console.log(`Deleted ${result.deletedCount} gangs from the database`);
        } else {
            console.log('No old gangs to delete');
        }
    } catch (error) {
        console.error('Error cleaning up old gangs:', error);
    }
}

module.exports = {
    awardUserPoints,
    awardGangPoints,
    registerUser,
    updateUserGang,
    updateGangTotalPoints,
    updateGangWeeklyPoints,
    updateGangMemberCount,
    getUserLeaderboard,
    getWeeklyUserLeaderboard,
    getGangLeaderboard,
    getWeeklyGangLeaderboard,
    getGangMemberLeaderboard,
    getWeeklyGangMemberLeaderboard,
    resetWeeklyPoints,
    resetAllPoints,
    resetUserPoints,
    trackMessage,
    cleanupOldGangs
}; 