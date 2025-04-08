const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { awardUserPoints, updateUserGang } = require('../utils/pointsManager');
const { gangsConfig } = require('../config/gangs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('award')
        .setDescription('Award points to a user')
        .addIntegerOption(option =>
            option.setName('points')
                .setDescription('Number of points to award (use negative for deductions)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('source')
                .setDescription('Source of the points')
                .setRequired(true)
                .addChoices(
                    { name: 'Message Activity', value: 'messageActivity' },
                    { name: 'Gamer', value: 'gamer' },
                    { name: 'Art & Memes', value: 'artAndMemes' },
                    { name: 'Other', value: 'other' }
                ))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to award points to')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        // Get options
        const points = interaction.options.getInteger('points');
        const source = interaction.options.getString('source');
        const targetUser = interaction.options.getUser('user');

        // Defer the reply
        await interaction.deferReply();

        try {
            await awardPointsToUser(interaction, points, source, targetUser);
        } catch (error) {
            console.error('Error in award command:', error);
            return interaction.editReply({ content: `Error: ${error.message}`, ephemeral: true });
        }
    }
};

/**
 * Award points to a user
 * @param {Object} interaction - Discord interaction
 * @param {Number} points - Points to award
 * @param {String} source - Source of points
 * @param {Object} targetUser - Target user object
 */
async function awardPointsToUser(interaction, points, source, targetUser) {
    // Get the user's roles
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
        return interaction.editReply(`User ${targetUser.username} is not in this server.`);
    }

    console.log(`Awarding points to user ${targetUser.username}`);
    console.log(`Points: ${points}`);
    console.log(`Source category: ${source}`);

    // First, ensure the user is registered with the correct gang
    await updateUserGang({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        username: targetUser.username,
        roles: member.roles.cache.map(r => r.id)
    });

    // Award points
    const updatedUser = await awardUserPoints({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        username: targetUser.username,
        points: points,
        source: source,
        awardedBy: interaction.user.id,
        awardedByUsername: interaction.user.username,
        reason: 'Command award'
    });

    // Format response
    const action = points >= 0 ? 'awarded' : 'deducted';
    const pointsText = Math.abs(points) === 1 ? 'point' : 'points';
    const sourceText = formatSourceText(source);

    console.log(`Points ${action} successfully`);
    console.log(`User now has ${updatedUser.points} total points`);
    console.log('Points breakdown:', updatedUser.gangPoints.find(g => g.gangId === updatedUser.currentGangId)?.pointsBreakdown);

    return interaction.editReply(
        `${Math.abs(points)} ${pointsText} ${action} to ${targetUser} in **${updatedUser.currentGangName}** for ${sourceText}.\n` +
        `They now have ${updatedUser.points} total points (${updatedUser.weeklyPoints} this week).`
    );
}

/**
 * Format source text for display
 * @param {String} source - Source code
 * @returns {String} - Formatted source text
 */
function formatSourceText(source) {
    switch (source) {
        case 'messageActivity':
            return 'Message Activity';
        case 'gamer':
            return 'Gamer';
        case 'artAndMemes':
            return 'Art & Memes';
        case 'other':
            return 'Other';
        default:
            return source;
    }
} 