const { User, Gang, ActivityLog } = require('./dbModels');
const { gangsConfig } = require('../config/gangs');
const mongoose = require('mongoose');
const { appendPointLog } = require('./sheetsLogger');

/**
 * Points system module
 * 
 * This module handles awarding points to users and tracking activity.
 * Gang points are now calculated as the sum of all member points
 * rather than being awarded directly to gangs.
 */

/**
 * Award points to a user
 * @param {Object} options - Award options
 * @param {String} options.guildId - Discord server ID
 * @param {String} options.userId - Discord user ID
 * @param {String} options.username - Discord username
 * @param {Number} options.points - Points to award (positive or negative)
 * @param {String} options.source - Source of points (games, art, activity, etc.)
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

    console.log(`Awarding ${options.points} points to user ${options.username} in gang ${user.currentGangName}`);
    console.log(`Before award: User has ${user.points} total points, gang has points across all members`);

    // Map old source categories to new ones
    let mappedSource = options.source;
    if (options.source === 'activity') {
        mappedSource = 'messageActivity';
    } else if (options.source === 'games') {
        mappedSource = 'gamer';
    } else if (options.source === 'gangActivity' || options.source === 'twitter') {
        mappedSource = 'other';
    }

    // Award points to the user's current gang
    const updatedGangPoints = user.addPointsToGang(
        user.currentGangId,
        user.currentGangName,
        options.points,
        mappedSource
    );

    console.log(`User now has ${user.points} total points and ${user.weeklyPoints} weekly points`);
    console.log(`Points awarded in category: ${mappedSource}`);

    // This should update the data in the in-memory database
    await user.save();

    // Create the log data
    const logData = {
        guildId: options.guildId,
        targetType: 'user',
        targetId: options.userId,
        targetName: options.username,
        action: options.points >= 0 ? 'award' : 'deduct',
        points: options.points,
        source: mappedSource,
        awardedBy: options.awardedBy || null,
        awardedByUsername: options.awardedByUsername || null,
        reason: options.reason || null
    };

    // Log the activity in the database
    await ActivityLog.create(logData);

    // Log also to Google Sheets if configured
    if (process.env.GOOGLE_SHEET_ID) {
        appendPointLog(logData, process.env.GOOGLE_SHEET_ID);
    }

    // Force a complete recalculation of gang points
    console.log(`Updating gang ${user.currentGangId} total member points`);
    await updateGangTotalPoints(user.currentGangId);
    await updateGangWeeklyPoints(user.currentGangId);

    // Get the latest user data after updates
    const updatedUser = await User.findOne({ discordId: options.userId });

    // Verify the points were updated correctly
    console.log(`After updates: User ${updatedUser.username} has ${updatedUser.points} total points`);
    console.log('Points breakdown:', updatedUser.gangPoints.find(g => g.gangId === user.currentGangId)?.pointsBreakdown);

    // Get the updated gang to verify
    const gang = await Gang.findOne({ gangId: user.currentGangId });
    if (gang) {
        console.log(`Gang now has ${gang.totalMemberPoints} member points and ${gang.points} gang points`);
    }

    return updatedUser;
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
    try {
        // Calculate sum of all members' points in the gang
        const result = await User.aggregate([
            { $match: { currentGangId: gangId } },
            { $group: { _id: null, totalPoints: { $sum: '$points' }, count: { $sum: 1 } } }
        ]);

        console.log(`Updating gang ${gangId} total points, aggregation result:`, result);

        if (result.length > 0) {
            const totalPoints = result[0].totalPoints || 0;
            const memberCount = result[0].count || 0;

            console.log(`Gang ${gangId} has ${memberCount} members with total ${totalPoints} points`);

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

            // Get the updated gang to verify
            const updatedGang = await Gang.findOne({ gangId: gangId });
            if (updatedGang) {
                console.log(`After update, gang ${gangId} has totalMemberPoints: ${updatedGang.totalMemberPoints}`);
            } else {
                console.log(`Gang ${gangId} not found after update`);
            }
        } else {
            console.log(`No users found in gang ${gangId} or aggregation returned empty result`);

            // Set to 0 if no members found
            await Gang.updateOne(
                { gangId: gangId },
                {
                    $set: {
                        totalMemberPoints: 0,
                        memberCount: 0
                    }
                }
            );
        }
    } catch (error) {
        console.error(`Error updating gang total points for ${gangId}:`, error);
    }
}

/**
 * Update gang's weekly member points
 * @param {String} gangId - Gang ID
 * @returns {Promise<void>}
 */
