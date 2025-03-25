require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Dados do usuário
const userData = {
    discordId: '363390434835865601', // ID do usuário visto na captura de tela
    username: 'Karaté Kid | HOS |10k>',
    currentGangId: 'nogang',
    currentGangName: 'No Gang',
};

async function main() {
    try {
        // Conectar ao MongoDB
        console.log('Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Conectado ao MongoDB');

        // Verificar se o usuário já existe
        let user = await User.findOne({ discordId: userData.discordId });

        if (user) {
            console.log(`Usuário ${userData.username} já existe. Atualizando...`);

            // Atualizar os campos existentes
            user.username = userData.username;

            if (user.currentGangId !== userData.currentGangId) {
                user.switchGang(userData.currentGangId, userData.currentGangName);
            }
        } else {
            console.log(`Criando novo usuário: ${userData.username}`);

            // Criar um novo usuário
            user = new User({
                discordId: userData.discordId,
                username: userData.username,
                currentGangId: userData.currentGangId,
                currentGangName: userData.currentGangName,
                gangId: userData.currentGangId,  // Para compatibilidade
                gangName: userData.currentGangName,
                points: 0,
                weeklyPoints: 0,
                gangPoints: [{
                    gangId: userData.currentGangId,
                    gangName: userData.currentGangName,
                    points: 0,
                    weeklyPoints: 0,
                    pointsBreakdown: {
                        twitter: 0,
                        games: 0,
                        artAndMemes: 0,
                        activity: 0,
                        gangActivity: 0,
                        other: 0
                    },
                    weeklyPointsBreakdown: {
                        twitter: 0,
                        games: 0,
                        artAndMemes: 0,
                        activity: 0,
                        gangActivity: 0,
                        other: 0
                    }
                }]
            });
        }

        // Salvar o usuário
        await user.save();

        console.log('Usuário salvo com sucesso!');
        console.log(`ID Discord: ${user.discordId}`);
        console.log(`Nome: ${user.username}`);
        console.log(`Gang: ${user.currentGangName}`);
        console.log(`Pontos: ${user.points}`);

        // Desconectar do MongoDB
        await mongoose.disconnect();
        console.log('Desconectado do MongoDB');

        process.exit(0);
    } catch (error) {
        console.error('Erro ao criar/atualizar usuário:', error);
        console.error(error.stack);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main(); 