const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { TunnelClient } = require('./tunnel-client');

// Load environment variables
require('dotenv').config();

// Global tunnel client instance for port 25 SMTP routing
let tunnelClient = null;
let tunnelStatus = { connected: false, reason: 'not_started' };

// Track registered handlers to prevent duplicates
const registeredHandlers = new Set();

// Helper function to safely register IPC handlers
function safeHandle(channel, listener) {
  // Only register if not already registered
  if (!registeredHandlers.has(channel)) {
    ipcMain.handle(channel, listener);
    registeredHandlers.add(channel);
    console.log(`[Electron] Registered handler: ${channel}`);
  } else {
    console.log(`[Electron] Handler already registered, skipping: ${channel}`);
  }
}

// Cleanup function to remove all handlers on app quit
app.on('before-quit', () => {
  console.log('[Electron] Cleaning up IPC handlers...');
  registeredHandlers.forEach(channel => {
    try {
      ipcMain.removeHandler(channel);
    } catch (error) {
      // Ignore errors during cleanup
    }
  });
  registeredHandlers.clear();
});

// Keep a global reference of the window object
let mainWindow;
// Broadcast check variables (one-time check at startup, no polling)
let lastBroadcastCheck = 0; // Initialize to 0 to show all pending broadcasts on startup
let userId = null; // Will be set to hardware fingerprint for persistent user identification

// Get raw IP address (not hashed) for sending to server
function getClientIpAddress() {
  try {
    const networkInterfaces = os.networkInterfaces();

    // Find the first non-internal IPv4 address
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (!iface.internal && iface.family === 'IPv4') {
          console.log('[Electron] Client IP address:', iface.address);
          return iface.address;
        }
      }
    }

    // Fallback if no external IP found
    console.warn('[Electron] No external IP found');
    return null;
  } catch (error) {
    console.error('[Electron] Error getting client IP:', error);
    return null;
  }
}

// Generate hardware fingerprint based on IP address
function generateHardwareFingerprint() {
  try {
    const networkInterfaces = os.networkInterfaces();

    // Find the first non-internal IPv4 address
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (!iface.internal && iface.family === 'IPv4') {
          console.log('[Electron] Using IP address for hardware fingerprint:', iface.address);
          return crypto.createHash('sha256').update(iface.address).digest('hex');
        }
      }
    }

    // Fallback if no external IP found (shouldn't happen in normal cases)
    console.warn('[Electron] No external IP found, using hostname fallback');
    const fallbackId = os.hostname();
    return crypto.createHash('sha256').update(fallbackId).digest('hex');
  } catch (error) {
    console.error('[Electron] Error generating hardware fingerprint:', error);
    // Emergency fallback
    const emergencyId = os.hostname();
    return crypto.createHash('sha256').update(emergencyId).digest('hex');
  }
}

// License verification function
async function verifyLicense() {
  try {
    const licenseKey = process.env.LICENSE_KEY;

    if (!licenseKey) {
      return {
        valid: false,
        error: 'No license key found in .env file'
      };
    }

    // Get server URL from environment
    const serverUrl = process.env.REPLIT_SERVER_URL;
    if (!serverUrl) {
      return {
        valid: false,
        error: 'REPLIT_SERVER_URL not configured in .env file'
      };
    }

    // Generate hardware fingerprint
    const hardwareId = generateHardwareFingerprint();
    console.log('[Electron] Hardware ID:', hardwareId.substring(0, 16) + '...');
    console.log('[Electron] Verifying license with server...');

    // Verify license with server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${serverUrl}/api/license/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey,
          hardwareId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          valid: false,
          error: `Server returned status ${response.status}`
        };
      }

      const result = await response.json();

      if (result.valid) {
        console.log('[Electron] ✅ License verified successfully');
        return {
          valid: true,
          licenseKey,
          license: result.license
        };
      } else {
        return {
          valid: false,
          error: result.reason || 'License verification failed'
        };
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return {
          valid: false,
          error: 'License verification timed out (10s)'
        };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[Electron] License verification error:', error);
    return {
      valid: false,
      error: `License verification failed: ${error.message}`
    };
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Optional: add app icon
    title: 'Email Sender - Desktop App'
  });

  // Load the React app
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files with hash routing
    const indexPath = path.join(__dirname, 'dist/index.html');
    mainWindow.loadURL(`file://${indexPath}#/`);
  }

  // Pass server URL to renderer process
  mainWindow.webContents.on('did-finish-load', () => {
    const serverUrl = process.env.REPLIT_SERVER_URL;
    if (serverUrl) {
      mainWindow.webContents.executeJavaScript(`
        window.REPLIT_SERVER_URL = '${serverUrl}';
        console.log('[Electron] Server URL set to:', '${serverUrl}');
      `);

      // Check for broadcast messages once at startup (no continuous polling)
      checkBroadcastsOnce(serverUrl);
    } else {
      console.log('[Electron] No REPLIT_SERVER_URL environment variable set');
    }

  });

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log('[Electron] Starting Email Sender Desktop App...');

  const licenseResult = await verifyLicense();

  if (!licenseResult.valid) {
    console.error('[Electron] ❌ License verification failed:', licenseResult.error);

    const { dialog } = require('electron');

    // Check for specific error message about already activated
    let errorTitle = 'License Verification Failed';
    let errorMessage = 'Invalid or Missing License';
    let errorDetail = licenseResult.error;

    if (licenseResult.error && licenseResult.error.includes('already activated on another computer')) {
      errorTitle = 'License Already Activated';
      errorMessage = 'This license is already in use on another computer';
      errorDetail = 'Each license can only be activated on one computer at a time.\n\nIf you need to transfer this license, please contact support.';
    }

    await dialog.showMessageBox({
      type: 'error',
      title: errorTitle,
      message: errorMessage,
      detail: errorDetail,
      buttons: ['Exit']
    });

    app.quit();
    return;
  }

  console.log('[Electron] ✅ License verified - Starting application...');
  
  // Set persistent userId based on hardware fingerprint
  userId = generateHardwareFingerprint();
  console.log('[Electron] User ID for broadcasts:', userId.substring(0, 16) + '...');
  
  // Start tunnel client for port 25 SMTP routing
  startTunnelClient();
  
  createWindow();
});

