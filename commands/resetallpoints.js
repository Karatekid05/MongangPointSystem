const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { resetAllPoints } = require('../utils/pointsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetallpoints')
        .setDescription('Reset all points for all users and gangs')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const result = await resetAllPoints(interaction.guild.id);

            return interaction.editReply(
                `Successfully reset points for ${result.usersReset} users and ${result.gangsReset} gangs.\n` +
                `Reset completed at: ${result.timestamp.toLocaleString()}`
            );
        } catch (error) {
            console.error('Error in resetallpoints command:', error);
            return interaction.editReply({
                content: `Error resetting points: ${error.message}`,
                ephemeral: true
            });
        }
    }
}; 