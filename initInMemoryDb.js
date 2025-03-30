/**
 * Initialize the in-memory database with test data
 * This script is used for development when MongoDB is not available
 */

const inMemoryDb = require('./utils/inMemoryDb');
const { gangsConfig } = require('./config/gangs');
require('dotenv').config();

async function initInMemoryDb() {
    console.log('Initializing in-memory database with test data...');

    // Set up globals for the database models
    global.User = inMemoryDb.User;
    global.Gang = inMemoryDb.Gang;
    global.ActivityLog = inMemoryDb.ActivityLog;

    // Step 1: Create gangs based on configuration
    console.log('Creating gangs...');
    for (const gangConfig of gangsConfig) {
        const gang = await inMemoryDb.Gang.create({
            gangId: gangConfig.gangId,
            name: gangConfig.name,
            guildId: process.env.GUILD_ID,
            channelId: gangConfig.channelId,
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

        console.log(`Created gang: ${gang.name}`);
    }

    // Step 2: Create a few test users
    console.log('Creating test users...');
    const testUsers = [
        {
            discordId: '123456789',
            username: 'TestUser1',
            currentGangId: gangsConfig[0].gangId,
            currentGangName: gangsConfig[0].name
        },
        {
            discordId: '987654321',
            username: 'TestUser2',
            currentGangId: gangsConfig[1].gangId,
            currentGangName: gangsConfig[1].name
        }
    ];

    for (const userData of testUsers) {
        const user = await inMemoryDb.User.create({
            discordId: userData.discordId,
            username: userData.username,
            currentGangId: userData.currentGangId,
            currentGangName: userData.currentGangName,
            gangId: userData.currentGangId,  // For backward compatibility
            gangName: userData.currentGangName,
            points: 0,
            weeklyPoints: 0,
            gangPoints: [{
                gangId: userData.currentGangId,
                gangName: userData.currentGangName,
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

        console.log(`Created user: ${user.username}`);
    }

    console.log('In-memory database initialized successfully!');
}

// Call the initialization function
initInMemoryDb().then(() => {
    console.log('Initialization complete!');
}).catch(err => {
    console.error('Error initializing in-memory database:', err);
}); 