// Start the tunnel client for port 25 SMTP routing
function startTunnelClient() {
  const licenseKey = process.env.LICENSE_KEY;
  const serverUrl = process.env.REPLIT_SERVER_URL;
  
  if (!licenseKey || !serverUrl) {
    console.log('[Tunnel] Missing license key or server URL - tunnel disabled');
    tunnelStatus = { connected: false, reason: 'missing_config' };
    return;
  }
  
  console.log('[Tunnel] Starting integrated tunnel client for port 25 SMTP...');
  
  tunnelClient = new TunnelClient({
    licenseKey: licenseKey,
    serverUrl: serverUrl
  });
  
  tunnelClient.on('status', (status) => {
    tunnelStatus = status;
    console.log('[Tunnel] Status changed:', status);
    
    // Notify renderer if window is available
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('tunnel-status', status);
    }
  });
  
  tunnelClient.on('error', (error) => {
    console.error('[Tunnel] Error:', error.message);
  });
  
  tunnelClient.connect();
}

// Quit when all windows are closed
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Cleanup tunnel client on app quit
app.on('before-quit', () => {
  if (tunnelClient) {
    console.log('[Tunnel] Cleaning up tunnel client...');
    tunnelClient.disconnect();
  }
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// IPC handler to get client IP address (for sending to server)
safeHandle('get-client-ip', async () => {
  const ip = getClientIpAddress();
  console.log('[Electron] Returning client IP to renderer:', ip);
  return ip;
});

// IPC handler to get tunnel identifier (hashed license key for routing, not raw key)
safeHandle('get-tunnel-id', async () => {
  const licenseKey = process.env.LICENSE_KEY;
  if (!licenseKey) return null;
  // Return first 16 chars of hash - enough to identify but not expose full key
  const tunnelId = crypto.createHash('sha256').update(licenseKey).digest('hex').substring(0, 16);
  console.log('[Electron] Tunnel ID requested:', tunnelId);
  return tunnelId;
});

// IPC handler to get tunnel connection status
safeHandle('get-tunnel-status', async () => {
  if (tunnelClient) {
    return tunnelClient.getStatus();
  }
  return tunnelStatus;
});

// IPC handler to reconnect tunnel manually
safeHandle('tunnel-reconnect', async () => {
  if (tunnelClient) {
    tunnelClient.reconnect();
    return { success: true, message: 'Reconnecting...' };
  }
  return { success: false, error: 'Tunnel client not initialized' };
});

// IPC handlers for file operations
safeHandle('read-file', async (event, filepath) => {
  try {
    console.log(`[Electron] Reading file: ${filepath}`);

    // Remove 'files/' prefix if it exists since we're already in user-package
    const cleanPath = filepath.replace(/^files\//, '');

    // Try both with and without files/ prefix
    const possiblePaths = [
      path.resolve(__dirname, 'files', cleanPath),
      path.resolve(__dirname, filepath),
      path.resolve(__dirname, cleanPath)
    ];

    for (const testPath of possiblePaths) {
      console.log(`[Electron] Trying path: ${testPath}`);
      if (existsSync(testPath)) {
        const content = await fs.readFile(testPath, 'utf-8');
        console.log(`[Electron] Successfully read file from: ${testPath} (${content.length} chars)`);
        return content;
      }
    }

    throw new Error(`File not found in any location: ${filepath}`);
  } catch (error) {
    console.error(`[Electron] Failed to read file ${filepath}:`, error);
    throw error;
  }
});

safeHandle('write-file', async (event, filepath, content) => {
  try {
    console.log(`[Electron] Writing file: ${filepath}`);

    // Resolve relative paths from the app directory
    const resolvedPath = path.resolve(process.cwd(), filepath);

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(resolvedPath, content, 'utf-8');
    console.log(`[Electron] Successfully wrote file: ${filepath}`);
    return true;
  } catch (error) {
    console.error(`[Electron] Failed to write file ${filepath}:`, error);
    return false;
  }
});

safeHandle('list-files', async (event, dirpath) => {
  try {
    console.log(`[Electron] Listing files in: ${dirpath}`);

    // Clean the directory path
    const cleanDir = dirpath || 'files';

    // Try multiple possible locations
    const possibleDirs = [
      path.resolve(__dirname, cleanDir),
      path.resolve(__dirname, 'files'),
      path.resolve(__dirname, dirpath)
    ];

    for (const testDir of possibleDirs) {
      console.log(`[Electron] Trying directory: ${testDir}`);
      if (existsSync(testDir)) {
        const files = await fs.readdir(testDir);

        // Filter files based on directory type
        let filteredFiles;
        if (dirpath.includes('logo')) {
          filteredFiles = files.filter(file => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file));
        } else {
          filteredFiles = files.filter(file => /\.(html|htm)$/i.test(file));
        }

        console.log(`[Electron] Found ${filteredFiles.length} files in ${testDir}:`, filteredFiles);
        return filteredFiles;
      }
    }

    console.log(`[Electron] Directory not found: ${dirpath}`);
    return [];
  } catch (error) {
    console.error(`[Electron] Failed to list files in ${dirpath}:`, error);
    return [];
  }
});

safeHandle('read-config', async (event, configDir) => {
  try {
    console.log(`[Electron] Reading config from: ${configDir}`);

    // Try multiple base directories
    const basePaths = [
      __dirname, // user-package directory
      process.cwd(), // current working directory
      path.resolve(__dirname, '..'), // parent directory
    ];

    const config = {};

    for (const basePath of basePaths) {
      const setupPath = path.resolve(basePath, configDir, 'setup.ini');
      const smtpPath = path.resolve(basePath, configDir, 'smtp.ini');

      console.log(`[Electron] Checking config paths in: ${basePath}`);

      // Read setup.ini if it exists
      if (existsSync(setupPath)) {
        const setupContent = await fs.readFile(setupPath, 'utf-8');
        console.log(`[Electron] Found setup.ini at ${setupPath}`);
        config.setup = setupContent;
      }

      // Read smtp.ini if it exists
      if (existsSync(smtpPath)) {
        const smtpContent = await fs.readFile(smtpPath, 'utf-8');
        console.log(`[Electron] Found smtp.ini at ${smtpPath}`);
        config.smtp = smtpContent;
      }

      // If we found any config files, break out of the loop
      if (config.setup || config.smtp) {
        console.log(`[Electron] Found config files in: ${basePath}`);
        break;
      }
    }

    return config;
  } catch (error) {
    console.error(`[Electron] Failed to read config from ${configDir}:`, error);
    return {};
  }
});

safeHandle('select-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'HTML Files', extensions: ['html', 'htm'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('[Electron] Failed to select file:', error);
    return null;
  }
});

