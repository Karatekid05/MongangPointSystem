require('dotenv').config();
const mongoose = require('mongoose');
const { gangsConfig } = require('./config/gangs');
const User = require('./models/User');
const Gang = require('./models/Gang');
const ActivityLog = require('./models/ActivityLog');

async function resetDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            connectTimeoutMS: 30000,
            socketTimeoutMS: 30000,
            serverSelectionTimeoutMS: 30000
        });
        console.log('Connected to MongoDB');

        // Step 1: Delete all users
        console.log('Deleting all users...');
        const usersResult = await User.deleteMany({});
        console.log(`Deleted ${usersResult.deletedCount} users`);

        // Step 2: Delete all activity logs
        console.log('Deleting all activity logs...');
        const logsResult = await ActivityLog.deleteMany({});
        console.log(`Deleted ${logsResult.deletedCount} activity logs`);

        // Step 3: Reset gang statistics but keep their configurations
        console.log('Resetting gang statistics...');

        // Get all gangs from the database
        const gangs = await Gang.find({});

        for (const gang of gangs) {
            // Reset all counters and statistics
            gang.points = 0;
            gang.weeklyPoints = 0;
            gang.totalMemberPoints = 0;
            gang.weeklyMemberPoints = 0;
            gang.memberCount = 0;
            gang.messageCount = 0;
            gang.weeklyMessageCount = 0;
            gang.pointsBreakdown = {
                events: 0,
                competitions: 0,
                other: 0
            };
            gang.weeklyPointsBreakdown = {
                events: 0,
                competitions: 0,
                other: 0
            };

            await gang.save();
        }
        console.log(`Reset statistics for ${gangs.length} gangs`);

        // Step 4: Make sure all configured gangs exist in the database
        console.log('Ensuring all configured gangs exist in the database...');

        for (const gangConfig of gangsConfig) {
            const existingGang = await Gang.findOne({ gangId: gangConfig.gangId });

            if (!existingGang) {
                // Create the gang if it doesn't exist
                const newGang = new Gang({
                    gangId: gangConfig.gangId,
                    name: gangConfig.name,
                    guildId: process.env.GUILD_ID,
                    channelId: gangConfig.channelId || ' ',  // Space to avoid validation error
                    roleId: gangConfig.roleId,
                    points: 0,
                    weeklyPoints: 0,
                    memberCount: 0,
                    totalMemberPoints: 0,
                    weeklyMemberPoints: 0,
                    messageCount: 0,
                    weeklyMessageCount: 0,
                    pointsBreakdown: {
                        events: 0,
                        competitions: 0,
                        other: 0
                    },
                    weeklyPointsBreakdown: {
                        events: 0,
                        competitions: 0,
                        other: 0
                    }
                });

                await newGang.save();
                console.log(`Created gang: ${gangConfig.name}`);
            }
        }

        console.log('Database reset complete!');
    } catch (error) {
        console.error('Error resetting database:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Disconnected from MongoDB');
    }
}

resetDatabase(); 