
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeMainLicenseService } from './services/mainLicenseService';
import licenseRoutes from './routes/licenseRoutes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Environment variables validation
const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL;
const MAIN_BACKEND_API_KEY = process.env.MAIN_BACKEND_API_KEY;

if (!MAIN_BACKEND_URL) {
  console.error('❌ MAIN_BACKEND_URL environment variable is required');
  process.exit(1);
}

if (!MAIN_BACKEND_API_KEY) {
  console.error('❌ MAIN_BACKEND_API_KEY environment variable is required');
  process.exit(1);
}

console.log(`📡 Connecting to main backend: ${MAIN_BACKEND_URL}`);

// Initialize license service for remote validation
initializeMainLicenseService({
  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  mainBackendUrl: MAIN_BACKEND_URL,
  apiKey: MAIN_BACKEND_API_KEY,
  clientVersion: '1.0.0',
});

console.log('🔐 Remote license service initialized');

// License management routes only
app.use('/api/license', licenseRoutes);

// Proxy all other API requests to main backend
app.use('/api/*', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios({
      method: req.method,
      url: `${MAIN_BACKEND_URL}${req.originalUrl}`,
      headers: {
        ...req.headers,
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
        'host': undefined,
      },
      data: req.body,
      timeout: 30000,
    });
    
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to main backend',
      details: error.response?.data || error.message,
    });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 User package server running on port ${PORT}`);
  console.log(`📡 Connected to main backend: ${MAIN_BACKEND_URL}`);
});
