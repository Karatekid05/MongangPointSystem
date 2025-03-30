const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { awardUserPoints } = require('../utils/pointsManager');
const { User } = require('../utils/dbModels');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removepoints')
        .setDescription('Remove points from a user (For staff only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove points from')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('points')
                .setDescription('The number of points to remove (positive value)')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('source')
                .setDescription('Source of the points')
                .setRequired(true)
                .addChoices(
                    { name: 'Games', value: 'games' },
                    { name: 'Art & Memes', value: 'artAndMemes' },
                    { name: 'Discord Activity', value: 'activity' },
                    { name: 'Gang Activity', value: 'gangActivity' },
                    { name: 'Other', value: 'other' }
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for removing points (optional)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const targetUser = interaction.options.getUser('user');
            const pointsToRemove = interaction.options.getInteger('points');
            const source = interaction.options.getString('source');
            const reason = interaction.options.getString('reason') || 'Correction';

            // Check if user exists
            const user = await User.findOne({ discordId: targetUser.id });

            if (!user) {
                return interaction.editReply(`${targetUser.username} is not registered in the points system.`);
            }

            // Convert to negative value for deduction
            const negativePoints = -Math.abs(pointsToRemove);

            // Award negative points (same as removing points)
            await awardUserPoints({
                guildId: guildId,
                userId: targetUser.id,
                username: targetUser.username,
                points: negativePoints,
                source: source,
                awardedBy: interaction.user.id,
                awardedByUsername: interaction.user.username,
                reason: reason
            });

            // Get updated points for the user
            const updatedUser = await User.findOne({ discordId: targetUser.id });

            return interaction.editReply(`Removed ${pointsToRemove} points from ${targetUser.username} for ${source} (${reason}). Their new total is ${updatedUser.points} points.`);

        } catch (error) {
            console.error('Error in remove command:', error);
            return interaction.editReply('There was an error removing points.');
        }
    }
}; 