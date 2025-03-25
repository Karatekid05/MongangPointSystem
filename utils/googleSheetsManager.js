const { google } = require('googleapis');
const TwitterMapping = require('../models/TwitterMapping');
const { awardUserPoints } = require('./pointsManager');
const User = require('../models/User');

// Configure the Google Sheets API
const sheetsAuth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });

/**
 * Fetch Twitter engagement data from Engage Bot's Google Sheet
 * @returns {Promise<Array>} Array of engagement data rows
 */
async function fetchEngageBotData() {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID;

        // Typically Engage Bot puts the data in the first sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Sheet1', // Adjust based on Engage Bot's sheet name
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            throw new Error('No data found in the Engage Bot spreadsheet');
        }

        // Get header row to determine column indices
        const headers = rows[0];

        // Find indices of important columns
        const twitterUsernameIndex = headers.findIndex(h =>
            h.toLowerCase().includes('twitter') || h.toLowerCase().includes('username'));
        const engagementCountIndex = headers.findIndex(h =>
            h.toLowerCase().includes('engagement') || h.toLowerCase().includes('score') || h.toLowerCase().includes('points'));

        if (twitterUsernameIndex === -1 || engagementCountIndex === -1) {
            throw new Error('Could not find Twitter username or engagement columns in the spreadsheet');
        }

        // Convert rows to structured data, skipping header row
        return rows.slice(1).map(row => {
            // Clean up Twitter username (removing @ if present)
            let twitterUsername = row[twitterUsernameIndex] || '';
            twitterUsername = twitterUsername.replace('@', '').trim();

            return {
                twitterUsername,
                engagementCount: parseInt(row[engagementCountIndex] || '0', 10) || 0
            };
        }).filter(item => item.twitterUsername && item.engagementCount > 0);

    } catch (error) {
        console.error('Error fetching Engage Bot data:', error);
        throw error;
    }
}

/**
 * Calculate points to award based on engagement deltas
 * @param {Number} prevEngagement - Previous engagement count
 * @param {Number} currentEngagement - Current engagement count
 * @returns {Number} - Points to award
 */
function calculatePointsFromEngagement(prevEngagement, currentEngagement) {
    const engagementDelta = Math.max(0, currentEngagement - prevEngagement);

    // Define the point conversion logic
    // You can adjust this formula based on your needs
    // Example: 1 point per 5 engagement actions
    const pointConversionRate = 0.2; // 1 point per 5 engagements
    return Math.floor(engagementDelta * pointConversionRate);
}

/**
 * Sync Twitter engagement points from Engage Bot data
 * @param {String} guildId - Discord guild ID
 * @returns {Promise<Object>} - Summary of sync results
 */
async function syncTwitterEngagementPoints(guildId) {
    try {
        // Fetch Twitter data from Engage Bot's sheet
        const engageBotData = await fetchEngageBotData();

        // Get all Twitter mappings
        const twitterMappings = await TwitterMapping.find({ verified: true });

        const results = {
            totalUsersProcessed: 0,
            totalPointsAwarded: 0,
            usersWithPoints: [],
            errors: []
        };

        // Process each mapping
        for (const mapping of twitterMappings) {
            try {
                // Find the engagement data for this Twitter user
                const engagementData = engageBotData.find(d =>
                    d.twitterUsername.toLowerCase() === mapping.twitterUsername.toLowerCase()
                );

                if (!engagementData) continue;

                // Get the user
                const user = await User.findOne({ discordId: mapping.discordId });
                if (!user) {
                    results.errors.push(`User not found: ${mapping.discordUsername} (${mapping.discordId})`);
                    continue;
                }

                // Calculate points to award based on delta from last sync
                const currentEngagement = engagementData.engagementCount;
                const previousEngagement = mapping.lastEngagementCount || 0;
                const pointsToAward = calculatePointsFromEngagement(previousEngagement, currentEngagement);

                if (pointsToAward <= 0) continue;

                // Award points to the user
                await awardUserPoints({
                    guildId,
                    userId: mapping.discordId,
                    username: user.username,
                    points: pointsToAward,
                    source: 'twitter',
                    reason: 'Twitter engagement via Engage Bot'
                });

                // Update the mapping with new engagement count and sync time
                mapping.lastEngagementCount = currentEngagement;
                mapping.lastSyncedAt = new Date();
                mapping.totalPointsAwarded += pointsToAward;
                await mapping.save();

                // Track results
                results.totalUsersProcessed++;
                results.totalPointsAwarded += pointsToAward;
                results.usersWithPoints.push({
                    username: user.username,
                    twitterUsername: mapping.twitterUsername,
                    pointsAwarded: pointsToAward,
                    newTotal: user.points
                });
            } catch (error) {
                results.errors.push(`Error processing user ${mapping.discordUsername}: ${error.message}`);
            }
        }

        return results;

    } catch (error) {
        console.error('Error syncing Twitter engagement points:', error);
        throw error;
    }
}

/**
 * Link a Discord user to a Twitter username
 * @param {Object} options - Options for linking
 * @param {String} options.discordId - Discord user ID
 * @param {String} options.discordUsername - Discord username
 * @param {String} options.twitterUsername - Twitter username (without @)
 * @returns {Promise<Object>} - The created mapping
 */
async function linkTwitterAccount(options) {
    // Clean up Twitter username
    let twitterUsername = options.twitterUsername.replace('@', '').trim();

    // Check if this Twitter account is already linked to someone else
    const existingMapping = await TwitterMapping.findOne({
        twitterUsername: twitterUsername
    });

    if (existingMapping && existingMapping.discordId !== options.discordId) {
        throw new Error(`This Twitter account is already linked to ${existingMapping.discordUsername}`);
    }

    // Create or update the mapping
    let mapping = await TwitterMapping.findOne({ discordId: options.discordId });

    if (mapping) {
        mapping.twitterUsername = twitterUsername;
        mapping.discordUsername = options.discordUsername;
        mapping.verified = true;
    } else {
        mapping = new TwitterMapping({
            discordId: options.discordId,
            discordUsername: options.discordUsername,
            twitterUsername: twitterUsername,
            verified: true
        });
    }

    await mapping.save();

    // Update the user's twitterUsername field
    await User.updateOne(
        { discordId: options.discordId },
        { $set: { twitterUsername: twitterUsername } }
    );

    return mapping;
}

module.exports = {
    fetchEngageBotData,
    syncTwitterEngagementPoints,
    linkTwitterAccount
}; 