const { gangsConfig } = require('../config/gangs');
const { fetchGangMembersByRole, updateGangTotalPoints, updateGangWeeklyPoints } = require('../utils/pointsManager');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Set bot activity to display help command
        client.user.setActivity('/help', { type: 'WATCHING' });

        // Additional startup tasks can go here
        console.log(`Bot is in ${client.guilds.cache.size} servers`);
        console.log('Using in-memory database for development');

        // Sync all gang members on startup
        try {
            console.log('Starting automatic gang member synchronization...');
            const guild = client.guilds.cache.first();

            if (!guild) {
                console.log('No guild found to synchronize members');
                return;
            }

            console.log(`Found guild: ${guild.name} (${guild.id})`);

            // Process each gang in configuration
            for (const gang of gangsConfig) {
                try {
                    console.log(`Syncing gang ${gang.name} (${gang.gangId})`);

                    // Fetch all members with the gang role
                    const gangMembers = await fetchGangMembersByRole(
                        client,
                        guild.id,
                        gang.gangId
                    );

                    console.log(`Synced ${gangMembers.memberCount} members for ${gang.name}`);

                    // Update points calculations
                    await updateGangTotalPoints(gang.gangId);
                    await updateGangWeeklyPoints(gang.gangId);
                } catch (error) {
                    console.error(`Error syncing gang ${gang.name}:`, error.message);
                }
            }

            console.log('Automatic gang member synchronization complete');
        } catch (error) {
            console.error('Error during automatic gang synchronization:', error);
        }
    }
};