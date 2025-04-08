const { User, Gang } = require('./dbModels');

class BatchProcessor {
    constructor() {
        this.members = [];
        this.processing = false;
    }

    addToQueue(member) {
        this.members.push(member);
    }

    async processAllMembers() {
        if (this.processing || this.members.length === 0) return;

        this.processing = true;
        console.log(`Processing ${this.members.length} members in bulk...`);

        try {
            // Prepare bulk operations for users
            const userBulkOps = this.members.map(member => ({
                updateOne: {
                    filter: { discordId: member.id },
                    update: {
                        $set: {
                            username: member.user.username,
                            discriminator: member.user.discriminator,
                            avatar: member.user.avatar,
                            roles: member.roles.cache.map(role => role.id)
                        }
                    },
                    upsert: true
                }
            }));

            // Execute bulk user operations
            await User.bulkWrite(userBulkOps);
            console.log('Bulk user updates completed');

            // Process gang memberships
            const gangUpdates = {};
            this.members.forEach(member => {
                const gangRole = member.roles.cache.find(role =>
                    ['1200000000000000000', '1200000000000000001', '1200000000000000002'].includes(role.id)
                );
                if (gangRole) {
                    if (!gangUpdates[gangRole.id]) {
                        gangUpdates[gangRole.id] = [];
                    }
                    gangUpdates[gangRole.id].push(member.id);
                }
            });

            // Update gangs in bulk
            const gangBulkOps = Object.entries(gangUpdates).map(([roleId, members]) => ({
                updateOne: {
                    filter: { roleId },
                    update: { $addToSet: { members: { $each: members } } },
                    upsert: true
                }
            }));

            if (gangBulkOps.length > 0) {
                await Gang.bulkWrite(gangBulkOps);
                console.log('Bulk gang updates completed');
            }

            console.log(`Successfully processed ${this.members.length} members`);
            this.members = [];
        } catch (error) {
            console.error('Error in bulk processing:', error);
        } finally {
            this.processing = false;
        }
    }
}

module.exports = new BatchProcessor(); 