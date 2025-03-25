const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { getGangMemberLeaderboard, getGangLeaderboard, getUserLeaderboard } = require('../utils/pointsManager');
const User = require('../models/User');
const Gang = require('../models/Gang');
const { gangsConfig } = require('../config/gangs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the points leaderboard')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of leaderboard to view')
                .setRequired(true)
                .addChoices(
                    { name: 'Members', value: 'members' },
                    { name: 'Gangs', value: 'gangs' },
                    { name: 'Specific Gang', value: 'specific' }
                ))
        .addStringOption(option =>
            option.setName('gang')
                .setDescription('Select a specific gang (only for "Specific Gang" type)')
                .setAutocomplete(true)
                .setRequired(false)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const type = interaction.options.getString('type');

        // Only show gang autocomplete if the type is 'specific'
        if (type !== 'specific') {
            return interaction.respond([]);
        }

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
        const type = interaction.options.getString('type');
        const gangId = interaction.options.getString('gang');

        // For specific type, gang is required
        if (type === 'specific' && !gangId) {
            return interaction.reply({ content: 'Please select a specific gang using the gang option.', ephemeral: true });
        }

        // Defer the reply as this might take a moment
        await interaction.deferReply();

        try {
            switch (type) {
                case 'gangs':
                    // Show gang leaderboard
                    await showGangLeaderboard(interaction);
                    break;
                case 'specific':
                    // Show gang-specific leaderboard
                    await showLeaderboard(interaction, gangId);
                    break;
                case 'members':
                default:
                    // Show server-wide leaderboard
                    await showLeaderboard(interaction, null);
                    break;
            }
        } catch (error) {
            console.error('Error in leaderboard command:', error);
            return interaction.editReply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
};

/**
 * Show user leaderboard for a specific gang or the entire server
 * @param {Object} interaction - Discord interaction
 * @param {String} gangId - Gang ID (null for server-wide)
 */
async function showLeaderboard(interaction, gangId) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    try {
        let users = [];
        let totalUsers = 0;
        let userRank = 0;
        let userPoints = 0;
        let title = 'Server Leaderboard';
        let description = 'Top members by total points:';

        if (gangId) {
            console.log(`Finding gang with gangId: ${gangId}`);

            // Get the gang
            const gang = await Gang.findOne({ gangId });

            if (!gang) {
                // Try finding the gang by name
                let gangName = gangsConfig.find(g => g.gangId === gangId)?.name;
                console.log(`Gang name from config: ${gangName}`);

                if (!gangName) {
                    return interaction.editReply(`Gang not found with ID: ${gangId}`);
                }

                title = `${gangName} Leaderboard`;
                description = `Top members in ${gangName}:`;
            } else {
                title = `${gang.name} Leaderboard`;
                description = `Top members in ${gang.name}:`;
            }

            // Count total users in the gang with points
            totalUsers = await User.countDocuments({
                currentGangId: gangId,
                points: { $gt: 0 }
            });

            // Get top 10 users
            users = await getGangMemberLeaderboard(gangId, 10, 0);

            // Find the user's rank and points
            const userEntry = await User.findOne({ discordId: userId, currentGangId: gangId });
            if (userEntry && userEntry.points > 0) {
                // Count how many users have more points than this user
                userRank = await User.countDocuments({
                    currentGangId: gangId,
                    points: { $gt: userEntry.points }
                }) + 1; // +1 because ranks start at 1
                userPoints = userEntry.points;
            }
        } else {
            // Count total users in the server with points
            totalUsers = await User.countDocuments({
                points: { $gt: 0 }
            });

            // Get top 10 users
            users = await getUserLeaderboard(guildId, 10, 0);

            // Find the user's rank and points
            const userEntry = await User.findOne({ discordId: userId });
            if (userEntry && userEntry.points > 0) {
                // Count how many users have more points than this user
                userRank = await User.countDocuments({
                    points: { $gt: userEntry.points }
                }) + 1; // +1 because ranks start at 1
                userPoints = userEntry.points;
            }
        }

        // Create the embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();

        if (users.length === 0) {
            embed.addFields({ name: 'No Points Yet', value: 'No members have earned points.' });
        } else {
            // Format the leaderboard
            let leaderboardText = '';

            users.forEach((user, index) => {
                const rank = index + 1;
                const gangInfo = user.currentGangName ? ` | ${user.currentGangName}` : '';
                leaderboardText += `**${rank}.** <@${user.discordId}> - **${user.points}** pts${gangInfo}\n`;
            });

            embed.addFields({ name: 'Top 10', value: leaderboardText });

            // Add the user's position if they're not in the top 10
            const userInTop10 = users.some(user => user.discordId === userId);
            if (!userInTop10 && userRank > 0) {
                embed.addFields({
                    name: 'Your Position',
                    value: `**${userRank}.** <@${userId}> - **${userPoints}** pts`
                });
            }
        }

        return interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error showing leaderboard:', error);
        return interaction.editReply('There was an error showing the leaderboard!');
    }
}

/**
 * Show gang leaderboard
 * @param {Object} interaction - Discord interaction
 */
async function showGangLeaderboard(interaction) {
    const guildId = interaction.guild.id;

    try {
        // Get all gangs from config with their data from database if exists
        const configGangs = gangsConfig;
        let gangs = [];

        for (const configGang of configGangs) {
            let gang = await Gang.findOne({ gangId: configGang.gangId });

            if (!gang) {
                // Create entry for gang if it doesn't exist
                gang = new Gang({
                    gangId: configGang.gangId,
                    name: configGang.name,
                    guildId: interaction.guild.id,
                    channelId: configGang.channelId || ' ', // Space to avoid validation error
                    roleId: configGang.roleId,
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
                await gang.save();
            }

            gangs.push(gang);
        }

        if (gangs.length === 0) {
            return interaction.editReply('No gangs have been configured yet!');
        }

        // Sort gangs by total score (gang points + member points)
        gangs.sort((a, b) => (b.points + b.totalMemberPoints) - (a.points + a.totalMemberPoints));

        // Create the embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Gang Leaderboard')
            .setDescription('Gangs ranked by total points (gang points + member points):')
            .setTimestamp();

        // Format the gang leaderboard
        let gangLeaderboardText = '';

        gangs.forEach((gang, index) => {
            const totalScore = gang.points + gang.totalMemberPoints;
            gangLeaderboardText += `**${index + 1}.** ${gang.name} - **${totalScore}** pts\n`;
            gangLeaderboardText += `> Gang Points: ${gang.points} | Member Points: ${gang.totalMemberPoints} | Members: ${gang.memberCount}\n`;
        });

        embed.addFields({ name: 'Gangs', value: gangLeaderboardText || 'No gang data available.' });

        return interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error showing gang leaderboard:', error);
        return interaction.editReply('There was an error showing the gang leaderboard!');
    }
} 