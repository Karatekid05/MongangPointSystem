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

        // Encontrar todos os usuários
        console.log('Buscando todos os usuários...');
        const users = await userCollection.find({}).toArray();

        console.log(`Encontrados ${users.length} usuários no banco de dados:`);

        // Mostrar informações de cada usuário
        for (const user of users) {
            console.log('\n----------------------------------');
            console.log(`ID MongoDB: ${user._id}`);
            console.log(`ID Discord: ${user.discordId}`);
            console.log(`Nome: ${user.username}`);
            console.log(`Gang atual: ${user.currentGangName} (ID: ${user.currentGangId})`);
            console.log(`Pontos: ${user.points}`);
            console.log(`Pontos semanais: ${user.weeklyPoints}`);

            // Mostrar documento completo para debug
            console.log('\nDocumento completo:');
            console.log(JSON.stringify(user, null, 2));
        }

        // Desconectar do MongoDB
        await mongoose.disconnect();
        console.log('\nDesconectado do MongoDB');

        process.exit(0);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main(); 