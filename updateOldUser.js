require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    try {
        // Conectar ao MongoDB
        console.log('Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Conectado ao MongoDB');

        // Acessar a coleção de usuários diretamente
        const userCollection = mongoose.connection.db.collection('users');

        // Buscar o usuário antigo
        const oldUser = await userCollection.findOne({ discordId: "412710839070752778" });

        if (!oldUser) {
            console.error('Usuário antigo não encontrado!');
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log('Usuário antigo encontrado:');
        console.log(`Nome: ${oldUser.username}`);
        console.log(`Gang: ${oldUser.gangName}`);
        console.log(`Pontos: ${oldUser.points}`);

        // Atualizar para o formato novo
        const gangPoints = [{
            gangId: oldUser.gangId || 'nogang',
            gangName: oldUser.gangName || 'No Gang',
            points: oldUser.points || 0,
            weeklyPoints: oldUser.weeklyPoints || 0,
            pointsBreakdown: oldUser.pointsBreakdown || {
                twitter: 0,
                games: 0,
                artAndMemes: 0,
                activity: 0,
                gangActivity: 0,
                other: 0
            },
            weeklyPointsBreakdown: oldUser.weeklyPointsBreakdown || {
                twitter: 0,
                games: 0,
                artAndMemes: 0,
                activity: 0,
                gangActivity: 0,
                other: 0
            }
        }];

        // Atualizar usuário
        const updateResult = await userCollection.updateOne(
            { discordId: oldUser.discordId },
            {
                $set: {
                    currentGangId: oldUser.gangId || 'nogang',
                    currentGangName: oldUser.gangName || 'No Gang',
                    gangPoints: gangPoints
                }
            }
        );

        console.log(`\nAtualização: ${updateResult.matchedCount} documento(s) encontrado(s), ${updateResult.modifiedCount} documento(s) atualizado(s)`);

        // Verificar o usuário atualizado
        const updatedUser = await userCollection.findOne({ discordId: oldUser.discordId });
        console.log('\nUsuário atualizado:');
        console.log(`Nome: ${updatedUser.username}`);
        console.log(`Gang atual: ${updatedUser.currentGangName} (ID: ${updatedUser.currentGangId})`);
        console.log(`Pontos: ${updatedUser.points}`);
        console.log(`Gang points: ${updatedUser.gangPoints ? updatedUser.gangPoints.length : 0} registros`);

        // Desconectar do MongoDB
        await mongoose.disconnect();
        console.log('\nDesconectado do MongoDB');

        process.exit(0);
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main(); 