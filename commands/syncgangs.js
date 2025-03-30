const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { gangsConfig } = require('../config/gangs');
const { fetchGangMembersByRole, updateGangTotalPoints, updateGangWeeklyPoints } = require('../utils/pointsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('syncgangs')
        .setDescription('Synchronize all gang members based on Discord roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            let syncResults = [];

            // Process all gangs defined in config
            for (const gang of gangsConfig) {
                try {
                    console.log(`Syncing gang ${gang.name} (${gang.gangId})`);

                    // Fetch members with the gang role and register them if needed
                    const gangMembers = await fetchGangMembersByRole(
                        interaction.client,
                        interaction.guild.id,
                        gang.gangId
                    );

                    // Update points calculations
                    await updateGangTotalPoints(gang.gangId);
                    await updateGangWeeklyPoints(gang.gangId);

                    syncResults.push(`✅ ${gang.name}: Synced ${gangMembers.memberCount} members`);
                } catch (error) {
                    console.error(`Error syncing gang ${gang.name}:`, error);
                    syncResults.push(`❌ ${gang.name}: Error - ${error.message}`);
                }
            }

            // Send the results
            await interaction.editReply({
                content: `# Gang Synchronization Complete\n${syncResults.join('\n')}`,
                ephemeral: false
            });

        } catch (error) {
            console.error('Error in syncgangs command:', error);
            await interaction.editReply({
                content: 'There was an error synchronizing gangs: ' + error.message,
                ephemeral: true
            });
        }
    }
}; 