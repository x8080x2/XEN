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

// Production security validation
const JWT_SECRET = process.env.JWT_SECRET || 'main-backend-jwt-secret';
if (JWT_SECRET === 'main-backend-jwt-secret' && process.env.NODE_ENV === 'production') {
  console.error('❌ CRITICAL SECURITY ERROR: Default JWT_SECRET is being used in production!');
  console.error('❌ Set JWT_SECRET environment variable to a secure random string.');
  console.error('❌ Application will not start with default JWT_SECRET in production.');
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.error('❌ SECURITY WARNING: JWT_SECRET should be at least 32 characters long.');
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Application will not start with weak JWT_SECRET in production.');
    process.exit(1);
  }
}

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

// Public license validation endpoint (no API key required)
app.post('/api/license/validate', async (req, res) => {
  try {
    const { getStorage } = await import('./storage/memoryStorage');
    const { licenseValidationSchema } = await import('@shared/schema');
    const jwt = await import('jsonwebtoken');
    
    const storage = getStorage();
    // JWT_SECRET is already validated at startup
    
    // Validate request data
    const validation = licenseValidationSchema.parse(req.body);
    const { licenseKey, machineFingerprint, clientVersion } = validation;

    // Get license from storage
    const license = storage.getLicenseByKey(licenseKey);
    
    if (!license) {
      return res.status(404).json({
        success: false,
        error: 'License not found',
        code: 'LICENSE_NOT_FOUND'
      });
    }

    // Check license status
    if (license.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `License is ${license.status}`,
        code: 'LICENSE_INACTIVE'
      });
    }

    // Check expiration
    if (license.expiresAt < new Date()) {
      // Update status to expired
      storage.updateLicense(licenseKey, { status: 'expired' });
      
      return res.status(403).json({
        success: false,
        error: 'License has expired',
        code: 'LICENSE_EXPIRED'
      });
    }

    // Check machine fingerprint for license binding
    if (machineFingerprint && license.machineFingerprint) {
      if (license.machineFingerprint !== machineFingerprint) {
        return res.status(403).json({
          success: false,
          error: 'License is bound to a different machine',
          code: 'MACHINE_MISMATCH'
        });
      }
    } else if (machineFingerprint && !license.machineFingerprint) {
      // Bind license to this machine on first use
      storage.updateLicense(licenseKey, { 
        machineFingerprint,
        activationCount: license.activationCount + 1,
        lastValidated: new Date()
      });
    }

    // Check activation limit
    if (license.activationCount >= license.maxActivations && license.machineFingerprint !== machineFingerprint) {
      return res.status(403).json({
        success: false,
        error: 'License activation limit exceeded',
        code: 'ACTIVATION_LIMIT_EXCEEDED'
      });
    }

    // Get current month's email usage
    const emailsUsedThisMonth = storage.getMonthlyEmailUsage(license.id);
    
    // Update license with current usage and last validated
    const updatedLicense = storage.updateLicense(licenseKey, {
      emailsUsedThisMonth,
      lastValidated: new Date()
    });

    if (!updatedLicense) {
      throw new Error('Failed to update license');
    }

    // Create JWT token
    const tokenPayload = {
      licenseId: license.id,
      licenseKey: license.licenseKey,
      userId: license.userId,
      userEmail: license.userEmail,
      planType: license.planType,
      features: license.features,
      emailsUsedThisMonth,
      expiresAt: license.expiresAt.getTime(),
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: '24h', // Token expires in 24 hours
      issuer: 'email-sender-main-backend',
      audience: 'email-sender-client',
    });

    res.json({
      success: true,
      license: updatedLicense,
      token,
    });

    console.log(`✅ Public license validated: ${license.userEmail} (${license.planType}) - ${emailsUsedThisMonth}/${license.features.maxEmailsPerMonth} emails used`);

  } catch (error: any) {
    console.error('Public license validation error:', error);
    res.status(500).json({
      success: false,
      error: 'License validation failed',
      details: error.message,
      code: 'VALIDATION_ERROR'
    });
  }
});

// API key authentication for admin routes only (not email routes)
app.use('/api/license/create', apiKeyAuthMiddleware);
app.use('/api/license/list', apiKeyAuthMiddleware);
app.use('/api/license/revoke', apiKeyAuthMiddleware);
app.use('/api/license/update', apiKeyAuthMiddleware);
app.use('/api/config', apiKeyAuthMiddleware);
app.use('/api/admin', apiKeyAuthMiddleware);

// Email routes use JWT authentication (for customer access)
// These routes are accessed by Windows package clients with JWT Bearer tokens

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