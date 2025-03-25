const cron = require('node-cron');
const { resetWeeklyPoints } = require('./pointsManager');

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
                        notificationChannel.send('Weekly points have been reset! Starting a new week of competition. 🏆');
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