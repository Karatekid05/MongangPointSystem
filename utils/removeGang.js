/**
 * Script to remove a gang from the database and reassign its users
 * Run with: node utils/removeGang.js
 */
require('dotenv').config();
const { Gang, User } = require('./dbModels');

// Gang to remove
const GANG_TO_REMOVE = 'karate-cooks-1';
// Default gang to move users to
const DEFAULT_GANG = 'sea-kings-1';

async function removeGang() {
    try {
        console.log('Connecting to database...');

        // Find users in the gang to be removed
        console.log(`Finding users in gang ${GANG_TO_REMOVE}...`);
        const users = await User.find({ currentGangId: GANG_TO_REMOVE });
        console.log(`Found ${users.length} users in the gang to be removed.`);

        if (users.length > 0) {
            // Get the default gang data
            const defaultGang = await Gang.findOne({ gangId: DEFAULT_GANG });
            if (!defaultGang) {
                throw new Error(`Default gang ${DEFAULT_GANG} not found!`);
            }

            console.log(`Moving users to gang: ${defaultGang.name}`);

            // Update each user
            for (const user of users) {
                console.log(`Moving user ${user.username} to ${defaultGang.name}`);

                // Check if user already has gang points for default gang
                const hasDefaultGangPoints = user.gangPoints.some(g => g.gangId === DEFAULT_GANG);

                if (!hasDefaultGangPoints) {
                    // Add new gang points entry for default gang
                    user.gangPoints.push({
                        gangId: DEFAULT_GANG,
                        gangName: defaultGang.name,
                        points: 0,
                        weeklyPoints: 0,
                        pointsBreakdown: {
                            games: 0,
                            artAndMemes: 0,
                            activity: 0,
                            gangActivity: 0,
                            other: 0
                        },
                        weeklyPointsBreakdown: {
                            games: 0,
                            artAndMemes: 0,
                            activity: 0,
                            gangActivity: 0,
                            other: 0
                        }
                    });
                }

                // Update user's current gang
                user.currentGangId = DEFAULT_GANG;
                user.currentGangName = defaultGang.name;
                user.gangId = DEFAULT_GANG;
                user.gangName = defaultGang.name;

                await user.save();
            }
        }

        // For in-memory database, we can't delete directly, so we'll need to
        // check if we're using the in-memory DB and handle accordingly
        console.log(`Removing gang ${GANG_TO_REMOVE} from database...`);

        try {
            // First try the regular mongoose method
            await Gang.deleteOne({ gangId: GANG_TO_REMOVE });
            console.log('Gang removed using mongoose deleteOne');
        } catch (error) {
            // If that fails, try the in-memory DB method
            console.log('Using in-memory DB remove method...');
            const gangs = await Gang.find();
            const gangToRemoveIndex = gangs.findIndex(g => g.gangId === GANG_TO_REMOVE);

            if (gangToRemoveIndex !== -1) {
                // For in-memory DB, we can just modify the global.Gang.gangs array
                const collections = require('./inMemoryDb').collections;
                collections.gangs.delete(GANG_TO_REMOVE);
                console.log('Gang removed from in-memory database');
            } else {
                console.log(`Gang ${GANG_TO_REMOVE} not found in database`);
            }
        }

        // Update member counts for the default gang
        const defaultGangMemberCount = await User.countDocuments({ currentGangId: DEFAULT_GANG });
        const defaultGang = await Gang.findOne({ gangId: DEFAULT_GANG });

        if (defaultGang) {
            defaultGang.memberCount = defaultGangMemberCount;
            await defaultGang.save();
            console.log(`Updated ${DEFAULT_GANG} member count to ${defaultGangMemberCount}.`);
        }

        console.log('Gang removal completed successfully!');
    } catch (error) {
        console.error('Error removing gang:', error);
    }
}

// Run the function
removeGang()
    .then(() => console.log('Script completed'))
    .catch(err => console.error('Script failed:', err)); 