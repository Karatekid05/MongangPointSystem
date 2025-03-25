const { trackMessage } = require('../utils/pointsManager');
const { gangsConfig } = require('../config/gangs');

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(message) {
        try {
            // Ignore messages from bots (including self)
            if (message.author.bot) {
                return;
            }

            // Ignore DMs
            if (!message.guild) {
                return;
            }

            // Ignore system messages
            if (message.system) {
                return;
            }

            // Get list of configured gang channel IDs
            const gangChannelIds = gangsConfig.map(gang => gang.channelId.trim()).filter(id => id && id !== " ");

            // Only process messages from gang channels
            if (!gangChannelIds.includes(message.channel.id)) {
                return; // Silently ignore messages from non-gang channels
            }

            // Process message tracking in a non-blocking way
            trackMessage(message).catch(error => {
                console.error('Error tracking message:', error);
            });

        } catch (error) {
            console.error('Error in messageCreate event:', error);
        }
    },
}; 