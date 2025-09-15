
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { initializeMainLicenseService } from './services/mainLicenseService';
import licenseRoutes from './routes/licenseRoutes';
import configRoutes from './routes/configRoutes';
import smtpRoutes from './routes/smtpRoutes';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Environment variables validation
const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL;
const PACKAGE_TOKEN = process.env.PACKAGE_TOKEN;

if (!MAIN_BACKEND_URL) {
  console.error('❌ MAIN_BACKEND_URL environment variable is required');
  console.error('   Example: https://your-main-service.replit.app');
  process.exit(1);
}

if (!PACKAGE_TOKEN) {
  console.warn('⚠️  PACKAGE_TOKEN not provided - some features may be limited');
  console.warn('   Contact your service administrator to get a package token');
}

console.log(`📡 Connecting to main backend: ${MAIN_BACKEND_URL}`);

// Runtime sanity check for production deployment
if (process.env.NODE_ENV === 'production') {
  const clientIndexPath = path.join(__dirname, '../client/dist/index.html');
  const serverDistPath = path.join(__dirname, 'index.js');
  
  if (!fs.existsSync(clientIndexPath)) {
    console.error('❌ DISTRIBUTION ERROR: Client build files not found!');
    console.error(`   Missing: ${clientIndexPath}`);
    console.error('   This package appears to be incomplete or not properly built.');
    console.error('   Please ensure the package was created with: npm run package');
    console.error('   The client application needs to be built before distribution.');
    process.exit(1);
  }
  
  if (!fs.existsSync(serverDistPath)) {
    console.error('❌ DISTRIBUTION ERROR: Server build files not found!');
    console.error(`   Missing: ${serverDistPath}`);
    console.error('   This package appears to be incomplete or not properly built.');
    console.error('   Please ensure the package was created with: npm run package');
    process.exit(1);
  }
  
  console.log('✅ Distribution integrity verified - all required files found');
}

// JWT Security validation
const JWT_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET === 'default-secret')) {
  console.error('❌ SECURITY: JWT_SECRET environment variable must be set to a secure value in production');
  console.error('   Please set JWT_SECRET to a strong random string before starting in production mode');
  process.exit(1);
}

// Initialize license service for remote validation
initializeMainLicenseService({
  jwtSecret: JWT_SECRET || 'default-secret',
  mainBackendUrl: MAIN_BACKEND_URL,
  apiKey: 'default-api-key',
  clientVersion: '1.0.0',
});

console.log('🔐 Remote license service initialized');

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const response = await axios.get(`${MAIN_BACKEND_URL}/api/health`, {
      timeout: 10000,
    });
    res.json({
      success: true,
      status: 'healthy',
      mainBackend: {
        url: MAIN_BACKEND_URL,
        status: response.status,
        available: true,
      },
    });
  } catch (error: any) {
    res.status(200).json({
      success: false,
      status: 'degraded',
      mainBackend: {
        url: MAIN_BACKEND_URL,
        available: false,
        error: error.message,
      },
    });
  }
});

// License management routes only
app.use('/api/license', licenseRoutes);

// Local configuration management routes (handled locally, not proxied)
app.use('/api/config', configRoutes);
app.use('/api/smtp', smtpRoutes);

console.log('🔧 Local configuration routes registered');
console.log('   - /api/config/* - Local setup configuration');
console.log('   - /api/smtp/* - Local SMTP configuration');

