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

/**
 * Exporta o leaderboard semanal para uma nova aba no Google Sheets
 * @param {Object} options - Opções
 * @param {String} options.spreadsheetId - ID da planilha do Google
 * @param {Array} options.gangLeaderboard - Array com dados do leaderboard de gangs
 * @param {Array} options.userLeaderboard - Array com dados do leaderboard de usuários
 * @param {Number} options.weekNumber - Número da semana
 * @returns {Promise<Object>} - Resultado da exportação
 */
async function exportWeeklyLeaderboard(options) {
    if (!options.spreadsheetId) {
        throw new Error('ID da planilha do Google é obrigatório');
    }

    try {
        const authClient = await initAuth();
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        // Get existing sheets to find the next available week number
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: options.spreadsheetId
        });

        const existingSheets = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
        console.log('Existing sheets:', existingSheets);

        // Find the highest week number
        let highestWeek = 0;
        existingSheets.forEach(title => {
            if (title.startsWith('Week_')) {
                const weekNum = parseInt(title.replace('Week_', ''));
                if (!isNaN(weekNum) && weekNum > highestWeek) {
                    highestWeek = weekNum;
                }
            }
        });

        // Use the next week number
        const nextWeek = highestWeek + 1;
        const sheetName = `Week_${nextWeek}`;
        console.log(`Creating new sheet: ${sheetName}`);

        // Criar nova aba para a semana
        await ensureSheetExists(sheets, options.spreadsheetId, sheetName);

        // Preparar dados do leaderboard de gangs
        const gangHeaders = [
            'Rank', 'Gang', 'Total Weekly Points', 'Member Points', 'Gang Points', 'Members',
            'Message Activity', 'Gamer', 'Art & Memes', 'Other'
        ];
        const gangRows = options.gangLeaderboard.map((gang, index) => {
            const breakdown = gang.pointsBreakdown || {};
            return [
                (index + 1).toString(),
                gang.name || 'Unknown',
                (gang.totalWeeklyPoints || 0).toString(),
                (gang.weeklyMemberPoints || 0).toString(),
                (gang.weeklyPoints || 0).toString(),
                (gang.memberCount || 0).toString(),
                (breakdown.messageActivity || 0).toString(),
                (breakdown.gamer || 0).toString(),
                (breakdown.artAndMemes || 0).toString(),
                (breakdown.other || 0).toString()
            ];
        });

        // Preparar dados do leaderboard de usuários
        const userHeaders = ['Rank', 'User', 'Gang', 'Weekly Points'];
        const userRows = options.userLeaderboard.map((user, index) => {
            return [
                (index + 1).toString(),
                user.username || 'Unknown',
                user.currentGangName || 'No Gang',
                (user.weeklyPoints || 0).toString()
            ];
        });

        // Combinar todos os dados
        const values = [
            [`Gang Leaderboard - Week ${nextWeek}`],
            gangHeaders,
            ...gangRows,
            [], // Linha vazia para separação
            [`User Leaderboard - Week ${nextWeek}`],
            userHeaders,
            ...userRows
        ];

        // Escrever na planilha
        const result = await sheets.spreadsheets.values.update({
            spreadsheetId: options.spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log(`Successfully wrote ${values.length} rows to sheet ${sheetName}`);

        // Get the sheet ID for formatting
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        const sheetId = sheet ? sheet.properties.sheetId : null;

        if (sheetId) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: options.spreadsheetId,
                resource: {
                    requests: [
                        // Formatar cabeçalhos
                        {
                            repeatCell: {
                                range: {
                                    sheetId: sheetId,
                                    startRowIndex: 0,
                                    endRowIndex: 2,
                                    startColumnIndex: 0,
                                    endColumnIndex: 10
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                                        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                                    }
                                },
                                fields: 'userEnteredFormat(backgroundColor,textFormat)'
                            }
                        },
                        // Ajustar largura das colunas
                        {
                            autoResizeDimensions: {
                                dimensions: {
                                    sheetId: sheetId,
                                    dimension: 'COLUMNS',
                                    startIndex: 0,
                                    endIndex: 10
                                }
                            }
                        }
                    ]
                }
            });
            console.log('Successfully formatted sheet');
        }

        return {
            success: true,
            sheetName,
            weekNumber: nextWeek,
            updatedCells: result.data.updatedCells
        };
    } catch (error) {
        console.error('Erro ao exportar leaderboard semanal para Google Sheets:', error);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    exportPointsLog,
    appendPointLog,
    exportWeeklyLeaderboard
}; 