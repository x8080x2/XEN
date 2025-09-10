import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initializeLicenseService } from './services/licenseService';
import { setupClientRoutes } from './routes/clientRoutes';
import { setupProxyRoutes } from './routes/proxyRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enhanced error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Initialize license service
const licenseConfig = {
  jwtSecret: process.env.JWT_SECRET || 'client-jwt-secret-key',
  mainBackendUrl: process.env.MAIN_BACKEND_URL || 'https://email-sender-main.onrender.com',
  apiKey: process.env.MAIN_BACKEND_API_KEY || '',
  clientVersion: process.env.CLIENT_VERSION || '1.0.0',
};

if (!licenseConfig.apiKey) {
  console.error('MAIN_BACKEND_API_KEY environment variable is required');
  process.exit(1);
}

initializeLicenseService(licenseConfig);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Setup routes
setupClientRoutes(app);
setupProxyRoutes(app);

// Serve static files (if building a client app)
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(staticPath));
  
  // Catch-all handler for SPA
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(staticPath, 'index.html'));
    }
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({ 
    success: false,
    error: message,
    code: 'SERVER_ERROR'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Email Sender Client running on port ${PORT}`);
  console.log(`📡 Connected to main backend: ${licenseConfig.mainBackendUrl}`);
  console.log(`🔑 Client version: ${licenseConfig.clientVersion}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;