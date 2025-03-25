require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { initScheduledTasks } = require('./utils/scheduledTasks');
const {
    resetWeeklyPoints,
    cleanupOldGangs
} = require('./utils/pointsManager');

// Create the Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// Collections for commands and event handlers
client.commands = new Collection();
client.buttons = new Collection();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        // Initialize scheduled tasks after database connection is established
        initScheduledTasks(client);
    })
    .catch(err => console.error('MongoDB connection error:', err));

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
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// When the client is ready, run this code (only once)
client.once('ready', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // Log server count
    console.log(`Bot is in ${client.guilds.cache.size} servers`);

    // Initialize scheduled tasks
    console.log('Initializing scheduled tasks');
    initScheduledTasks(client);

    // Clean up old gangs from the database
    console.log('Cleaning up old gangs from database');
    await cleanupOldGangs();
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
}); 