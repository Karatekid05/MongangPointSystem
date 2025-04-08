const { gangsConfig } = require('../config/gangs');
const { fetchGangMembersByRole, updateGangTotalPoints, updateGangWeeklyPoints } = require('../utils/pointsManager');
const { Gang } = require('../utils/dbModels');
const { initScheduledTasks } = require('../utils/scheduledTasks');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Set bot activity to display help command
        client.user.setActivity('/help', { type: 'WATCHING' });

        // Initialize scheduled tasks
        console.log('Initializing scheduled tasks...');
        initScheduledTasks(client);

        // Additional startup tasks can go here
        console.log(`Bot is in ${client.guilds.cache.size} servers`);
        console.log('Using MongoDB database');

        // Inicializar as gangues no MongoDB
        try {
            console.log('Inicializando gangues no MongoDB...');

            for (const gangConfig of gangsConfig) {
                // Verificar se a gangue já existe
                let gang = await Gang.findOne({ gangId: gangConfig.gangId });

                if (!gang) {
                    console.log(`Criando gangue ${gangConfig.name} (${gangConfig.gangId}) no MongoDB`);
                    // Criar a gangue se não existir
                    gang = await Gang.create({
                        gangId: gangConfig.gangId,
                        name: gangConfig.name,
                        guildId: process.env.GUILD_ID,
                        channelId: gangConfig.channelId,
                        roleId: gangConfig.roleId,
                        points: 0,
                        weeklyPoints: 0,
                        memberCount: 0,
                        totalMemberPoints: 0,
                        weeklyMemberPoints: 0,
                        messageCount: 0,
                        weeklyMessageCount: 0,
                        pointsBreakdown: {
                            events: 0,
                            competitions: 0,
                            other: 0
                        },
                        weeklyPointsBreakdown: {
                            events: 0,
                            competitions: 0,
                            other: 0
                        }
                    });
                    console.log(`Gangue ${gangConfig.name} criada com sucesso`);
                } else {
                    console.log(`Gangue ${gangConfig.name} já existe no banco de dados`);
                }
            }
        } catch (error) {
            console.error('Erro ao inicializar gangues:', error);
        }

        // Sync all gang members on startup
        try {
            console.log('Starting automatic gang member synchronization...');
            const guild = client.guilds.cache.first();

            if (!guild) {
                console.log('No guild found to synchronize members');
                return;
            }

            console.log(`Found guild: ${guild.name} (${guild.id})`);

            // Process each gang in configuration
            for (const gang of gangsConfig) {
                try {
                    console.log(`Syncing gang ${gang.name} (${gang.gangId})`);

                    // Fetch all members with the gang role
                    const gangMembers = await fetchGangMembersByRole(
                        client,
                        guild.id,
                        gang.gangId
                    );

                    console.log(`Synced ${gangMembers.memberCount} members for ${gang.name}`);

                    // Update points calculations
                    await updateGangTotalPoints(gang.gangId);
                    await updateGangWeeklyPoints(gang.gangId);
                } catch (error) {
                    console.error(`Error syncing gang ${gang.name}:`, error.message);
                }
            }

            console.log('Automatic gang member synchronization complete');
        } catch (error) {
            console.error('Error during automatic gang synchronization:', error);
        }
    }
};