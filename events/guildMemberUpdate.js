const { registerUser } = require('../utils/pointsManager');
const Gang = require('../models/Gang');

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember, client) {
        try {
            // Check if roles have changed
            if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

            // Get all gangs for this guild
            const gangs = await Gang.find({ guildId: newMember.guild.id });
            if (!gangs || gangs.length === 0) return;

            // Find which gang role was added (if any)
            for (const gang of gangs) {
                const hasRole = newMember.roles.cache.has(gang.roleId);
                const hadRole = oldMember.roles.cache.has(gang.roleId);

                // If role was added, register user to this gang
                if (hasRole && !hadRole) {
                    await registerUser({
                        guildId: newMember.guild.id,
                        userId: newMember.id,
                        username: newMember.user.username,
                        gangId: gang.gangId,
                        gangName: gang.name
                    });

                    console.log(`User ${newMember.user.username} registered to gang ${gang.name}`);
                    break;
                }
            }
        } catch (error) {
            console.error('Error in guildMemberUpdate event handler:', error);
        }
    }
}; 