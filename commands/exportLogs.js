const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { exportPointsLog } = require('../utils/sheetsLogger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('exportlogs')
        .setDescription('Exporta logs de pontos para Google Sheets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('sheet_id')
                .setDescription('ID da planilha Google (opcional, usa a configurada no .env por padrão)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('tab_name')
                .setDescription('Nome da aba da planilha (padrão: Points Log)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('start_date')
                .setDescription('Data inicial no formato YYYY-MM-DD (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('end_date')
                .setDescription('Data final no formato YYYY-MM-DD (opcional)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Pegar os argumentos
            const spreadsheetId = interaction.options.getString('sheet_id') || process.env.GOOGLE_SHEET_ID;
            const sheetName = interaction.options.getString('tab_name') || 'Points Log';
            const startDate = interaction.options.getString('start_date');
            const endDate = interaction.options.getString('end_date');

            if (!spreadsheetId) {
                return interaction.editReply('É necessário fornecer um ID de planilha Google ou configurar GOOGLE_SHEET_ID no .env');
            }

            // Configurar as opções
            const options = {
                spreadsheetId,
                sheetName
            };

            if (startDate) {
                options.startDate = new Date(startDate);
                if (isNaN(options.startDate.getTime())) {
                    return interaction.editReply('Formato de data inicial inválido. Use YYYY-MM-DD.');
                }
            }

            if (endDate) {
                options.endDate = new Date(endDate);
                if (isNaN(options.endDate.getTime())) {
                    return interaction.editReply('Formato de data final inválido. Use YYYY-MM-DD.');
                }
            }

            // Exportar logs
            const result = await exportPointsLog(options);

            if (result.success) {
                return interaction.editReply(`✅ ${result.logCount} logs exportados com sucesso para a planilha Google!\n`
                    + `Link: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`);
            } else {
                return interaction.editReply(`❌ Erro ao exportar logs: ${result.error}`);
            }

        } catch (error) {
            console.error('Erro no comando exportLogs:', error);
            return interaction.editReply('Ocorreu um erro ao exportar os logs. Verifique o console para mais detalhes.');
        }
    }
}; 