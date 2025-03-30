const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { User } = require('../utils/dbModels');
const { gangsConfig } = require('../config/gangs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Ver informações detalhadas do usuário')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('O usuário para verificar (padrão: você mesmo)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        // Obter o usuário do Discord (padrão: o autor do comando)
        const discordUser = interaction.options.getUser('user') || interaction.user;

        try {
            // Tentar obter o membro do servidor (necessário para verificar os cargos)
            const member = await interaction.guild.members.fetch(discordUser.id).catch(() => null);

            if (!member) {
                return interaction.editReply(`Não foi possível encontrar ${discordUser.username} neste servidor.`);
            }

            // Verificar se o usuário tem algum cargo de gang
            const userRoles = member.roles.cache.map(role => role.id);
            const userGang = gangsConfig.find(gang => userRoles.includes(gang.roleId));

            // Obter o usuário do banco de dados (se existir)
            const user = await User.findOne({ discordId: discordUser.id });

            // Determinar a gang baseada no cargo ou nos dados do banco
            const gangName = userGang ? userGang.name : 'No Gang';
            const points = user?.points || 0;
            const weeklyPoints = user?.weeklyPoints || 0;

            // Criar embed com informações detalhadas
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${discordUser.username}'s Points Information`)
                .setDescription(`Detailed points information for ${discordUser}`)
                .setThumbnail(discordUser.displayAvatarURL())
                .addFields(
                    { name: 'Current Gang', value: gangName, inline: true },
                    { name: 'Total Points', value: `${points} points`, inline: true },
                    { name: 'Weekly Points', value: `${weeklyPoints} points`, inline: true }
                )
                .setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in userinfo command:', error);
            return interaction.editReply('There was an error fetching user information.');
        }
    }
};

/**
 * Format the category name to be more readable
 * @param {String} category - The category name from the database
 * @returns {String} - The formatted category name
 */
function formatCategoryName(category) {
    switch (category) {
        case 'twitter':
            return 'Twitter';
        case 'games':
            return 'Games';
        case 'artAndMemes':
            return 'Art & Memes';
        case 'activity':
            return 'General Activity';
        case 'gangActivity':
            return 'Gang Activity';
        case 'other':
            return 'Other';
        default:
            return category.charAt(0).toUpperCase() + category.slice(1);
    }
}

function formatSourceKey(key) {
    switch (key) {
        case 'games':
            return 'Games';
        case 'artAndMemes':
            return 'Art & Memes';
        case 'activity':
            return 'Activity';
        case 'gangActivity':
            return 'Gang Activity';
        case 'other':
            return 'Other';
        default:
            return key.charAt(0).toUpperCase() + key.slice(1);
    }
}