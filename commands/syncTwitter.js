const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { syncTwitterEngagementPoints } = require('../utils/googleSheetsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('synctwitter')
        .setDescription('Sync Twitter engagement points from Engage Bot (Staff only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Inform users that this might take a while
            await interaction.editReply('Syncing Twitter engagement points... This may take a minute.');

            // Run the sync
            const results = await syncTwitterEngagementPoints(interaction.guild.id);

            // Create an embed to display results
            const embed = new EmbedBuilder()
                .setTitle('Twitter Engagement Sync Results')
                .setColor(0x1DA1F2) // Twitter blue
                .setDescription(`Successfully synced Twitter engagement points from Engage Bot.`)
                .addFields(
                    {
                        name: 'Summary',
                        value: `Processed: ${results.totalUsersProcessed} users\nTotal Points Awarded: ${results.totalPointsAwarded}`
                    }
                )
                .setTimestamp();

            // Add information about users who received points
            if (results.usersWithPoints.length > 0) {
                let userList = '';
                // Limit to top 10 users to avoid embed size limits
                const topUsers = results.usersWithPoints
                    .sort((a, b) => b.pointsAwarded - a.pointsAwarded)
                    .slice(0, 10);

                for (const user of topUsers) {
                    userList += `${user.username} (@${user.twitterUsername}): +${user.pointsAwarded} points\n`;
                }

                if (results.usersWithPoints.length > topUsers.length) {
                    userList += `...and ${results.usersWithPoints.length - topUsers.length} more users`;
                }

                embed.addFields({ name: 'Points Awarded', value: userList });
            } else {
                embed.addFields({ name: 'Points Awarded', value: 'No new points awarded.' });
            }

            // Add error information if any
            if (results.errors && results.errors.length > 0) {
                let errorList = results.errors.slice(0, 5).join('\n');

                if (results.errors.length > 5) {
                    errorList += `\n...and ${results.errors.length - 5} more errors`;
                }

                embed.addFields({ name: 'Errors', value: errorList });
            }

            return interaction.editReply({ content: null, embeds: [embed] });

        } catch (error) {
            console.error('Error in synctwitter command:', error);
            return interaction.editReply('There was an error syncing Twitter engagement points. Check the server logs for details.');
        }
    }
}; 