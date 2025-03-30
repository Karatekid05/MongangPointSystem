/**
 * Exporta logs de pontos para o Google Sheets
 */
const { google } = require('googleapis');
const { ActivityLog } = require('./dbModels');

// Cache para credenciais autenticadas
let auth = null;

/**
 * Inicializa a autenticação com o Google
 * É necessário configurar GOOGLE_APPLICATION_CREDENTIALS no .env
 * e ter criado um projeto no Google Cloud com API Sheets ativada
 */
async function initAuth() {
    if (auth) return auth;

    try {
        // Usa as credenciais configuradas no ambiente
        auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        return auth;
    } catch (error) {
        console.error('Erro ao inicializar autenticação Google:', error);
        throw error;
    }
}

/**
 * Exporta logs de pontos para o Google Sheets
 * @param {Object} options - Opções
 * @param {String} options.spreadsheetId - ID da planilha do Google
 * @param {String} options.sheetName - Nome da aba (padrão: 'Points Log')
 * @param {Date} options.startDate - Data inicial (opcional)
 * @param {Date} options.endDate - Data final (opcional)
 * @returns {Promise<Object>} - Resultado da exportação
 */
async function exportPointsLog(options) {
    if (!options.spreadsheetId) {
        throw new Error('ID da planilha do Google é obrigatório');
    }

    try {
        const authClient = await initAuth();
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        // Definir cabeçalho da planilha
        const headers = [
            'Timestamp', 'User ID', 'Username', 'Points',
            'Source', 'Awarded By', 'Awarded By Username', 'Reason'
        ];

        // Buscar logs (em memória ou MongoDB)
        let logs = await ActivityLog.find({});

        // Filtrar por data se especificado
        if (options.startDate) {
            logs = logs.filter(log => new Date(log.createdAt) >= new Date(options.startDate));
        }
        if (options.endDate) {
            logs = logs.filter(log => new Date(log.createdAt) <= new Date(options.endDate));
        }

        // Filtrar apenas logs de atribuição de pontos
        logs = logs.filter(log => log.action === 'award' || log.action === 'deduct');

        // Converter logs para formato de planilha
        const rows = logs.map(log => [
            new Date(log.createdAt).toLocaleString(),
            log.targetId,
            log.targetName,
            log.points.toString(),
            log.source || 'N/A',
            log.awardedBy || 'Sistema',
            log.awardedByUsername || 'Sistema',
            log.reason || 'N/A'
        ]);

        // Adicionar cabeçalho
        const values = [headers, ...rows];

        // Verificar se a aba existe e criar se necessário
        const sheetName = options.sheetName || 'Points Log';
        await ensureSheetExists(sheets, options.spreadsheetId, sheetName);

        // Escrever na planilha
        const result = await sheets.spreadsheets.values.update({
            spreadsheetId: options.spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            resource: { values }
        });

        return {
            success: true,
            updatedCells: result.data.updatedCells,
            logCount: rows.length
        };
    } catch (error) {
        console.error('Erro ao exportar logs para Google Sheets:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Garante que a aba existe na planilha
 * @param {Object} sheets - Cliente do Google Sheets
 * @param {String} spreadsheetId - ID da planilha
 * @param {String} sheetName - Nome da aba
 */
async function ensureSheetExists(sheets, spreadsheetId, sheetName) {
    try {
        // Obter informações sobre a planilha
        const response = await sheets.spreadsheets.get({
            spreadsheetId
        });

        // Verificar se a aba já existe
        const sheetExists = response.data.sheets.some(
            sheet => sheet.properties.title === sheetName
        );

        // Se não existir, criar a aba
        if (!sheetExists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }]
                }
            });
        }
    } catch (error) {
        console.error('Erro ao verificar/criar aba:', error);
        throw error;
    }
}

/**
 * Adicionar um novo log de pontos diretamente na planilha
 * @param {Object} logData - Dados do log
 * @param {String} spreadsheetId - ID da planilha
 * @param {String} sheetName - Nome da aba (padrão: 'Points Log')
 */
async function appendPointLog(logData, spreadsheetId, sheetName = 'Points Log') {
    if (!spreadsheetId) {
        console.error('ID da planilha não configurado. Ignorando log.');
        return;
    }

    try {
        const authClient = await initAuth();
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        // Garantir que a aba existe
        await ensureSheetExists(sheets, spreadsheetId, sheetName);

        // Formatar os dados para a planilha
        const values = [[
            new Date().toLocaleString(),
            logData.targetId,
            logData.targetName,
            logData.points.toString(),
            logData.source || 'N/A',
            logData.awardedBy || 'Sistema',
            logData.awardedByUsername || 'Sistema',
            logData.reason || 'N/A'
        ]];

        // Anexar os dados na próxima linha disponível
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values }
        });

        console.log('Log adicionado com sucesso ao Google Sheets');
    } catch (error) {
        console.error('Erro ao adicionar log ao Google Sheets:', error);
    }
}

module.exports = {
    exportPointsLog,
    appendPointLog
}; 