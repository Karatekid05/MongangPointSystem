require('dotenv').config();
const mongoose = require('mongoose');
const { resetUserPoints } = require('./utils/pointsManager');

// O ID do Discord do usuário cujos pontos serão zerados
const USER_ID_TO_RESET = 'SEU_ID_DO_DISCORD_AQUI';

async function main() {
    try {
        // Conectar ao MongoDB
        console.log('Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Conectado ao MongoDB');

        // Resetar os pontos do usuário
        console.log(`Resetando pontos para o usuário com ID: ${USER_ID_TO_RESET}`);
        const updatedUser = await resetUserPoints(USER_ID_TO_RESET);

        console.log('Pontos zerados com sucesso!');
        console.log(`Usuário: ${updatedUser.username}`);
        console.log(`Pontos atuais: ${updatedUser.points}`);
        console.log(`Pontos semanais: ${updatedUser.weeklyPoints}`);

        // Desconectar do MongoDB
        await mongoose.disconnect();
        console.log('Desconectado do MongoDB');

        process.exit(0);
    } catch (error) {
        console.error('Erro ao resetar pontos:', error);
        process.exit(1);
    }
}

main(); 