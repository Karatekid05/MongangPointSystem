require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Create the Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// Force the cache settings manually
client.options.fetchAllMembers = true;
client.options.cacheGuilds = true;
client.options.cachePresences = true;
client.options.cacheRoles = true;

// Collections for commands and event handlers
client.commands = new Collection();
client.buttons = new Collection();

// Initialize in-memory database
console.log('Setting up in-memory database for development...');
const inMemoryDb = require('./utils/inMemoryDb');

// Set global variables for the in-memory database
global.User = inMemoryDb.User;
global.Gang = inMemoryDb.Gang;
global.ActivityLog = inMemoryDb.ActivityLog;

// Initialize the in-memory database with test data
console.log('Initializing in-memory database...');
const { gangsConfig } = require('./config/gangs');

// Create gangs in memory
(async () => {
    console.log('Creating gangs...');
    for (const gangConfig of gangsConfig) {
        await inMemoryDb.Gang.create({
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
        console.log(`Created gang: ${gangConfig.name}`);
    }

    // Note: Test users creation has been removed to prevent cluttering the database
})();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing required properties.`);
        }
    }
}

// Load all events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

// Create a Set to track which events we've already registered
const registeredEvents = new Set();

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    // Skip if we've already registered this event
    if (registeredEvents.has(event.name)) {
        console.log(`[WARNING] Skipping duplicate event handler for ${event.name} from ${file}`);
        continue;
    }

    // Register the event
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }

    // Mark this event as registered
    registeredEvents.add(event.name);
    console.log(`Registered event handler: ${event.name} from ${file}`);
}

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
}); 