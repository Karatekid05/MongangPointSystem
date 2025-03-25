const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { getWeeklyGangMemberLeaderboard, getWeeklyGangLeaderboard, getWeeklyUserLeaderboard } = require('../utils/pointsManager');
const User = require('../models/User');
const Gang = require('../models/Gang');
const { gangsConfig } = require('../config/gangs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('View the weekly points leaderboard')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of weekly leaderboard to view')
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
                    await showWeeklyGangLeaderboard(interaction);
                    break;
                case 'specific':
                    // Show gang-specific leaderboard
                    await showWeeklyLeaderboard(interaction, gangId);
                    break;
                case 'members':
                default:
                    // Show server-wide leaderboard
                    await showWeeklyLeaderboard(interaction, null);
                    break;
            }
        } catch (error) {
            console.error('Error in weekly leaderboard command:', error);
            return interaction.editReply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
};

/**
 * Show weekly user leaderboard for a specific gang or the entire server
 * @param {Object} interaction - Discord interaction
 * @param {String} gangId - Gang ID (null for server-wide)
 */
async function showWeeklyLeaderboard(interaction, gangId) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    try {
        let users = [];
        let totalUsers = 0;
        let userRank = 0;
        let userWeeklyPoints = 0;
        let title = 'Weekly Server Leaderboard';
        let description = 'Top members by weekly points:';

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

                title = `Weekly ${gangName} Leaderboard`;
                description = `Top members in ${gangName} this week:`;
            } else {
                title = `Weekly ${gang.name} Leaderboard`;
                description = `Top members in ${gang.name} this week:`;
            }

            // Count total users in the gang with weekly points
            totalUsers = await User.countDocuments({
                currentGangId: gangId,
                weeklyPoints: { $gt: 0 }
            });

            // Get top 10 users
            users = await getWeeklyGangMemberLeaderboard(gangId, 10, 0);

            // Find the user's rank and points
            const userEntry = await User.findOne({ discordId: userId, currentGangId: gangId });
            if (userEntry && userEntry.weeklyPoints > 0) {
                // Count how many users have more points than this user
                userRank = await User.countDocuments({
                    currentGangId: gangId,
                    weeklyPoints: { $gt: userEntry.weeklyPoints }
                }) + 1; // +1 because ranks start at 1
                userWeeklyPoints = userEntry.weeklyPoints;
            }
        } else {
            // Count total users in the server with weekly points
            totalUsers = await User.countDocuments({
                weeklyPoints: { $gt: 0 }
            });

            // Get top 10 users
            users = await getWeeklyUserLeaderboard(guildId, 10, 0);

            // Find the user's rank and points
            const userEntry = await User.findOne({ discordId: userId });
            if (userEntry && userEntry.weeklyPoints > 0) {
                // Count how many users have more points than this user
                userRank = await User.countDocuments({
                    weeklyPoints: { $gt: userEntry.weeklyPoints }
                }) + 1; // +1 because ranks start at 1
                userWeeklyPoints = userEntry.weeklyPoints;
            }
        }

        // Create the embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(title)
            .setDescription(description)
            .setTimestamp()
            .setFooter({
                text: 'Resets every Sunday'
            });

        if (users.length === 0) {
            embed.addFields({ name: 'No Weekly Points Yet', value: 'No members have earned points this week.' });
        } else {
            // Format the leaderboard
            let leaderboardText = '';

            users.forEach((user, index) => {
                const rank = index + 1;
                const gangInfo = user.currentGangName ? ` | ${user.currentGangName}` : '';
                leaderboardText += `**${rank}.** <@${user.discordId}> - **${user.weeklyPoints}** pts${gangInfo}\n`;
            });

            embed.addFields({ name: 'Top 10', value: leaderboardText });

            // Add the user's position if they're not in the top 10
            const userInTop10 = users.some(user => user.discordId === userId);
            if (!userInTop10 && userRank > 0) {
                embed.addFields({
                    name: 'Your Position',
                    value: `**${userRank}.** <@${userId}> - **${userWeeklyPoints}** pts`
                });
            }
        }

        return interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error showing weekly leaderboard:', error);
        return interaction.editReply('There was an error showing the weekly leaderboard!');
    }
}

/**
 * Show weekly gang leaderboard
 * @param {Object} interaction - Discord interaction
 */
async function showWeeklyGangLeaderboard(interaction) {
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

        // Sort gangs by weekly total score (gang points + member points)
        gangs.sort((a, b) => (b.weeklyPoints + b.weeklyMemberPoints) - (a.weeklyPoints + a.weeklyMemberPoints));

        // Create the embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Weekly Gang Leaderboard')
            .setDescription('Gangs ranked by weekly points (gang points + member points):')
            .setTimestamp()
            .setFooter({ text: 'Resets every Sunday' });

        // Format the gang leaderboard
        let gangLeaderboardText = '';

        gangs.forEach((gang, index) => {
            const weeklyTotalScore = gang.weeklyPoints + gang.weeklyMemberPoints;
            gangLeaderboardText += `**${index + 1}.** ${gang.name} - **${weeklyTotalScore}** pts\n`;
            gangLeaderboardText += `> Gang Points: ${gang.weeklyPoints} | Member Points: ${gang.weeklyMemberPoints} | Members: ${gang.memberCount}\n`;
        });

        embed.addFields({ name: 'Gangs', value: gangLeaderboardText || 'No gang data available.' });

        return interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error showing weekly gang leaderboard:', error);
        return interaction.editReply('There was an error showing the weekly gang leaderboard!');
    }
} 