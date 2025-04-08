const cron = require('node-cron');
const { resetWeeklyPoints, getWeeklyGangLeaderboard, getWeeklyUserLeaderboard } = require('./pointsManager');
const { exportWeeklyLeaderboard } = require('./sheetsLogger');

// Função para obter o número da semana atual
function getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
}

/**
 * Initialize scheduled tasks
 * @param {Object} client - Discord client
 */
function initScheduledTasks(client) {
    console.log('Initializing scheduled tasks');

    // Schedule weekly points reset for Sunday at midnight (00:00)
    // Cron format: second(0-59) minute(0-59) hour(0-23) day_of_month(1-31) month(1-12) day_of_week(0-6)(Sunday=0)
    cron.schedule('0 0 0 * * 0', async () => {
        try {
            console.log('Running weekly points reset');

            // For each guild the bot is in
            client.guilds.cache.forEach(async (guild) => {
                try {
                    // Primeiro, obter os leaderboards antes do reset
                    const [gangLeaderboard, userLeaderboard] = await Promise.all([
                        getWeeklyGangLeaderboard(guild.id),
                        getWeeklyUserLeaderboard(guild.id)
                    ]);

                    // Exportar para o Google Sheets
                    const weekNumber = getWeekNumber();
                    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

                    if (spreadsheetId) {
                        try {
                            const exportResult = await exportWeeklyLeaderboard({
                                spreadsheetId,
                                gangLeaderboard,
                                userLeaderboard,
                                weekNumber
                            });

                            console.log(`Weekly leaderboard exported to sheet: ${exportResult.sheetName}`);
                        } catch (exportError) {
                            console.error('Error exporting weekly leaderboard:', exportError);
                        }
                    }

                    // Agora fazer o reset dos pontos
                    const results = await resetWeeklyPoints(guild.id);
                    console.log(`Weekly reset for ${guild.name} (${guild.id}): Reset ${results.usersReset} users and ${results.gangsReset} gangs`);

                    // Find a system channel or default channel to notify
                    const systemChannel = guild.systemChannel;
                    const notificationChannel = systemChannel ||
                        guild.channels.cache.find(channel =>
                            channel.type === 'GUILD_TEXT' &&
                            channel.permissionsFor(guild.me).has('SEND_MESSAGES')
                        );

                    if (notificationChannel) {
                        const weeklySheet = spreadsheetId ? `\nLeaderboard da semana anterior disponível na aba Week_${weekNumber} da planilha!` : '';
                        notificationChannel.send(`Weekly points have been reset! Starting a new week of competition. 🏆${weeklySheet}`);
                    }
                } catch (err) {
                    console.error(`Error resetting weekly points for guild ${guild.id}:`, err);
                }
            });
        } catch (error) {
            console.error('Error in weekly points reset task:', error);
        }
    }, {
        timezone: "UTC"
    });
}

module.exports = { initScheduledTasks }; 