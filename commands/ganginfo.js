const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Gang = require('../models/Gang');
const User = require('../models/User');
const { gangsConfig } = require('../config/gangs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ganginfo')
        .setDescription('View detailed information about a gang')
        .addStringOption(option =>
            option.setName('gang')
                .setDescription('The gang to view information about')
                .setAutocomplete(true)
                .setRequired(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();

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
        const gangId = interaction.options.getString('gang');

        // Defer the reply
        await interaction.deferReply();

        try {
            // Try to find the gang
            let gang = await Gang.findOne({ gangId });

            if (!gang) {
                // Try to get the gang from the config
                const configGang = gangsConfig.find(g => g.gangId === gangId);

                if (!configGang) {
                    return interaction.editReply(`Gang not found with ID: ${gangId}`);
                }

                // Create a new gang entry if it doesn't exist
                gang = new Gang({
                    gangId: configGang.gangId,
                    name: configGang.name,
                    guildId: interaction.guild.id,
                    channelId: configGang.channelId,
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

            // Get member count
            const memberCount = await User.countDocuments({ currentGangId: gangId });

            // Update the gang's member count if it's different
            if (gang.memberCount !== memberCount) {
                gang.memberCount = memberCount;
                await gang.save();
            }

            // Get the top 5 members for this gang
            const topMembers = await User.find({ currentGangId: gangId })
                .sort({ points: -1 })
                .limit(5);

            // Create the embed
            const totalPoints = gang.points + gang.totalMemberPoints;
            const weeklyTotalPoints = gang.weeklyPoints + gang.weeklyMemberPoints;

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${gang.name} - Gang Information`)
                .setDescription(`Information about the ${gang.name} gang`)
                .addFields(
                    { name: 'Total Points', value: `${totalPoints} points`, inline: true },
                    { name: 'Gang Points', value: `${gang.points} points`, inline: true },
                    { name: 'Member Points', value: `${gang.totalMemberPoints} points`, inline: true },
                    { name: 'Weekly Total', value: `${weeklyTotalPoints} points`, inline: true },
                    { name: 'Weekly Gang Points', value: `${gang.weeklyPoints} points`, inline: true },
                    { name: 'Weekly Member Points', value: `${gang.weeklyMemberPoints} points`, inline: true },
                    { name: 'Members', value: `${gang.memberCount} members`, inline: true },
                    { name: 'Messages', value: `${gang.messageCount} messages`, inline: true },
                    { name: 'Weekly Messages', value: `${gang.weeklyMessageCount} messages`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Weekly stats reset every Sunday' });

            // Add top members if there are any
            if (topMembers.length > 0) {
                let topMemberText = '';

                topMembers.forEach((member, index) => {
                    topMemberText += `**${index + 1}.** <@${member.discordId}> - ${member.points} points\n`;
                });

                embed.addFields({ name: 'Top Members', value: topMemberText });
            }

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in ganginfo command:', error);
            return interaction.editReply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
}; 