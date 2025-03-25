module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Set bot activity to display help command
        client.user.setActivity('/help', { type: 'WATCHING' });

        // Additional startup tasks can go here
        console.log(`Bot is in ${client.guilds.cache.size} servers`);
    }
}; 