safeHandle('select-files', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths;
    }
    return null;
  } catch (error) {
    console.error('[Electron] Failed to select files:', error);
    return null;
  }
});

// Config loading with fallback support
safeHandle('load-config', async () => {
  try {
    console.log(`[Electron] Loading config files`);

    // Try multiple base directories
    const basePaths = [
      __dirname, // user-package directory
      process.cwd(), // current working directory
      path.resolve(__dirname, '..'), // parent directory
    ];

    const config = {};
    let setupContent = '';
    let smtpContent = '';

    for (const basePath of basePaths) {
      const setupPath = path.resolve(basePath, 'config', 'setup.ini');
      const smtpPath = path.resolve(basePath, 'config', 'smtp.ini');

      console.log(`[Electron] Checking config paths in: ${basePath}`);

      // Read setup.ini if it exists
      if (existsSync(setupPath)) {
        setupContent = await fs.readFile(setupPath, 'utf-8');
        console.log(`[Electron] Found setup.ini at ${setupPath}`);
        const setupConfig = parseIniFile(setupContent);
        Object.assign(config, setupConfig.CONFIG || {});
        Object.assign(config, setupConfig.PROXY || {});
      }

      // Read smtp.ini if it exists
      if (existsSync(smtpPath)) {
        const smtpContent = await fs.readFile(smtpPath, 'utf-8');
        console.log(`[Electron] Found smtp.ini at ${smtpPath}`);
        const smtpConfig = parseIniFile(smtpContent);

        // Get first SMTP config as current
        const smtpKeys = Object.keys(smtpConfig).filter(key => key.startsWith('smtp'));
        if (smtpKeys.length > 0) {
          const firstSmtp = smtpConfig[smtpKeys[0]];
          config.SMTP = firstSmtp;
          console.log(`[Electron] Loaded SMTP config:`, firstSmtp);
        }
      }

      // If we found config files, break out of the loop
      if (setupContent || smtpContent) {
        console.log(`[Electron] Found config files in: ${basePath}`);
        break;
      }
    }

    return { success: true, config };
  } catch (error) {
    console.error(`[Electron] Failed to load config:`, error);
    return { success: false, config: {} };
  }
});

// Load leads file
safeHandle('load-leads', async () => {
  try {
    console.log(`[Electron] Loading leads file`);

    // Try multiple locations for leads.txt
    const possiblePaths = [
      path.resolve(__dirname, 'files', 'leads.txt'), // user-package directory
      path.resolve(process.cwd(), 'files', 'leads.txt'), // current working directory
      path.resolve(__dirname, '..', 'files', 'leads.txt'), // parent directory
    ];

    for (const testPath of possiblePaths) {
      console.log(`[Electron] Trying leads path: ${testPath}`);
      if (existsSync(testPath)) {
        const content = await fs.readFile(testPath, 'utf-8');
        console.log(`[Electron] Successfully loaded leads from ${testPath} (${content.length} chars)`);
        return { success: true, leads: content };
      }
    }

    console.log(`[Electron] Leads file not found in any location`);
    return { success: false, leads: '' };
  } catch (error) {
    console.error(`[Electron] Failed to load leads:`, error);
    return { success: false, leads: '' };
  }
});

