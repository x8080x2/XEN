import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupLicenseRoutes } from './routes/licenseRoutes';
import { setupEmailRoutes } from './routes/emailRoutes';
import { setupConfigRoutes } from './routes/configRoutes';
import { initializeStorage } from './storage/memoryStorage';
import { apiKeyAuthMiddleware } from './middleware/apiKeyAuth';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enhanced error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

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

// Initialize storage
initializeStorage();

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.MAIN_BACKEND_VERSION || '1.0.0',
  });
});

// API key authentication for all API routes
app.use('/api', apiKeyAuthMiddleware);

// Setup routes
setupLicenseRoutes(app);
setupEmailRoutes(app);
setupConfigRoutes(app);

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

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Email Sender Main Backend running on port ${PORT}`);
  console.log(`🔐 License management enabled`);
  console.log(`📧 Core email services active`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;