const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows available commands and information about the bot'),

    async execute(interaction) {
        // Check if user has admin role
        const member = interaction.member;
        const isAdmin = member.roles.cache.some(role => role.name === 'Admin' || role.name === 'admin');
        const isMod = member.roles.cache.some(role => role.name === 'Moderator' || role.name === 'moderator');

        // Create a help embed
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Gang Points System Help')
            .setDescription('Here are the available commands for the Gang Points System:')
            .addFields(
                {
                    name: '📊 Leaderboards',
                    value: '`/leaderboard type:[Members|Gangs|Specific Gang]` - View the points leaderboard\n'
                        + '`/weeklyLeaderboard type:[Members|Gangs|Specific Gang]` - View the weekly leaderboard',
                    inline: false
                },
                {
                    name: 'ℹ️ Information',
                    value: '`/ganginfo gang:GangName` - View information about a gang\n'
                        + '`/userinfo user:@Username` - View information about a user\n'
                        + '`/activity gang:GangName` - View activity statistics for a gang',
                    inline: false
                }
            );

        // Add admin commands if user is an admin
        if (isAdmin || isMod) {
            helpEmbed.addFields(
                {
                    name: '⚙️ Administration',
                    value: '`/award user:@Username points:10 source:[Activity|Games|etc.] reason:Optional_Reason` - Award points to a user\n'
                        + '`/removepoints user:@Username points:10 source:[Activity|Games|etc.] reason:Optional_Reason` - Remove points from a user',
                    inline: false
                }
            );
        }

        // Add general information
        helpEmbed.addFields(
            {
                name: '📝 How Points Work',
                value: '• Each valid message in your gang\'s channel awards 1 point\n'
                    + '• Messages must be at least 5 characters long\n'
                    + '• There\'s a 5-minute cooldown between point-earning messages\n'
                    + '• Points contribute to both your score and your gang\'s total score',
                inline: false
            }
        );

        // Add footer
        helpEmbed.setFooter({
            text: 'Gang Points System v1.0'
        });

        // Send the help message
        return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    },
}; 