
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
import { initializeMainLicenseService } from './services/mainLicenseService';
import licenseRoutes from './routes/licenseRoutes';

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
const MAIN_BACKEND_API_KEY = process.env.MAIN_BACKEND_API_KEY;

if (!MAIN_BACKEND_URL) {
  console.error('❌ MAIN_BACKEND_URL environment variable is required');
  console.error('   Please set MAIN_BACKEND_URL to your main backend server URL (e.g., https://your-app.replit.app)');
  process.exit(1);
}

if (!MAIN_BACKEND_API_KEY) {
  console.error('❌ MAIN_BACKEND_API_KEY environment variable is required');
  console.error('   Please set MAIN_BACKEND_API_KEY to match the API key configured on your main backend');
  process.exit(1);
}

// Validate URL format
try {
  const url = new URL(MAIN_BACKEND_URL);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    console.warn('⚠️ WARNING: MAIN_BACKEND_URL is set to localhost. This will not work for customer deployments.');
    console.warn('   Consider using your public Replit URL instead: https://your-app.replit.app');
  }
  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    console.warn('⚠️ WARNING: Using HTTP instead of HTTPS in production may cause issues');
  }
} catch (error) {
  console.error('❌ MAIN_BACKEND_URL is not a valid URL format');
  process.exit(1);
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
  apiKey: MAIN_BACKEND_API_KEY,
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

// Proxy all other API requests to main backend
app.use('/api/*', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${MAIN_BACKEND_URL}${req.originalUrl}`,
      headers: {
        ...req.headers,
        'host': undefined,
        'connection': 'keep-alive',
      },
      data: req.body,
      timeout: 45000, // Increased timeout
      validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx as valid
    });
    
    // Handle 304 Not Modified as success
    if (response.status === 304) {
      res.status(304).end();
      return;
    }
    
    res.status(response.status).json(response.data);
  } catch (error: any) {
    // Only log actual errors, not 304 responses
    if (error.response?.status !== 304) {
      console.error('Proxy error:', error.message);
    }
    
    // Handle timeout specifically
    if (error.code === 'ECONNABORTED') {
      res.status(504).json({
        success: false,
        error: 'Gateway timeout - main backend not responding',
        details: 'The main backend server is taking too long to respond',
      });
      return;
    }
    
    // Handle connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      res.status(502).json({
        success: false,
        error: 'Bad gateway - cannot reach main backend',
        details: 'The main backend server is not available',
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to connect to main backend',
      details: error.response?.data || error.message,
    });
  }
});

// Setup development server with Vite or serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });

  // Start server in production mode
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 User package server running on port ${PORT}`);
    console.log(`📡 Connected to main backend: ${MAIN_BACKEND_URL}`);
    console.log(`🌐 Open your browser to: http://localhost:${PORT}`);
    
    // Auto-launch UI window after server starts (if not in headless environment)
    if (!isHeadlessEnvironment()) {
      launchUIWindow();
    }
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
