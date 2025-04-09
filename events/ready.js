const { Client } = require('discord.js');
const { gangsConfig } = require('../config/gangs');
const { Gang } = require('../utils/dbModels');
const batchProcessor = require('../utils/batchProcessor');

module.exports = {
    name: 'ready',
    once: true,
    /**
     * @param {Client} client
     */
    async execute(client) {
        console.log('Ready! Logged in as ' + client.user.tag);
        client.user.setActivity('with points', { type: 'PLAYING' });

        // Initialize scheduled tasks
        console.log('Initializing scheduled tasks...');
        require('../utils/scheduler').initializeScheduledTasks(client);
        console.log('Initializing scheduled tasks');

        // Log the number of servers the bot is in
        console.log(`Bot is in ${client.guilds.cache.size} servers`);

        try {
            // Initialize gangs in MongoDB
            console.log('Initializing gangs in MongoDB...');
            const gangBulkOps = gangsConfig.map(gang => ({
                updateOne: {
                    filter: { roleId: gang.roleId },
                    update: {
                        $set: {
                            name: gang.name,
                            roleId: gang.roleId,
                            members: [],
                            totalPoints: 0,
                            weeklyPoints: 0
                        }
                    },
                    upsert: true
                }
            }));

            await Gang.bulkWrite(gangBulkOps);
            console.log('Gang initialization complete');

            // Sync gang members
            console.log('Starting gang member sync...');
            const guild = client.guilds.cache.get(process.env.GUILD_ID);
            if (!guild) {
                console.error('Guild not found');
                return;
            }

            // Fetch all members
            await guild.members.fetch();
            console.log(`Fetched ${guild.members.cache.size} members`);

            // Add all members to the processor
            guild.members.cache.forEach(member => {
                batchProcessor.addToQueue(member);
            });

            // Process all members at once
            await batchProcessor.processAllMembers();
            console.log('Member processing completed');

        } catch (error) {
            console.error('Error in ready event:', error);
        }
    }
}; 