
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
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Environment variables validation
const MAIN_BACKEND_URL = process.env.MAIN_BACKEND_URL;

if (!MAIN_BACKEND_URL) {
  console.error('❌ MAIN_BACKEND_URL environment variable is required');
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
  apiKey: 'default-api-key',
  clientVersion: '1.0.0',
});

console.log('🔐 Remote license service initialized');

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
  const clientPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 User package server running on port ${PORT}`);
  console.log(`📡 Connected to main backend: ${MAIN_BACKEND_URL}`);
  
  // Auto-launch UI window after server starts (if not in headless environment)
  // Allow auto-launch in development mode for better user experience
  if (!isHeadlessEnvironment()) {
    launchUIWindow();
  }
});

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