// Configure streaming proxy for main backend with package token authentication
const streamingProxy = createProxyMiddleware({
  target: MAIN_BACKEND_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  timeout: 45000,
  proxyTimeout: 45000,
  
  // Path rewriter for special routing
  pathRewrite: (path) => {
    // Special handling for sendMail requests - route to user-package endpoint
    if (path.includes('/api/original/sendMail')) {
      return path.replace('/api/original/sendMail', '/api/user-package/sendMail');
    }
    return path;
  },
  
  // Header modification
  onProxyReq: (proxyReq, req) => {
    // Filter out sensitive headers
    const sensitiveHeaders = ['cookie', 'authorization', 'x-admin-secret'];
    sensitiveHeaders.forEach(header => {
      proxyReq.removeHeader(header);
    });
    
    // Add package token authentication
    if (PACKAGE_TOKEN) {
      proxyReq.setHeader('x-package-token', PACKAGE_TOKEN);
    }
    
    // Ensure proper host header
    proxyReq.setHeader('host', new URL(MAIN_BACKEND_URL).host);
    
    // For multipart/form-data requests, ensure proper content-length
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Let the proxy handle content-length automatically for multipart data
      proxyReq.removeHeader('content-length');
    }
  },
  
  // Handle streaming responses like SSE
  onProxyRes: (proxyRes, req, res) => {
    // Preserve streaming headers for SSE
    if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    }
  },
  
  // Error handling
  onError: (err, req, res) => {
    console.error('Streaming proxy error:', err.message);
    
    // Handle different error types
    if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
      res.status(504).json({
        success: false,
        error: 'Gateway timeout - main backend not responding',
        details: 'The main backend server is taking too long to respond',
      });
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      res.status(502).json({
        success: false,
        error: 'Bad gateway - cannot reach main backend',
        details: 'The main backend server is not available',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Proxy error',
        details: err.message,
      });
    }
  },
  
  // Enable logging for debugging
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
});

// Apply streaming proxy with exclusions for specific endpoints
app.use((req, res, next) => {
  // Skip proxy for health, license, config, smtp, and static assets
  if (req.path === '/api/health' || 
      req.path.startsWith('/api/license') ||
      req.path.startsWith('/api/config') ||
      req.path.startsWith('/api/smtp') ||
      !req.path.startsWith('/api/')) {
    return next();
  }
  
  // Use streaming proxy for all other API routes
  streamingProxy(req, res, next);
});

// Setup development server with Vite or serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
} else {
  // Development mode - setup Vite
  const { setupVite } = await import('./vite');
  const server = await new Promise<any>((resolve) => {
    const httpServer = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 User package server running on port ${PORT}`);
      console.log(`📡 Connected to main backend: ${MAIN_BACKEND_URL}`);
      resolve(httpServer);
    });
  });
  
  await setupVite(app, server);
  
  // Auto-launch UI window after server starts (if not in headless environment)
  if (!isHeadlessEnvironment()) {
    launchUIWindow();
  }
}

// Function to detect headless environments
function isHeadlessEnvironment() {
  // Check for common CI/headless environment indicators
  const headlessIndicators = [
    'CI', 'CONTINUOUS_INTEGRATION', 'GITHUB_ACTIONS', 'GITLAB_CI',
    'TRAVIS', 'CIRCLECI', 'JENKINS_URL', 'BUILDKITE', 'DRONE',
    'REPLIT', 'CODESPACES', 'GITPOD_WORKSPACE_ID'
  ];
  
  // Check if any CI/headless environment variables are set
  if (headlessIndicators.some(indicator => process.env[indicator])) {
    return true;
  }
  
  // Check for DISPLAY environment (Linux/Unix)
  if (os.platform() === 'linux' && !process.env.DISPLAY) {
    return true;
  }
  
  return false;
}

// Function to launch UI window
function launchUIWindow() {
  const url = `http://localhost:${PORT}`;
  const platform = os.platform();
  
  let command = '';
  
  switch (platform) {
    case 'darwin': // macOS
      command = `open "${url}"`;
      break;
    case 'win32': // Windows
      command = `start "" "${url}"`;
      break;
    case 'linux': // Linux
      command = `xdg-open "${url}"`;
      break;
    default:
      console.log(`🌐 Please open your browser to: ${url}`);
      return;
  }
  
  exec(command, (error) => {
    if (error) {
      console.log(`⚠️ Could not auto-launch UI. Please open: ${url}`);
      console.log(`Error: ${error.message}`);
    } else {
      console.log(`🖥️ UI launched successfully at: ${url}`);
    }
  });
}