// SMTP rotation state storage
let smtpRotationEnabled = false;
let currentSmtpIndex = 0;

// SMTP toggle rotation handler
safeHandle('smtp:toggle-rotation', async (event, enabled) => {
  try {
    console.log(`[Electron] Toggling SMTP rotation to: ${enabled}`);
    smtpRotationEnabled = enabled;

    const basePaths = [
      __dirname,
      process.cwd(),
      path.resolve(__dirname, '..')
    ];

    let smtpPath = null;
    let statePath = null;

    // Find config files
    for (const basePath of basePaths) {
      const testSmtpPath = path.resolve(basePath, 'config', 'smtp.ini');
      const testStatePath = path.resolve(basePath, 'config', 'smtp-rotation.json');

      if (existsSync(testSmtpPath)) {
        smtpPath = testSmtpPath;
        statePath = testStatePath;
        break;
      }
    }

    // Load current SMTP configs to return current SMTP
    let currentSmtp = null;
    if (smtpPath && existsSync(smtpPath)) {
      const smtpContent = await fs.readFile(smtpPath, 'utf-8');
      const smtpConfigs = parseSmtpIni(smtpContent);

      if (smtpConfigs.length > 0) {
        // Use current index to get current SMTP
        const validIndex = currentSmtpIndex < smtpConfigs.length ? currentSmtpIndex : 0;
        currentSmtp = smtpConfigs[validIndex];
      }
    }

    await fs.mkdir(path.dirname(statePath), { recursive: true });

    // Atomic write: write to temp file then rename (prevents corruption)
    const tempPath = statePath + '.tmp';
    const stateData = JSON.stringify({
      rotationEnabled: enabled,
      currentIndex: currentSmtpIndex
    }, null, 2);

    await fs.writeFile(tempPath, stateData, 'utf-8');
    await fs.rename(tempPath, statePath);

    console.log(`[Electron] SMTP rotation state saved atomically: ${enabled}, index: ${currentSmtpIndex}`);
    return {
      success: true,
      rotationEnabled: enabled,
      currentSmtp: currentSmtp
    };
  } catch (error) {
    console.error(`[Electron] Failed to save rotation state:`, error);
    return { success: false, rotationEnabled: smtpRotationEnabled };
  }
});

// SMTP rotate handler
safeHandle('smtp:rotate', async () => {
  try {
    console.log(`[Electron] Rotating SMTP server`);

    const basePaths = [
      __dirname,
      process.cwd(),
      path.resolve(__dirname, '..')
    ];

    let smtpPath = null;
    let statePath = null;

    // Find SMTP config file
    for (const basePath of basePaths) {
      const testSmtpPath = path.resolve(basePath, 'config', 'smtp.ini');
      const testStatePath = path.resolve(basePath, 'config', 'smtp-rotation.json');

      if (existsSync(testSmtpPath)) {
        smtpPath = testSmtpPath;
        statePath = testStatePath;
        break;
      }
    }

    if (!smtpPath) {
      return { success: false, error: 'SMTP config file not found' };
    }

    // Load SMTP configs
    const smtpContent = await fs.readFile(smtpPath, 'utf-8');
    const smtpConfigs = parseSmtpIni(smtpContent);

    if (smtpConfigs.length <= 1) {
      return { success: false, error: 'Need at least 2 SMTP configs to rotate' };
    }

    // Load current index from state file
    let savedIndex = 0;
    if (existsSync(statePath)) {
      try {
        const stateContent = await fs.readFile(statePath, 'utf-8');
        const state = JSON.parse(stateContent);
        savedIndex = state.currentIndex || 0;
        smtpRotationEnabled = state.rotationEnabled || false;
      } catch (error) {
        console.error(`[Electron] Failed to parse rotation state:`, error);
      }
    }

    // Calculate next index
    currentSmtpIndex = (savedIndex + 1) % smtpConfigs.length;
    const nextSmtp = smtpConfigs[currentSmtpIndex];

    // Save updated state
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify({
      rotationEnabled: smtpRotationEnabled,
      currentIndex: currentSmtpIndex
    }), 'utf-8');

    console.log(`[Electron] Rotated to SMTP index ${currentSmtpIndex}: ${nextSmtp.fromEmail}`);

    return {
      success: true,
      currentSmtp: nextSmtp,
      rotationEnabled: smtpRotationEnabled
    };
  } catch (error) {
    console.error(`[Electron] Failed to rotate SMTP:`, error);
    return { success: false, error: error.message };
  }
});

