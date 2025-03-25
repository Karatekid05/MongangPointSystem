const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands'),

    async execute(interaction) {
        try {
            const isAdmin = interaction.member.permissions.has('Administrator');
            const isModerator = interaction.member.permissions.has('ModerateMembers');

            const embed = new EmbedBuilder()
                .setTitle('Gang Points System - Help')
                .setColor(0x2ECC71)
                .setDescription('Here are all the available commands for the gang points system.')
                .setTimestamp();

            // Commands for everyone
            embed.addFields({
                name: '🏆 Leaderboards',
                value:
                    '`/leaderboard type:Members` - View all members ranked by points\n' +
                    '`/leaderboard type:Gangs` - View all gangs ranked by points\n' +
                    '`/leaderboard type:Specific gang:GangName` - View members in a specific gang\n' +
                    '`/weekly type:Members` - View all members ranked by weekly points\n' +
                    '`/weekly type:Gangs` - View all gangs ranked by weekly points\n' +
                    '`/weekly type:Specific gang:GangName` - View weekly points for a specific gang'
            });

            embed.addFields({
                name: 'ℹ️ Information',
                value:
                    '`/userinfo [user]` - View detailed information about a user\'s points\n' +
                    '`/ganginfo gang:GangName` - View detailed information about a gang'
            });

            embed.addFields({
                name: '🔗 Twitter Integration',
                value: '`/linktwitter username` - Link your Discord account to your Twitter account'
            });

            // Commands for moderators
            if (isModerator) {
                embed.addFields({
                    name: '🔰 Moderator Commands',
                    value:
                        '`/award target:User user:Username points:10 source:...` - Award points to a user\n' +
                        '`/award target:Gang gang:GangName points:10 source:...` - Award points to a gang\n' +
                        '`/synctwitter` - Sync Twitter engagement points from Engage Bot'
                });
            }

            // Commands for admins
            if (isAdmin) {
                embed.addFields({
                    name: '⚙️ Administrator Commands',
                    value:
                        'Gang configuration is done directly in the code.\n' +
                        'Contact the bot developer for gang changes.'
                });
            }

            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in help command:', error);
            return interaction.reply({ content: 'There was an error showing the help command.', ephemeral: true });
        }
    }
}; 