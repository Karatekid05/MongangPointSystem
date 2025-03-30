const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Gang } = require('../utils/dbModels');
const { gangsConfig } = require('../config/gangs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('activity')
        .setDescription('View activity statistics for chat channels')
        .addStringOption(option =>
            option.setName('gang')
                .setDescription('Show activity for a specific gang')
                .setRequired(false)
                .setAutocomplete(true)),

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
        await interaction.deferReply();

        try {
            const gangId = interaction.options.getString('gang');

            if (gangId) {
                // Show activity for a specific gang
                const gang = await Gang.findOne({ gangId });

                if (!gang) {
                    // Try to get the gang from the config
                    const configGang = gangsConfig.find(g => g.gangId === gangId);

                    if (!configGang) {
                        return interaction.editReply(`Gang not found with ID: ${gangId}`);
                    }

                    return interaction.editReply({
                        content: `The ${configGang.name} gang doesn't have any recorded activity yet.`
                    });
                }

                // Create the embed for a single gang
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`${gang.name} - Activity Statistics`)
                    .setDescription(`Chat activity statistics for ${gang.name}`)
                    .addFields(
                        { name: 'Total Messages', value: `${gang.messageCount} messages`, inline: true },
                        { name: 'Weekly Messages', value: `${gang.weeklyMessageCount} messages`, inline: true },
                        { name: 'Activity Points', value: `${gang.totalMemberPoints || 0} points`, inline: true },
                        {
                            name: 'How it works?', value:
                                `• Each member earns 1 point per message in their gang channel\n` +
                                `• Messages must have at least 5 characters\n` +
                                `• There's a 5-minute cooldown between point-earning messages\n` +
                                `• Repeated or very simple messages don't count\n` +
                                `• Points are accumulated for both the member and the gang`
                        }
                    );

                // Find the matching gang in config to get channel ID
                const gangConfig = gangsConfig.find(g => g.gangId === gangId);
                const channelName = gangConfig ? gangConfig.name : gang.name;
                embed.setFooter({ text: `Chat channel: #${channelName}` });

                return interaction.editReply({ embeds: [embed] });

            } else {
                // Show activity for all gangs
                const gangs = await Gang.find({}).sort({ messageCount: -1 });

                if (!gangs || gangs.length === 0) {
                    return interaction.editReply('No gang has recorded activity yet.');
                }

                // Create the embed for all gangs
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Chat Activity Statistics')
                    .setDescription('Activity comparison between gangs')
                    .setFooter({ text: 'Use /activity gang:gang_name for more details' });

                // Add each gang's stats
                let gangStats = '';
                gangs.forEach((gang, index) => {
                    gangStats += `**${index + 1}. ${gang.name}**\n`;
                    gangStats += `📝 ${gang.messageCount} total messages\n`;
                    gangStats += `📊 ${gang.weeklyMessageCount} messages this week\n\n`;
                });

                embed.addFields({ name: 'Activity by Gang', value: gangStats || 'No activity recorded.' });

                // Add explanation field
                embed.addFields({
                    name: 'How it works?',
                    value:
                        `• Each member earns 1 point per message in their gang channel\n` +
                        `• There's a 5-minute cooldown between point-earning messages\n` +
                        `• Messages with less than 5 characters don't count\n` +
                        `• Activity points count towards member's total`
                });

                return interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error in activity command:', error);
            return interaction.editReply('An error occurred while retrieving activity statistics.');
        }
    }
}; 