// SMTP list handler
// SMTP list handler - note the handler name matches preload.js
safeHandle('smtp:list', async () => {
  try {
    console.log(`[Electron] Loading SMTP configurations`);

    const basePaths = [
      __dirname, // user-package directory
      process.cwd(), // current working directory
      path.resolve(__dirname, '..'), // parent directory
    ];

    let rotationEnabled = false;
    let savedIndex = 0;

    for (const basePath of basePaths) {
      const smtpPath = path.resolve(basePath, 'config', 'smtp.ini');
      const statePath = path.resolve(basePath, 'config', 'smtp-rotation.json');

      console.log(`[Electron] Checking SMTP path: ${smtpPath}`);

      if (existsSync(statePath)) {
        try {
          const stateContent = await fs.readFile(statePath, 'utf-8');
          const state = JSON.parse(stateContent);
          rotationEnabled = state.rotationEnabled || false;
          savedIndex = state.currentIndex || 0;
          smtpRotationEnabled = rotationEnabled;
          currentSmtpIndex = savedIndex;
          console.log(`[Electron] Loaded rotation state: enabled=${rotationEnabled}, index=${savedIndex}`);
        } catch (error) {
          console.error(`[Electron] Failed to parse rotation state:`, error);
        }
      }

      if (existsSync(smtpPath)) {
        console.log(`[Electron] Found SMTP config at: ${smtpPath}`);
        const smtpContent = await fs.readFile(smtpPath, 'utf-8');
        const smtpConfigs = parseSmtpIni(smtpContent);

        // Use saved index to determine current SMTP, fallback to first if index is out of range
        const validIndex = savedIndex < smtpConfigs.length ? savedIndex : 0;
        const currentSmtp = smtpConfigs[validIndex] || null;

        return {
          success: true,
          smtpConfigs,
          currentSmtp: currentSmtp,
          rotationEnabled: rotationEnabled
        };
      }
    }

    console.log(`[Electron] No SMTP config found`);
    return { success: true, smtpConfigs: [], currentSmtp: null, rotationEnabled: rotationEnabled };
  } catch (error) {
    console.error(`[Electron] Failed to load SMTP configs:`, error);
    return { success: false, smtpConfigs: [], currentSmtp: null, rotationEnabled: false };
  }
});

// Parse INI file format
function parseIniFile(content) {
  const result = {};
  let currentSection = '';

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
      continue;
    }

    // Section header
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1);
      result[currentSection] = {};
      continue;
    }

    // Key-value pair
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();

      if (currentSection) {
        result[currentSection][key] = parseValue(value);
      } else {
        result[key] = parseValue(value);
      }
    }
  }

  return result;
}

// SMTP add handler
safeHandle('smtp:add', async (event, smtpData) => {
  try {
    console.log(`[Electron] Adding new SMTP config:`, smtpData);

    // Only require host, port, and fromEmail - user/pass are optional for no-auth SMTP (e.g., port 25)
    if (!smtpData.host || !smtpData.port || !smtpData.fromEmail) {
      return { success: false, error: 'SMTP host, port, and fromEmail are required' };
    }

    const basePaths = [
      __dirname,
      process.cwd(),
      path.resolve(__dirname, '..')
    ];

    let smtpPath = null;
    let existingContent = '';

    // Find existing smtp.ini or create in first basePath
    for (const basePath of basePaths) {
      const testPath = path.resolve(basePath, 'config', 'smtp.ini');
      if (existsSync(testPath)) {
        smtpPath = testPath;
        existingContent = await fs.readFile(smtpPath, 'utf-8');
        break;
      }
    }

    // If no existing file, create in first basePath
    if (!smtpPath) {
      smtpPath = path.resolve(basePaths[0], 'config', 'smtp.ini');
      await fs.mkdir(path.dirname(smtpPath), { recursive: true });
    }

    // Parse existing configs to find next available index
    const existingConfigs = existingContent ? parseSmtpIni(existingContent) : [];
    const existingIds = existingConfigs.map(s => s.id);
    let nextIndex = 0;
    while (existingIds.includes(`smtp${nextIndex}`)) {
      nextIndex++;
    }

    const smtpId = `smtp${nextIndex}`;
    const newSection = `\n[${smtpId}]\nhost=${smtpData.host}\nport=${smtpData.port}\nuser=${smtpData.user || ''}\npass=${smtpData.pass || ''}\nfromEmail=${smtpData.fromEmail}\nfromName=${smtpData.fromName || ''}\n`;

    await fs.writeFile(smtpPath, existingContent + newSection, 'utf-8');
    console.log(`[Electron] SMTP config ${smtpId} added successfully`);

    // Reload and return updated list
    const updatedContent = await fs.readFile(smtpPath, 'utf-8');
    const smtpConfigs = parseSmtpIni(updatedContent);

    return {
      success: true,
      smtpId: smtpId,
      smtpConfigs: smtpConfigs,
      currentSmtp: smtpConfigs[0] || null
    };
  } catch (error) {
    console.error(`[Electron] Failed to add SMTP config:`, error);
    return { success: false, error: error.message };
  }
});

// SMTP delete handler
safeHandle('smtp:delete', async (event, smtpId) => {
  try {
    console.log(`[Electron] Deleting SMTP config: ${smtpId}`);

    const basePaths = [
      __dirname,
      process.cwd(),
      path.resolve(__dirname, '..')
    ];

    let smtpPath = null;
    let existingContent = '';

    // Find existing smtp.ini
    for (const basePath of basePaths) {
      const testPath = path.resolve(basePath, 'config', 'smtp.ini');
      if (existsSync(testPath)) {
        smtpPath = testPath;
        existingContent = await fs.readFile(smtpPath, 'utf-8');
        break;
      }
    }

    if (!smtpPath) {
      return { success: false, error: 'SMTP config file not found' };
    }

    // Parse and remove the specified section
    const lines = existingContent.split('\n');
    const newLines = [];
    let inTargetSection = false;
    let sectionFound = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if this is the section we want to delete
      if (trimmed === `[${smtpId}]`) {
        inTargetSection = true;
        sectionFound = true;
        continue;
      }

      // Check if we're entering a new section
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inTargetSection = false;
      }

      // Only add lines that are not in the target section
      if (!inTargetSection) {
        newLines.push(line);
      }
    }

    if (!sectionFound) {
      return { success: false, error: 'SMTP config not found' };
    }

    // Write updated content
    await fs.writeFile(smtpPath, newLines.join('\n'), 'utf-8');
    console.log(`[Electron] SMTP config ${smtpId} deleted successfully`);

    // Reload and return updated list
    const updatedContent = await fs.readFile(smtpPath, 'utf-8');
    const smtpConfigs = parseSmtpIni(updatedContent);

    return {
      success: true,
      smtpConfigs: smtpConfigs,
      currentSmtp: smtpConfigs[0] || null
    };
  } catch (error) {
    console.error(`[Electron] Failed to delete SMTP config:`, error);
    return { success: false, error: error.message };
  }
});

