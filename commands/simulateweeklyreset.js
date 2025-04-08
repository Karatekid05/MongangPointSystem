const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { resetWeeklyPoints, getWeeklyGangLeaderboard, getWeeklyUserLeaderboard } = require('../utils/pointsManager');
const { exportWeeklyLeaderboard } = require('../utils/sheetsLogger');

// Função para obter o número da semana atual
function getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
}

// Função principal que executa o reset
async function executeReset(guildId, guildName = 'Test Guild') {
    try {
        console.log(`Starting weekly reset simulation for guild: ${guildName} (${guildId})`);

        // First, get the leaderboards before reset
        console.log('Fetching leaderboards...');

        // Get gang leaderboard
        const gangLeaderboard = await getWeeklyGangLeaderboard(guildId);
        console.log(`Got gang leaderboard with ${gangLeaderboard.length} gangs`);

        // Get user leaderboard
        const userLeaderboard = await getWeeklyUserLeaderboard(guildId);
        console.log(`Got user leaderboard with ${userLeaderboard.length} users`);

        // Export to Google Sheets if configured
        const weekNumber = getWeekNumber();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        console.log(`Week number: ${weekNumber}, Spreadsheet ID: ${spreadsheetId}`);

        if (spreadsheetId) {
            try {
                console.log('Exporting to Google Sheets...');
                const exportResult = await exportWeeklyLeaderboard({
                    spreadsheetId,
                    gangLeaderboard: gangLeaderboard || [],
                    userLeaderboard: userLeaderboard || [],
                    weekNumber
                });

                console.log(`Weekly leaderboard exported to sheet: ${exportResult.sheetName}`);
            } catch (exportError) {
                console.error('Error exporting weekly leaderboard:', exportError);
                console.error('Export error details:', exportError.message);
                if (exportError.stack) {
                    console.error('Stack trace:', exportError.stack);
                }
            }
        } else {
            console.log('No Google Sheet ID provided in environment variables');
        }

        // Now reset the points
        console.log('Resetting weekly points...');
        const results = await resetWeeklyPoints(guildId);
        console.log(`Weekly reset complete: Reset ${results.usersReset} users and ${results.gangsReset} gangs`);

        return results;
    } catch (error) {
        console.error('Error in weekly reset:', error);
        throw error;
    }
}

// Se o arquivo for executado diretamente (não importado como módulo)
if (require.main === module) {
    const testGuildId = '1338963846794055700'; // ID do servidor de teste
    executeReset(testGuildId)
        .then(() => {
            console.log('Weekly reset simulation completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Weekly reset simulation failed:', error);
            process.exit(1);
        });
}

// Exportar o comando do Discord
module.exports = {
    data: new SlashCommandBuilder()
        .setName('simulateweeklyreset')
        .setDescription('Simula o reset semanal de pontos (apenas para testes)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Check if user has administrator permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: 'Você precisa ter permissões de administrador para usar este comando.',
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            const guild = interaction.guild;
            const results = await executeReset(guild.id, guild.name);

            const weeklySheet = process.env.GOOGLE_SHEET_ID ?
                `\nLeaderboard da semana anterior disponível na aba Week_${getWeekNumber()} da planilha!` : '';

            await interaction.editReply({
                content: `Reset semanal simulado com sucesso!\n` +
                    `- ${results.usersReset} usuários resetados\n` +
                    `- ${results.gangsReset} gangs resetadas${weeklySheet}`
            });

            // Send message in system channel
            const systemChannel = guild.systemChannel;
            if (systemChannel && systemChannel.id !== interaction.channelId) {
                await systemChannel.send(`Weekly points have been reset! Starting a new week of competition. 🏆${weeklySheet}`);
            }

        } catch (error) {
            console.error('Error in simulate weekly reset command:', error);

            // If the interaction hasn't been replied to yet
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Ocorreu um erro ao simular o reset semanal. Verifique os logs.',
                    ephemeral: true
                });
            } else {
                // If the interaction was deferred but not replied to
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({
                        content: 'Ocorreu um erro ao simular o reset semanal. Verifique os logs.'
                    });
                }
            }
        }
    },
}; 