import axios from 'axios';
import API_BASE_URL from './api-config';

// Create a base axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Log configuration
console.log('API Client configuration:', {
    baseURL: api.defaults.baseURL,
    environment: process.env.NODE_ENV
});

// Add request interceptor for authentication
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`, config.params || {});
        return config;
    },
    (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => {
        console.log(`API Response from ${response.config.url}:`, response.status);
        return response;
    },
    (error) => {
        // Handle 401 Unauthorized errors (token expired, etc.)
        if (error.response && error.response.status === 401) {
            // Clear authentication data
            localStorage.removeItem('auth_token');

            // Redirect to login page
            window.location.href = '/login';
        }

        console.error('API Response Error:', error.response ? {
            status: error.response.status,
            url: error.config.url,
            data: error.response.data
        } : error.message);

        return Promise.reject(error);
    }
);

export default api; 