// File upload handler
safeHandle('file-upload', async (event, sourceFilePath) => {
  try {
    console.log(`[Electron] Uploading file: ${sourceFilePath}`);

    if (!existsSync(sourceFilePath)) {
      return { success: false, error: 'Source file not found' };
    }

    const crypto = require('crypto');
    const originalName = path.basename(sourceFilePath);
    const ext = path.extname(originalName);
    const filename = `${crypto.randomUUID()}${ext}`;
    const uploadsDir = path.resolve(__dirname, 'uploads');
    const destPath = path.resolve(uploadsDir, filename);

    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.copyFile(sourceFilePath, destPath);

    const stats = await fs.stat(destPath);

    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.html': 'text/html',
      '.txt': 'text/plain'
    };

    console.log(`[Electron] File uploaded successfully: ${filename} (original: ${originalName})`);

    return {
      success: true,
      id: crypto.randomUUID(),
      originalName: originalName, // Keep original filename for display
      filename: filename, // Generated filename for storage
      path: `uploads/${filename}`,
      size: stats.size,
      mimeType: mimeTypes[ext.toLowerCase()] || 'application/octet-stream',
      uploadedAt: new Date()
    };
  } catch (error) {
    console.error(`[Electron] Failed to upload file:`, error);
    return { success: false, error: error.message };
  }
});

// Helper function to load SMTP configuration
function loadSmtpConfig() {
  // This function needs to be implemented to load the current SMTP configuration
  // based on the rotation state and available smtp.ini file.
  // For now, we'll mock it by calling ipcMain.invoke('smtp-list')
  // In a real application, this might be more complex.
  let smtpConfigs = [];
  let currentSmtp = null;
  let rotationEnabled = false;

  try {
    // Attempt to get SMTP list - this might require a synchronous call if used during sync operations
    // or a more robust way to ensure data is available. For simplicity, we'll assume it works.
    // A better approach would be to expose this data via a global variable or re-invoke when needed.
    // For now, we'll use a placeholder and assume the renderer has already fetched this.
    // In the context of `email:send`, the renderer should have already fetched this data.
    // We'll need to pass the smtp configurations directly to the `email:send` handler.
    // For this example, let's assume `loadSmtpConfig` would internally call `ipcMain.invoke('smtp-list')`
    // and process the result. However, `ipcMain.invoke` is asynchronous.
    // A more practical approach for desktop apps is to load configs once and keep them in memory.

    // *** TEMPORARY SOLUTION: Assuming smtp-list has been called and data is accessible ***
    // In a real app, manage this state more carefully.
    // For the purpose of this fix, let's simulate loading it.
    // The actual loading will happen within the `email:send` handler by passing it from the renderer.

    // Mocking a return value for demonstration if this function were called directly.
    // The `email:send` handler will receive the data from formDataObj.
    console.warn("loadSmtpConfig() called directly - this is a placeholder. SMTP configs should be passed from the renderer.");
    return { smtpConfigs: [], currentSmtp: null, rotationEnabled: false };

  } catch (error) {
    console.error("Error in loadSmtpConfig mock:", error);
    return { smtpConfigs: [], currentSmtp: null, rotationEnabled: false };
  }
}

// Helper function to load SMTP data for tests
async function loadSmtpData() {
  try {
    const basePaths = [
      __dirname,
      process.cwd(),
      path.resolve(__dirname, '..')
    ];

    let rotationEnabled = false;
    let savedIndex = 0;

    for (const basePath of basePaths) {
      const smtpPath = path.resolve(basePath, 'config', 'smtp.ini');
      const statePath = path.resolve(basePath, 'config', 'smtp-rotation.json');

      if (existsSync(statePath)) {
        try {
          const stateContent = await fs.readFile(statePath, 'utf-8');
          const state = JSON.parse(stateContent);
          rotationEnabled = state.rotationEnabled || false;
          savedIndex = state.currentIndex || 0;
        } catch (error) {
          console.error('[Electron] Failed to parse rotation state:', error);
        }
      }

      if (existsSync(smtpPath)) {
        const smtpContent = await fs.readFile(smtpPath, 'utf-8');
        const smtpConfigs = parseSmtpIni(smtpContent);
        const validIndex = savedIndex < smtpConfigs.length ? savedIndex : 0;
        const currentSmtp = smtpConfigs[validIndex] || null;

        return {
          success: true,
          smtpConfigs,
          currentSmtp: currentSmtp,
          rotationEnabled: rotationEnabled
        };
      }
    }

    return { success: false, currentSmtp: null };
  } catch (error) {
    console.error('[Electron] Error loading SMTP data:', error);
    return { success: false, currentSmtp: null };
  }
}

