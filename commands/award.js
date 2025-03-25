const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { awardUserPoints, awardGangPoints, updateUserGang } = require('../utils/pointsManager');
const { gangsConfig } = require('../config/gangs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('award')
        .setDescription('Award points to a user or gang')
        .addStringOption(option =>
            option.setName('target')
                .setDescription('Target type (user or gang)')
                .setRequired(true)
                .addChoices(
                    { name: 'User', value: 'user' },
                    { name: 'Gang', value: 'gang' }
                ))
        .addIntegerOption(option =>
            option.setName('points')
                .setDescription('Number of points to award (use negative for deductions)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('source')
                .setDescription('Source of the points')
                .setRequired(true)
                .addChoices(
                    { name: 'Twitter', value: 'twitter' },
                    { name: 'Games', value: 'games' },
                    { name: 'Art & Memes', value: 'artAndMemes' },
                    { name: 'Activity', value: 'activity' },
                    { name: 'Events', value: 'events' },
                    { name: 'Competitions', value: 'competitions' },
                    { name: 'Other', value: 'other' }
                ))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to award points to (only for user target)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('gang')
                .setDescription('Gang to award points to (only for gang target)')
                .setAutocomplete(true)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const target = interaction.options.getString('target');

        // Only show gang autocomplete if target is gang and gang option is focused
        if (target !== 'gang' || focusedOption.name !== 'gang') {
            return interaction.respond([]);
        }

        const focusedValue = focusedOption.value.toLowerCase();

        // Get gang choices from the configuration
        const choices = gangsConfig.map(gang => ({
            name: gang.name,
            value: gang.gangId
        }));

        // Filter based on user input
        const filtered = choices.filter(choice =>
            choice.name.toLowerCase().includes(focusedValue));

        // Respond with filtered choices
        await interaction.respond(
            filtered.map(choice => ({ name: choice.name, value: choice.value }))
        );
    },

    async execute(interaction) {
        // Get options
        const target = interaction.options.getString('target');
        const points = interaction.options.getInteger('points');
        const source = interaction.options.getString('source');

        // Defer the reply
        await interaction.deferReply();

        try {
            // Award points based on target type
            if (target === 'user') {
                await awardPointsToUser(interaction, points, source);
            } else if (target === 'gang') {
                await awardPointsToGang(interaction, points, source);
            } else {
                return interaction.editReply('Invalid target type. Please use "user" or "gang".');
            }
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
 */
async function awardPointsToUser(interaction, points, source) {
    const targetUser = interaction.options.getUser('user');

    if (!targetUser) {
        return interaction.editReply('You must specify a user when awarding points to a user.');
    }

    // Get the user's roles
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
        return interaction.editReply(`User ${targetUser.username} is not in this server.`);
    }

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

    return interaction.editReply(
        `${Math.abs(points)} ${pointsText} ${action} to ${targetUser} in **${updatedUser.currentGangName}** for ${sourceText}.\n` +
        `They now have ${updatedUser.points} total points (${updatedUser.weeklyPoints} this week).`
    );
}

/**
 * Award points to a gang
 * @param {Object} interaction - Discord interaction
 * @param {Number} points - Points to award
 * @param {String} source - Source of points
 */
async function awardPointsToGang(interaction, points, source) {
    const gangId = interaction.options.getString('gang');

    if (!gangId) {
        return interaction.editReply('You must specify a gang when awarding points to a gang.');
    }

    // Find the gang name in config
    const gangName = gangsConfig.find(g => g.gangId === gangId)?.name;

    if (!gangName) {
        return interaction.editReply(`Gang with ID ${gangId} not found.`);
    }

    // Award points
    const updatedGang = await awardGangPoints({
        guildId: interaction.guild.id,
        gangId: gangId,
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

    return interaction.editReply(
        `${Math.abs(points)} ${pointsText} ${action} to **${updatedGang.name}** for ${sourceText}.\n` +
        `They now have ${updatedGang.points} total gang points (${updatedGang.weeklyPoints} this week).`
    );
}

/**
 * Format source text for display
 * @param {String} source - Source code
 * @returns {String} - Formatted source text
 */
function formatSourceText(source) {
    switch (source) {
        case 'twitter':
            return 'Twitter engagement';
        case 'games':
            return 'participation in games';
        case 'artAndMemes':
            return 'art & memes contribution';
        case 'activity':
            return 'server activity';
        case 'events':
            return 'participation in events';
        case 'competitions':
            return 'competition results';
        case 'other':
            return 'other contributions';
        default:
            return source;
    }
} 