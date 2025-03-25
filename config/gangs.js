/**
 * Gangs configuration
 * 
 * This file defines all the gangs in the system with their respective Discord role IDs and channel IDs.
 * When a user changes roles, the system will automatically assign them to the corresponding gang and
 * keep track of their points in each gang they've been a part of.
 * 
 * Make sure each gang has a unique gangId that doesn't change, even if the name or other details change.
 */

const gangsConfig = [
    {
        name: 'Sea Kings',
        gangId: 'sea-kings-1',
        roleId: '1353403611106770967', // Sea Kings role ID
        channelId: '1349463574803906662' // Sea Kings channel ID
    },
    {
        name: 'Thunder Birds',
        gangId: 'thunder-birds-1',
        roleId: '1353403620602941500', // Thunder Birds role ID
        channelId: '1349463616365006849' // Thunder Birds channel ID
    },
    {
        name: 'Fluffy Ninjas',
        gangId: 'fluffy-ninjas-1',
        roleId: '1353403632187346954', // Fluffy Ninjas role ID
        channelId: '1349463693758562304' // Fluffy Ninjas channel ID
    },
    {
        name: 'Chunky Cats',
        gangId: 'chunky-cats-1',
        roleId: '1353403626168516668', // Chunky Cats role ID
        channelId: '1349463663949516951' // Chunky Cats channel ID
    }
];

module.exports = { gangsConfig }; 