// SMTP test handler - test specific SMTP config by ID using nodemailer
safeHandle('smtp:test', async (event, smtpId) => {
  try {
    console.log(`[Electron] Testing SMTP connection locally for: ${smtpId || 'current'}`);

    // Load all SMTP configs from local files
    const smtpData = await loadSmtpData();

    if (!smtpData.success || !smtpData.smtpConfigs || smtpData.smtpConfigs.length === 0) {
      console.error('[Electron] ❌ SMTP test failed: No SMTP configuration available');
      return { success: false, online: false, error: 'No SMTP configuration available' };
    }

    // Find the specific SMTP config by ID, or use current if no ID provided
    let targetSmtp;
    if (smtpId) {
      targetSmtp = smtpData.smtpConfigs.find(s => s.id === smtpId);
      if (!targetSmtp) {
        console.error(`[Electron] ❌ SMTP test failed: SMTP config ${smtpId} not found`);
        return { success: false, online: false, error: `SMTP config ${smtpId} not found` };
      }
    } else {
      targetSmtp = smtpData.currentSmtp;
    }

    if (!targetSmtp) {
      console.error('[Electron] ❌ SMTP test failed: No SMTP configuration available');
      return { success: false, online: false, error: 'No SMTP configuration available' };
    }

    console.log(`[Electron] Testing SMTP: ${targetSmtp.fromEmail} (${targetSmtp.host}:${targetSmtp.port})`);

    // Create nodemailer transporter
    const port = Number(targetSmtp.port);
    const transporterConfig = {
      host: targetSmtp.host,
      port: port,
      secure: port === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      tls: {
        rejectUnauthorized: false
      }
    };

    // For port 25, disable TLS entirely and add timeout settings to avoid connection hanging
    if (port === 25) {
      transporterConfig.ignoreTLS = true;
      transporterConfig.requireTLS = false;
      transporterConfig.secure = false;
      transporterConfig.connectionTimeout = 30000;
      transporterConfig.greetingTimeout = 30000;
      transporterConfig.socketTimeout = 60000;
      console.log('[Electron] Port 25 detected - TLS disabled, extended timeouts configured');
    }

    // Add auth if username and password are provided
    if (targetSmtp.user && targetSmtp.pass) {
      transporterConfig.auth = {
        user: targetSmtp.user,
        pass: targetSmtp.pass
      };
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    try {
      // Verify the connection
      await transporter.verify();
      console.log(`[Electron] ✅ SMTP test successful for ${targetSmtp.id}`);
      console.log('[Electron] SMTP ONLINE:', targetSmtp.fromEmail);

      transporter.close();
      return {
        success: true,
        online: true,
        smtpId: targetSmtp.id,
        smtp: {
          id: targetSmtp.id,
          host: targetSmtp.host,
          port: targetSmtp.port,
          fromEmail: targetSmtp.fromEmail
        }
      };
    } catch (verifyError) {
      console.error(`[Electron] ❌ SMTP verification failed for ${targetSmtp.id}:`, verifyError.message);
      transporter.close();
      return {
        success: false,
        online: false,
        smtpId: targetSmtp.id,
        error: verifyError.message || 'SMTP connection failed',
        smtp: {
          id: targetSmtp.id,
          host: targetSmtp.host,
          port: targetSmtp.port,
          fromEmail: targetSmtp.fromEmail
        }
      };
    }
  } catch (error) {
    console.error('[Electron] ❌ SMTP test failed:', error.message);
    return { success: false, online: false, error: error.message };
  }
});

// NOTE: Email sending has been moved to the backend server.
// Desktop app uses replitApiService.sendEmailsJob() to send emails via backend HTTP API.
// This ensures both web and desktop UIs use the same email processing pipeline.

// Parse SMTP INI file format and convert to array
function parseSmtpIni(content) {
  const parsed = parseIniFile(content);
  const smtpConfigs = [];

  // Convert INI sections to array format
  for (const key in parsed) {
    if (key.startsWith('smtp')) {
      const smtpConfig = {
        id: key,
        host: parsed[key].host || '',
        port: parsed[key].port || '587',
        user: parsed[key].user || '',
        pass: parsed[key].pass || '',
        fromEmail: parsed[key].fromEmail || '',
        fromName: parsed[key].fromName || ''
      };
      smtpConfigs.push(smtpConfig);
      console.log(`[Electron] Parsed SMTP config ${key}:`, smtpConfig);
    }
  }

  console.log(`[Electron] Total SMTP configs parsed: ${smtpConfigs.length}`);
  return smtpConfigs;
}


// Parse config values
function parseValue(value) {
  if (value === '') return '';
  if (value === '0') return 0;
  if (value === '1') return 1;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

// Save config handler - saves to config.ini file
safeHandle('save-config', async (event, config) => {
  try {
    console.log(`[Electron] Saving config to file:`, config);

    const basePaths = [
      __dirname,
      process.cwd(),
      path.resolve(__dirname, '..')
    ];

    let configPath = null;

    // Find existing config.ini or create in first basePath
    for (const basePath of basePaths) {
      const testPath = path.resolve(basePath, 'config', 'config.ini');
      if (existsSync(testPath)) {
        configPath = testPath;
        break;
      }
    }

    // If no existing file, create in first basePath
    if (!configPath) {
      configPath = path.resolve(basePaths[0], 'config', 'config.ini');
      await fs.mkdir(path.dirname(configPath), { recursive: true });
    }

    // Convert config object to INI format
    let iniContent = '';

    // Add [SETTINGS] section
    iniContent += '[SETTINGS]\n';
    if (config.EMAILPERSECOND !== undefined) iniContent += `EMAILPERSECOND=${config.EMAILPERSECOND}\n`;
    if (config.SLEEP !== undefined) iniContent += `SLEEP=${config.SLEEP}\n`;
    if (config.QRCODE !== undefined) iniContent += `QRCODE=${config.QRCODE ? '1' : '0'}\n`;
    if (config.RANDOM_METADATA !== undefined) iniContent += `RANDOM_METADATA=${config.RANDOM_METADATA ? '1' : '0'}\n`;
    if (config.HTML2IMG_BODY !== undefined) iniContent += `HTML2IMG_BODY=${config.HTML2IMG_BODY ? '1' : '0'}\n`;
    if (config.ZIP_USE !== undefined) iniContent += `ZIP_USE=${config.ZIP_USE ? '1' : '0'}\n`;
    if (config.PROXY_USE !== undefined) iniContent += `PROXY_USE=${config.PROXY_USE ? '1' : '0'}\n`;

    await fs.writeFile(configPath, iniContent, 'utf-8');
    console.log(`[Electron] Config saved successfully to ${configPath}`);

    return { success: true };
  } catch (error) {
    console.error(`[Electron] Failed to save config:`, error);
    return { success: false, error: error.message };
  }
});

// Save leads handler - saves to files/leads.txt
safeHandle('save-leads', async (event, leads) => {
  try {
    console.log(`[Electron] Saving ${leads.length} leads to file`);

    const basePaths = [
      __dirname,
      process.cwd(),
      path.resolve(__dirname, '..')
    ];

    let leadsPath = null;

    // Find existing leads.txt or create in first basePath
    for (const basePath of basePaths) {
      const testPath = path.resolve(basePath, 'files', 'leads.txt');
      if (existsSync(testPath)) {
        leadsPath = testPath;
        break;
      }
    }

    // If no existing file, create in first basePath
    if (!leadsPath) {
      leadsPath = path.resolve(basePaths[0], 'files', 'leads.txt');
      await fs.mkdir(path.dirname(leadsPath), { recursive: true });
    }

    // Write leads array to file (one per line)
    const leadsContent = leads.join('\n');
    await fs.writeFile(leadsPath, leadsContent, 'utf-8');
    console.log(`[Electron] ${leads.length} leads saved successfully to ${leadsPath}`);

    return { success: true };
  } catch (error) {
    console.error(`[Electron] Failed to save leads:`, error);
    return { success: false, error: error.message };
  }
});

// One-time broadcast check at startup (no polling)
async function checkBroadcastsOnce(serverUrl) {
  console.log('[Electron] 🔔 Checking for broadcasts (one-time at startup)...');
  console.log('[Electron] Server URL:', serverUrl);
  console.log('[Electron] User ID:', userId);

  try {
    const url = `${serverUrl}/api/telegram/broadcasts?since=${lastBroadcastCheck}&userId=${encodeURIComponent(userId)}`;
    console.log('[Electron] 📡 Fetching broadcasts:', url);

    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();

      if (data.success && data.messages && data.messages.length > 0) {
        console.log(`[Electron] 📬 Received ${data.messages.length} broadcasts`);

        for (const msg of data.messages) {
          // Send broadcast to renderer
          mainWindow.webContents.send('admin-broadcast', {
            id: msg.id,
            message: msg.message,
            timestamp: msg.timestamp,
            downloadText: 'Download Latest Version'
          });

          // Update last check timestamp
          if (msg.timestamp > lastBroadcastCheck) {
            lastBroadcastCheck = msg.timestamp;
          }
        }
      } else {
        console.log('[Electron] ✅ No new broadcasts');
      }
    }
  } catch (error) {
    console.error('[Electron] ❌ Error checking broadcasts:', error);
  }

  console.log('[Electron] ✅ Broadcast check completed');
}

// Handle broadcast dismissal from renderer
ipcMain.handle('dismiss-broadcast', async (event, broadcastId) => {
  try {
    const serverUrl = process.env.REPLIT_SERVER_URL;
    if (!serverUrl) {
      console.error('[Electron] No server URL configured for dismissal');
      return { success: false, error: 'No server URL configured' };
    }

    const response = await fetch(`${serverUrl}/api/telegram/broadcasts/${broadcastId}/dismiss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId
      },
      body: JSON.stringify({ userId })
    });

    const result = await response.json();
    console.log(`[Electron] ✅ Dismissed broadcast ${broadcastId}:`, result);
    return result;
  } catch (error) {
    console.error('[Electron] ❌ Error dismissing broadcast:', error);
    return { success: false, error: error.message };
  }
});

// Pause/Resume broadcast polling handlers - now no-ops since we use one-time check
// Kept for backward compatibility with frontend code
ipcMain.handle('pause-broadcast-polling', async () => {
  console.log('[Electron] ℹ️ Pause broadcast polling called (no-op - using one-time check)');
  return { success: true, message: 'No polling to pause (one-time check mode)' };
});

ipcMain.handle('resume-broadcast-polling', async () => {
  console.log('[Electron] ℹ️ Resume broadcast polling called (no-op - using one-time check)');
  return { success: true, message: 'No polling to resume (one-time check mode)' };
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});