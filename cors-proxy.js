const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// CORS configuration to allow Vercel domains
app.use(cors({
    origin: ['https://mongang-dashboard.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Additional CORS headers for mixed content issues
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://mongang-dashboard.vercel.app');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// Proxy route for API
app.all('/api/*', async (req, res) => {
    try {
        const targetUrl = `http://localhost:3002${req.originalUrl}`;
        console.log(`Proxying request to: ${targetUrl}`);

        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.method !== 'GET' ? req.body : undefined,
            headers: {
                ...req.headers,
                host: 'localhost:3002'
            },
            validateStatus: () => true // Don't throw on any status
        });

        // Forward headers
        Object.entries(response.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

const PORT = process.env.PROXY_PORT || 3006;
app.listen(PORT, () => {
    console.log(`CORS Proxy server running on port ${PORT}`);
    console.log(`Make sure Vercel points to http://159.89.98.92:3006/api`);
}); 