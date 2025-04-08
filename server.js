const express = require('express');
const cors = require('cors');
const { User, Gang, ActivityLog } = require('./utils/dbModels');

const app = express();
const PORT = process.env.PORT || 3002;

// Configurar CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*', // Será configurado para seu domínio Vercel
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// Rota de teste
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running' });
});

// Obter todos os usuários
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter todas as gangs
app.get('/api/gangs', async (req, res) => {
    try {
        const gangs = await Gang.find({});
        res.json(gangs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const users = await User.find({})
            .sort({ weeklyPoints: -1 })
            .limit(10);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter leaderboard de gangs
app.get('/api/gangs/leaderboard', async (req, res) => {
    try {
        const gangs = await Gang.find({})
            .sort({ weeklyPoints: -1 });
        res.json(gangs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
}); 