async function updateGangWeeklyPoints(gangId) {
    try {
        // Calculate sum of all members' weekly points
        const result = await User.aggregate([
            { $match: { currentGangId: gangId } },
            { $group: { _id: null, totalWeeklyPoints: { $sum: '$weeklyPoints' } } }
        ]);

        console.log(`Updating gang ${gangId} weekly points, aggregation result:`, result);

        if (result.length > 0) {
            const totalWeeklyPoints = result[0].totalWeeklyPoints || 0;

            console.log(`Gang ${gangId} has total ${totalWeeklyPoints} weekly points`);

            // Update the gang
            await Gang.updateOne(
                { gangId: gangId },
                { $set: { weeklyMemberPoints: totalWeeklyPoints } }
            );

            // Get the updated gang to verify
            const updatedGang = await Gang.findOne({ gangId: gangId });
            if (updatedGang) {
                console.log(`After update, gang ${gangId} has weeklyMemberPoints: ${updatedGang.weeklyMemberPoints}`);
            } else {
                console.log(`Gang ${gangId} not found after update`);
            }
        } else {
            console.log(`No users found in gang ${gangId} or aggregation returned empty result`);

            // Set to 0 if no members found
            await Gang.updateOne(
                { gangId: gangId },
                {
                    $set: {
                        weeklyMemberPoints: 0
                    }
                }
            );
        }
    } catch (error) {
        console.error(`Error updating gang weekly points for ${gangId}:`, error);
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
    const users = await User.find({ guildId: guildId });

    // Sort manually if .sort() is not available on the returned object
    if (!users.sort) {
        // Create a copy we can sort
        const sortedUsers = [...users].sort((a, b) => b.points - a.points);
        // Handle pagination
        return sortedUsers.slice(skip, skip + limit);
    }

    // If sort is available, use it (MongoDB implementation)
    return users
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
    const users = await User.find({ guildId: guildId });

    // Sort manually if .sort() is not available on the returned object
    if (!users.sort) {
        // Create a copy we can sort
        const sortedUsers = [...users].sort((a, b) => b.weeklyPoints - a.weeklyPoints);
        // Handle pagination
        return sortedUsers.slice(skip, skip + limit);
    }

    // If sort is available, use it (MongoDB implementation)
    return users
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
    const gangs = await Gang.find({ guildId: guildId });

    // Sort manually if .sort() is not available on the returned object
    if (!gangs.sort) {
        // Sort by total member points
        return [...gangs].sort((a, b) => b.totalMemberPoints - a.totalMemberPoints);
    }

    // If sort is available, use it (MongoDB implementation)
    return gangs.sort({ totalMemberPoints: -1 });
}

/**
 * Get weekly gang leaderboard
 * @param {String} guildId - Discord server ID
 * @returns {Promise<Array>} - Array of gangs with weekly stats
 */
async function getWeeklyGangLeaderboard(guildId) {
    const gangs = await Gang.find({ guildId: guildId });

    // Sort manually if .sort() is not available on the returned object
    if (!gangs.sort) {
        // Sort by weekly member points
        return [...gangs].sort((a, b) => b.weeklyMemberPoints - a.weeklyMemberPoints);
    }

    // If sort is available, use it (MongoDB implementation)
    return gangs.sort({ weeklyMemberPoints: -1 });
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
    const users = await User.find({ currentGangId: gangId, points: { $gt: 0 } });

    console.log(`Found ${users.length} users for gang ${gangId}`);

    // Sort manually if .sort() is not available on the returned object
    if (!users.sort) {
        // Create a copy we can sort
        const sortedUsers = [...users].sort((a, b) => b.points - a.points);
        // Handle pagination
        return sortedUsers.slice(skip, skip + limit);
    }

    // If sort is available, use it (MongoDB implementation)
    return users
        .sort({ points: -1 })
        .skip(skip)
        .limit(limit);
}

/**
 * Get weekly gang-specific user leaderboard
 * @param {String} gangId - Gang ID
 * @param {Number} limit - Number of users to return
 * @param {Number} skip - Number of users to skip (for pagination)
 * @returns {Promise<Array>} - Array of top users in the gang for this week
 */
async function getWeeklyGangMemberLeaderboard(gangId, limit = 100, skip = 0) {
    const users = await User.find({ currentGangId: gangId, weeklyPoints: { $gt: 0 } });

    // Sort manually if .sort() is not available on the returned object
    if (!users.sort) {
        // Create a copy we can sort
        const sortedUsers = [...users].sort((a, b) => b.weeklyPoints - a.weeklyPoints);
        // Handle pagination
        return sortedUsers.slice(skip, skip + limit);
    }

    // If sort is available, use it (MongoDB implementation)
    return users
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
 * Tracks a message in a gang channel and awards points to the user and gang.
 * @param {Object} message - The Discord message object
 */
const trackMessage = async (message) => {
    try {
        // Extract info from message
        const userId = message.author.id;
        const author = message.author;
        const channelId = message.channel.id;
        const guildId = message.guild.id;
        const messageContent = message.content;

        // Find the gang by channel ID
        const gangConfig = gangsConfig.find(gang => gang.channelId === channelId);
        if (!gangConfig) {
            return null; // Not a gang channel
        }

        console.log(`Tracking message from ${author.username} in channel ${gangConfig.name}`);
        const gangId = gangConfig.gangId;

        // Create or update the gang in the database
        let gangUpdate = await Gang.findOneAndUpdate(
            { gangId },
            {
                $set: {
                    name: gangConfig.name,
                    guildId,
                    channelId,
                    roleId: gangConfig.roleId,
                }
            },
            {
                new: true,
                upsert: true
            }
        );

        // Check if user exists
        let user = await User.findOne({ discordId: userId });

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
                        games: 0,
                        artAndMemes: 0,
                        activity: 0,
                        gangActivity: 0,
                        other: 0
                    },
                    weeklyPointsBreakdown: {
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
        const tenSecondsAgo = new Date(now.getTime() - 10 * 1000);

        // Filter recent messages to only include those from the last 10 seconds
        user.recentMessages = user.recentMessages.filter(msg =>
            new Date(msg.timestamp) > tenSecondsAgo
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

            await user.save();
            return;
        }

        // Check cooldown - only award points once per 10 seconds
        if (user.lastActive && now - user.lastActive < 10 * 1000) {
            await user.save(); // Save the updated recent messages without awarding points
            return;
        }

        // Add to user's recent messages
        user.recentMessages.push({
            content: trimmedContent,
            timestamp: now
        });

        // Award points and update activity timestamp
        user.lastActive = now;
        user.messageCount = (user.messageCount || 0) + 1;
        user.weeklyMessageCount = (user.weeklyMessageCount || 0) + 1;

        // Update user's points for this gang
        const gangPointsIndex = user.gangPoints.findIndex(g => g.gangId === gangId);
        if (gangPointsIndex >= 0) {
            // Add 1 point to this gang's points
            user.gangPoints[gangPointsIndex].points += 1;
            user.gangPoints[gangPointsIndex].weeklyPoints += 1;
            user.gangPoints[gangPointsIndex].pointsBreakdown.gangActivity += 1;
            user.gangPoints[gangPointsIndex].weeklyPointsBreakdown.gangActivity += 1;

            // Log the current state for debugging
            console.log(`Before update: User ${user.username} has ${user.points} total points`);
            console.log(`Gang points for ${gangConfig.name}: ${user.gangPoints[gangPointsIndex].points}`);

            // If this is the user's current gang, also update their top-level points
            if (gangId === user.currentGangId) {
                const currentPoints = user.points || 0;
                const currentWeeklyPoints = user.weeklyPoints || 0;

                // Increment the user's top-level points instead of setting them
                user.points = currentPoints + 1;
                user.weeklyPoints = currentWeeklyPoints + 1;

                console.log(`After update: User ${user.username} now has ${user.points} total points`);
            }
        } else {
            // If user doesn't have a record for this gang, create one
            user.gangPoints.push({
                gangId: gangId,
                gangName: gangConfig.name,
                points: 1,
                weeklyPoints: 1,
                pointsBreakdown: {
                    games: 0,
                    artAndMemes: 0,
                    activity: 0,
                    gangActivity: 1,
                    other: 0
                },
                weeklyPointsBreakdown: {
                    games: 0,
                    artAndMemes: 0,
                    activity: 0,
                    gangActivity: 1,
                    other: 0
                }
            });

            // If this is the user's current gang, add to their total points
            if (gangId === user.currentGangId) {
                const currentPoints = user.points || 0;
                const currentWeeklyPoints = user.weeklyPoints || 0;

                user.points = currentPoints + 1;
                user.weeklyPoints = currentWeeklyPoints + 1;
            }
        }

        // Update gang activity - only track message counts, not points
        await Gang.updateOne(
            { gangId },
            {
                $inc: {
                    messageCount: 1,          // Track message count
                    weeklyMessageCount: 1     // Track weekly message count
                },
                $set: { lastActive: now }
            }
        );

        // Update the gang to ensure total member points are correctly calculated
        // These functions will calculate the sum of user points correctly
        await updateGangTotalPoints(gangId);
        await updateGangWeeklyPoints(gangId);

        await user.save();

        // Log activity
        await ActivityLog.create({
            guildId: guildId,
            targetType: 'user',
            targetId: userId,
            targetName: user.username,
            action: 'award',
            reason: 'activity',
            points: 1,
            source: 'activity'
        });

        return user;
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

/**
 * Fetch all members of a gang based on their Discord role
 * @param {Object} client - Discord client
 * @param {String} guildId - Discord server ID
 * @param {String} gangId - Gang ID
 * @returns {Promise<Object>} - Results with members and counts
 */
async function fetchGangMembersByRole(client, guildId, gangId) {
    try {
        // Get the gang configuration
        const gangConfig = gangsConfig.find(g => g.gangId === gangId);
        if (!gangConfig) {
            throw new Error(`Gang with ID ${gangId} not found in configuration`);
        }

        // Fetch the guild with force refresh
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error(`Guild with ID ${guildId} not found`);
        }

        console.log(`Working with guild: ${guild.name} (${guild.id})`);

        // Force a fresh fetch of all members
        console.log('Fetching all guild members...');
        await guild.members.fetch({ force: true });
        console.log(`Guild has ${guild.members.cache.size} members in cache after fetch`);

        // Debug info for all roles
        console.log(`Guild has ${guild.roles.cache.size} roles in cache`);
        guild.roles.cache.forEach(role => {
            console.log(`Role: ${role.name} (${role.id}) with ${role.members.size} members`);
        });

        // Get the role ID from config
        const roleId = gangConfig.roleId;
        console.log(`Looking for role with ID: ${roleId}`);

        // Fetch the specific role
        await guild.roles.fetch(roleId, { force: true });
        const role = guild.roles.cache.get(roleId);

        if (!role) {
            console.error(`Role with ID ${roleId} not found for gang ${gangConfig.name}`);
            throw new Error(`Role with ID ${roleId} not found for gang ${gangConfig.name}`);
        }

        console.log(`Found role: ${role.name} (${role.id}) with ${role.members.size} members`);

        // Get members with this role
        const members = Array.from(role.members.values()).map(member => ({
            id: member.user.id,
            username: member.user.username || member.displayName,
            displayName: member.displayName,
            isRegistered: false
        }));

        console.log(`Extracted ${members.length} members with role ${role.name}`);

        // Register or update all members found
        for (const member of members) {
            console.log(`Processing member: ${member.username} (${member.id})`);

            try {
                // Check if user already exists
                let user = await User.findOne({ discordId: member.id });

                if (user) {
                    console.log(`User ${member.username} already exists in database, updating gang if needed`);

                    // Update gang if different
                    if (user.currentGangId !== gangId) {
                        console.log(`Updating ${member.username}'s gang from ${user.currentGangName} to ${gangConfig.name}`);
                        user.currentGangId = gangId;
                        user.currentGangName = gangConfig.name;
                        user.gangId = gangId; // For backward compatibility
                        user.gangName = gangConfig.name;

                        // Check if the user has gang points for this gang
                        const existingGangPoints = user.gangPoints.find(gp => gp.gangId === gangId);
                        if (!existingGangPoints) {
                            user.gangPoints.push({
                                gangId,
                                gangName: gangConfig.name,
                                points: 0,
                                weeklyPoints: 0,
                                pointsBreakdown: {
                                    games: 0,
                                    artAndMemes: 0,
                                    activity: 0,
                                    gangActivity: 0,
                                    other: 0
                                },
                                weeklyPointsBreakdown: {
                                    games: 0,
                                    artAndMemes: 0,
                                    activity: 0,
                                    gangActivity: 0,
                                    other: 0
                                }
                            });
                        }

                        await user.save();
                    }
                } else {
                    // Create new user in database
                    console.log(`Creating new user ${member.username} (${member.id}) in gang ${gangConfig.name}`);
                    user = new User({
                        discordId: member.id,
                        username: member.username,
                        currentGangId: gangId,
                        currentGangName: gangConfig.name,
                        gangId,
                        gangName: gangConfig.name,
                        points: 0,
                        weeklyPoints: 0,
                        gangPoints: [{
                            gangId,
                            gangName: gangConfig.name,
                            points: 0,
                            weeklyPoints: 0,
                            pointsBreakdown: {
                                games: 0,
                                artAndMemes: 0,
                                activity: 0,
                                gangActivity: 0,
                                other: 0
                            },
                            weeklyPointsBreakdown: {
                                games: 0,
                                artAndMemes: 0,
                                activity: 0,
                                gangActivity: 0,
                                other: 0
                            }
                        }]
                    });

                    await user.save();
                }
            } catch (memberError) {
                console.error(`Error processing member ${member.username}:`, memberError);
            }
        }

        // Update gang stats
        const gang = await Gang.findOne({ gangId });
        if (gang) {
            gang.memberCount = members.length;
            await gang.save();

            // Recalculate gang points
            await updateGangTotalPoints(gangId);
            await updateGangWeeklyPoints(gangId);
        }

        return {
            gangId,
            gangName: gangConfig.name,
            memberCount: members.length,
            members
        };
    } catch (error) {
        console.error(`Error in fetchGangMembersByRole for ${gangId}:`, error);
        throw error;
    }
}

module.exports = {
    awardUserPoints,
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
    cleanupOldGangs,
    fetchGangMembersByRole
}; 