const { Events, InteractionType } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // Add debug log
            console.log(`Received interaction: ${interaction.type} from ${interaction.user.tag}`);
            
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                console.log(`Processing command: ${interaction.commandName}`);
                const command = interaction.client.commands.get(interaction.commandName);

                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found.`);
                    return;
                }

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`Error in ${interaction.commandName} command:`, error);
                    const reply = { content: 'Ocorreu um erro ao executar este comando!', ephemeral: true };
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(reply);
                    } else {
                        await interaction.reply(reply);
                    }
                }
            }
            // Handle autocomplete interactions
            else if (interaction.isAutocomplete()) {
                console.log(`Processing autocomplete for command: ${interaction.commandName}`);
                const command = interaction.client.commands.get(interaction.commandName);

                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found for autocomplete.`);
                    return;
                }

                if (!command.autocomplete) {
                    console.error(`No autocomplete method for ${interaction.commandName} was found.`);
                    return;
                }

                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    console.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
                }
            }
            // Handle button interactions
            else if (interaction.isButton()) {
                try {
                    // Format for customId:
                    // For leaderboard: lb_action_gangName_currentPage
                    // For weekly: wk_action_gangName_currentPage
                    const [command, action, gangName, currentPage] = interaction.customId.split('_');
                    const page = parseInt(currentPage);
                    let newPage = page;

                    if (action === 'next') {
                        newPage = page + 1;
                    } else if (action === 'prev') {
                        newPage = page - 1;
                    }

                    await interaction.deferUpdate();

                    // Get the actual command file and function
                    if (command === 'lb') {
                        // Leaderboard navigation
                        const leaderboardCommand = interaction.client.commands.get('leaderboard');
                        const showLeaderboard = require('../commands/leaderboard').showLeaderboard;
                        await showLeaderboard(interaction, gangName !== 'null' ? gangName : null, newPage, 10);
                    } else if (command === 'wk') {
                        // Weekly leaderboard navigation
                        const weeklyCommand = interaction.client.commands.get('weekly');
                        const showWeeklyLeaderboard = require('../commands/weeklyLeaderboard').showWeeklyLeaderboard;
                        await showWeeklyLeaderboard(interaction, gangName !== 'null' ? gangName : null, newPage, 10);
                    }
                } catch (error) {
                    console.error('Error handling button interaction:', error);
                    await interaction.reply({ content: 'There was an error processing this interaction.', ephemeral: true });
                }
            }
        } catch (error) {
            console.error('Error in interactionCreate event handler:', error);
        }
    }
}; 