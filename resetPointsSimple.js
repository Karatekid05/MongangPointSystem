require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    try {
        // Conectar ao MongoDB
        console.log('Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Conectado ao MongoDB');

        // Acessar as coleções diretamente
        const userCollection = mongoose.connection.db.collection('users');
        const gangCollection = mongoose.connection.db.collection('gangs');

        // 1. Zerar pontos de todos os usuários
        console.log('Zerando pontos dos usuários...');

        const userIdsToReset = ["412710839070752778", "363390434835865601"]; // IDs dos usuários

        for (const userId of userIdsToReset) {
            const user = await userCollection.findOne({ discordId: userId });

            if (user) {
                console.log(`Resetando pontos para: ${user.username}`);

                // Resetar pontos principais
                await userCollection.updateOne(
                    { discordId: userId },
                    {
                        $set: {
                            points: 0,
                            weeklyPoints: 0,
                            pointsBreakdown: {
                                messageActivity: 0,
                                gamer: 0,
                                artAndMemes: 0,
                                other: 0
                            },
                            weeklyPointsBreakdown: {
                                messageActivity: 0,
                                gamer: 0,
                                artAndMemes: 0,
                                other: 0
                            }
                        }
                    }
                );

                // Se tiver gangPoints, resetar também
                if (user.gangPoints && user.gangPoints.length > 0) {
                    for (let i = 0; i < user.gangPoints.length; i++) {
                        await userCollection.updateOne(
                            { discordId: userId },
                            {
                                $set: {
                                    [`gangPoints.${i}.points`]: 0,
                                    [`gangPoints.${i}.weeklyPoints`]: 0,
                                    [`gangPoints.${i}.pointsBreakdown.messageActivity`]: 0,
                                    [`gangPoints.${i}.pointsBreakdown.gamer`]: 0,
                                    [`gangPoints.${i}.pointsBreakdown.artAndMemes`]: 0,
                                    [`gangPoints.${i}.pointsBreakdown.other`]: 0,
                                    [`gangPoints.${i}.weeklyPointsBreakdown.messageActivity`]: 0,
                                    [`gangPoints.${i}.weeklyPointsBreakdown.gamer`]: 0,
                                    [`gangPoints.${i}.weeklyPointsBreakdown.artAndMemes`]: 0,
                                    [`gangPoints.${i}.weeklyPointsBreakdown.other`]: 0
                                }
                            }
                        );
                    }
                }

                console.log(`Pontos zerados para: ${user.username}`);
            }
        }

        // 2. Zerar pontos das gangs
        const gangs = await gangCollection.find({}).toArray();
        if (gangs && gangs.length > 0) {
            console.log(`\nZerando pontos de ${gangs.length} gangs...`);

            for (const gang of gangs) {
                await gangCollection.updateOne(
                    { _id: gang._id },
                    {
                        $set: {
                            points: 0,
                            totalMemberPoints: 0,
                            messageCount: 0,
                            weeklyPoints: 0,
                            weeklyMemberPoints: 0,
                            weeklyMessageCount: 0,
                            'pointsBreakdown.events': 0,
                            'pointsBreakdown.competitions': 0,
                            'pointsBreakdown.other': 0,
                            'weeklyPointsBreakdown.events': 0,
                            'weeklyPointsBreakdown.competitions': 0,
                            'weeklyPointsBreakdown.other': 0
                        }
                    }
                );
            }

            console.log('Pontos das gangs zerados.');
        }

        // Verificar usuários atualizados
        console.log('\nVerificando usuários atualizados:');
        for (const userId of userIdsToReset) {
            const updatedUser = await userCollection.findOne({ discordId: userId });
            if (updatedUser) {
                console.log(`- ${updatedUser.username}: ${updatedUser.points} pontos (${updatedUser.weeklyPoints} semanais)`);
            }
        }

        // Desconectar do MongoDB
        await mongoose.disconnect();
        console.log('\nPontos zerados com sucesso! MongoDB desconectado.');

        process.exit(0);
    } catch (error) {
        console.error('Erro ao resetar pontos:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main(); 