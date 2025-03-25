const { SlashCommandBuilder } = require('discord.js');
const { linkTwitterAccount } = require('../utils/googleSheetsManager');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('linktwitter')
        .setDescription('Link your Discord account to your Twitter account for engagement points')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Your Twitter username (without @)')
                .setRequired(true)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Get the Twitter username
            let twitterUsername = interaction.options.getString('username');

            // Clean up the username - remove @ if present
            twitterUsername = twitterUsername.replace('@', '').trim();

            if (!twitterUsername) {
                return interaction.editReply('Please provide a valid Twitter username.');
            }

            // Check if user exists in the system
            const user = await User.findOne({ discordId: interaction.user.id });

            if (!user) {
                return interaction.editReply('You need to be registered in a gang before linking your Twitter account. Please ask a moderator to assign you a gang role.');
            }

            // Link accounts
            await linkTwitterAccount({
                discordId: interaction.user.id,
                discordUsername: interaction.user.username,
                twitterUsername: twitterUsername
            });

            return interaction.editReply(`Successfully linked your Discord account to Twitter user @${twitterUsername}. Your Twitter engagement will now earn you points when a moderator runs the /synctwitter command.`);

        } catch (error) {
            console.error('Error in linktwitter command:', error);
            return interaction.editReply(`Error: ${error.message}`);
        }
    }
}; 