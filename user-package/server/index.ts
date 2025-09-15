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
import { configService } from './services/configService';

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

// Initialize free license service
initializeMainLicenseService();

console.log('🔐 Free access enabled - no license required');

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

// Add specific routes for user package functionality
app.post('/api/smtp/toggle-rotation', async (req, res) => {
  try {
    const response = await axios.post(`${MAIN_BACKEND_URL}/api/smtp/toggle-rotation`, req.body, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('SMTP rotation proxy error, falling back to local toggle:', error.message);
    // Fallback to local SMTP rotation toggle
    const { configService } = await import('./services/configService');
    const { enabled } = req.body;
    configService.setSmtpRotation(enabled);

    res.json({
      success: true,
      rotationEnabled: configService.isSmtpRotationEnabled(),
      currentSmtp: configService.getCurrentSmtpConfig()
    });
  }
});

app.get('/api/config/load', async (req, res) => {
  try {
    const response = await axios.get(`${MAIN_BACKEND_URL}/api/config/load`, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('Config load proxy error, falling back to local config:', error.message);
    // Fallback to local config
    const { configService } = await import('./services/configService');
    const localConfig = configService.loadLocalConfig();
    res.json({ success: true, config: localConfig });
  }
});

app.get('/api/config/loadLeads', async (req, res) => {
  try {
    const response = await axios.get(`${MAIN_BACKEND_URL}/api/config/loadLeads`, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('Leads load proxy error, falling back to local leads:', error.message);
    // Fallback to local leads
    const { configService } = await import('./services/configService');
    const localLeads = configService.loadLocalLeads();
    res.json({ success: true, leads: localLeads });
  }
});

// Local SMTP management routes with fallback
app.get('/api/smtp/list', async (req, res) => {
  try {
    const response = await axios.get(`${MAIN_BACKEND_URL}/api/smtp/list`, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('SMTP list proxy error, falling back to local SMTP configs:', error.message);
    // Fallback to local SMTP configs
    const { configService } = await import('./services/configService');
    const smtpConfigs = configService.getAllSmtpConfigs();
    const currentSmtp = configService.getCurrentSmtpConfig();
    const rotationEnabled = configService.isSmtpRotationEnabled();

    res.json({
      success: true,
      smtpConfigs: smtpConfigs,
      currentSmtp: currentSmtp,
      rotationEnabled: rotationEnabled
    });
  }
});

app.post('/api/smtp/add', async (req, res) => {
  try {
    const response = await axios.post(`${MAIN_BACKEND_URL}/api/smtp/add`, req.body, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('SMTP add proxy error, falling back to local addition:', error.message);
    // Fallback to local SMTP addition
    const { configService } = await import('./services/configService');
    const smtpId = configService.addSmtpConfig(req.body);
    const smtpConfigs = configService.getAllSmtpConfigs();

    res.json({
      success: true,
      smtpId: smtpId,
      smtpConfigs: smtpConfigs
    });
  }
});

app.delete('/api/smtp/:smtpId', async (req, res) => {
  try {
    const response = await axios.delete(`${MAIN_BACKEND_URL}/api/smtp/${req.params.smtpId}`, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('SMTP delete proxy error, falling back to local deletion:', error.message);
    // Fallback to local SMTP deletion
    const { configService } = await import('./services/configService');
    const success = configService.deleteSmtpConfig(req.params.smtpId);

    if (success) {
      const smtpConfigs = configService.getAllSmtpConfigs();
      const currentSmtp = configService.getCurrentSmtpConfig();

      res.json({
        success: true,
        smtpConfigs: smtpConfigs,
        currentSmtp: currentSmtp
      });
    } else {
      res.status(400).json({ success: false, error: 'Cannot delete SMTP or not found' });
    }
  }
});

app.post('/api/smtp/rotate', async (req, res) => {
  try {
    const response = await axios.post(`${MAIN_BACKEND_URL}/api/smtp/rotate`, req.body, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('SMTP rotate proxy error, falling back to local rotation:', error.message);
    // Fallback to local SMTP rotation
    const { configService } = await import('./services/configService');
    const currentSmtp = configService.rotateSmtp();

    res.json({
      success: true,
      currentSmtp: currentSmtp
    });
  }
});

app.get('/api/original/listFiles', async (req, res) => {
  try {
    const response = await axios.get(`${MAIN_BACKEND_URL}/api/original/listFiles`, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('Files list proxy error, falling back to local files:', error.message);
    // Fallback to local files
    try {
      const filesDir = path.join(process.cwd(), 'files');
      if (fs.existsSync(filesDir)) {
        const files = fs.readdirSync(filesDir).filter(f => /\.html$|\.htm$/i.test(f));
        res.json({ success: true, files });
      } else {
        res.json({ success: true, files: [] });
      }
    } catch (localError) {
      res.json({ success: true, files: [] });
    }
  }
});

app.get('/api/original/listLogoFiles', async (req, res) => {
  try {
    const response = await axios.get(`${MAIN_BACKEND_URL}/api/original/listLogoFiles`, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('Logo files list proxy error, falling back to local logo files:', error.message);
    // Fallback to local logo files
    try {
      const logoDir = path.join(process.cwd(), 'files', 'logo');
      if (fs.existsSync(logoDir)) {
        const files = fs.readdirSync(logoDir).filter(f => {
          const fullPath = path.join(logoDir, f);
          return fs.statSync(fullPath).isFile();
        });
        res.json({ success: true, files });
      } else {
        res.json({ success: true, files: [] });
      }
    } catch (localError) {
      res.json({ success: true, files: [] });
    }
  }
});

// Add missing readFile endpoint for template loading
app.post('/api/original/readFile', async (req, res) => {
  try {
    const response = await axios.post(`${MAIN_BACKEND_URL}/api/original/readFile`, req.body, {
      headers: {
        'Authorization': `Bearer ${MAIN_BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('File read proxy error, falling back to local file:', error.message);
    // Fallback to local file reading
    try {
      const { filepath } = req.body;
      if (!filepath) {
        return res.json({ success: false, error: 'Filepath is required' });
      }

      const fullPath = path.join(process.cwd(), filepath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        res.json({ success: true, content });
      } else {
        res.json({ success: false, error: 'File not found' });
      }
    } catch (localError) {
      res.json({ success: false, error: `Local file read error: ${localError}` });
    }
  }
});

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