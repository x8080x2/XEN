const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const https = require('https');
const http = require('http');

// Load environment variables
require('dotenv').config();

// Keep a global reference of the window object
let mainWindow;

async function verifyLicense() {
  const licenseKey = process.env.LICENSE_KEY;
  const serverUrl = process.env.REPLIT_SERVER_URL;

  if (!licenseKey) {
    console.error('[License] No LICENSE_KEY found in .env file');
    return {
      valid: false,
      error: 'No license key found. Please add LICENSE_KEY to your .env file.'
    };
  }

  if (!serverUrl) {
    console.error('[License] No REPLIT_SERVER_URL found in .env file');
    return {
      valid: false,
      error: 'No server URL configured. Please add REPLIT_SERVER_URL to your .env file.'
    };
  }

  return new Promise((resolve) => {
    try {
      const url = new URL('/api/license/verify', serverUrl);
      const protocol = url.protocol === 'https:' ? https : http;
      const postData = JSON.stringify({ licenseKey });

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      };

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.valid) {
              console.log('[License] ✅ License verified successfully');
              resolve({ valid: true });
            } else {
              console.error('[License] ❌ Invalid license:', result.reason);
              resolve({
                valid: false,
                error: result.reason || 'Invalid license key'
              });
            }
          } catch (error) {
            console.error('[License] Failed to parse server response:', error);
            resolve({
              valid: false,
              error: 'Failed to verify license with server'
            });
          }
        });
      });

      req.on('error', (error) => {
        console.error('[License] Network error:', error);
        resolve({
          valid: false,
          error: `Cannot connect to server: ${error.message}`
        });
      });

      req.on('timeout', () => {
        req.destroy();
        console.error('[License] Request timeout');
        resolve({
          valid: false,
          error: 'License verification timed out'
        });
      });

      req.write(postData);
      req.end();
    } catch (error) {
      console.error('[License] Verification error:', error);
      resolve({
        valid: false,
        error: `License verification failed: ${error.message}`
      });
    }
  });
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
    await dialog.showMessageBox({
      type: 'error',
      title: 'License Verification Failed',
      message: 'Invalid or Missing License',
      detail: licenseResult.error + '\n\nPlease:\n1. Get a license key from the Telegram bot\n2. Add it to your .env file as LICENSE_KEY=your-key-here\n3. Restart the application',
      buttons: ['Exit']
    });
    
    app.quit();
    return;
  }
  
  console.log('[Electron] ✅ License verified - Starting application...');
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// IPC handlers for file operations
ipcMain.handle('read-file', async (event, filepath) => {
  try {
    console.log(`[Electron] Reading file: ${filepath}`);
    
    // Use only the user-package directory as base
    const resolvedPath = path.resolve(__dirname, filepath);
    console.log(`[Electron] Resolved path: ${resolvedPath}`);
    
    if (existsSync(resolvedPath)) {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      console.log(`[Electron] Successfully read file: ${filepath} (${content.length} chars)`);
      return content;
    }
    
    throw new Error(`File not found: ${filepath}`);
  } catch (error) {
    console.error(`[Electron] Failed to read file ${filepath}:`, error);
    throw error;
  }
});

ipcMain.handle('write-file', async (event, filepath, content) => {
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

ipcMain.handle('list-files', async (event, dirpath) => {
  try {
    console.log(`[Electron] Listing files in: ${dirpath}`);
    
    // Use only the user-package directory as base
    const resolvedPath = path.resolve(__dirname, dirpath);
    console.log(`[Electron] Resolved directory: ${resolvedPath}`);
    
    if (!existsSync(resolvedPath)) {
      console.log(`[Electron] Directory not found: ${dirpath}`);
      return [];
    }
    
    const files = await fs.readdir(resolvedPath);
    
    // Filter files based on directory type
    let filteredFiles;
    if (dirpath.includes('logo')) {
      // For logo directory, filter image files
      filteredFiles = files.filter(file => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file));
      console.log(`[Electron] Found ${filteredFiles.length} image files in ${dirpath}:`, filteredFiles);
    } else {
      // For other directories, filter HTML files
      filteredFiles = files.filter(file => /\.(html|htm)$/i.test(file));
      console.log(`[Electron] Found ${filteredFiles.length} HTML files in ${dirpath}:`, filteredFiles);
    }
    
    return filteredFiles;
  } catch (error) {
    console.error(`[Electron] Failed to list files in ${dirpath}:`, error);
    return [];
  }
});

ipcMain.handle('read-config', async (event, configDir) => {
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

ipcMain.handle('select-file', async () => {
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

ipcMain.handle('select-files', async () => {
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
ipcMain.handle('load-config', async () => {
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
        smtpContent = await fs.readFile(smtpPath, 'utf-8');
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
ipcMain.handle('load-leads', async () => {
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

// SMTP list handler
ipcMain.handle('smtp-list', async () => {
  try {
    console.log(`[Electron] Loading SMTP configurations`);
    
    const basePaths = [
      __dirname, // user-package directory
      process.cwd(), // current working directory
      path.resolve(__dirname, '..'), // parent directory
    ];
    
    for (const basePath of basePaths) {
      const smtpPath = path.resolve(basePath, 'config', 'smtp.ini');
      
      console.log(`[Electron] Checking SMTP path: ${smtpPath}`);
      
      if (existsSync(smtpPath)) {
        const content = await fs.readFile(smtpPath, 'utf-8');
        const smtpConfig = parseIniFile(content);
        
        const smtpKeys = Object.keys(smtpConfig).filter(key => key.startsWith('smtp'));
        const smtpConfigs = smtpKeys.map(key => ({ id: key, ...smtpConfig[key] }));
        
        const result = {
          success: true,
          smtpConfigs,
          currentSmtp: smtpConfigs.length > 0 ? smtpConfigs[0] : null,
          rotationEnabled: false
        };
        
        console.log(`[Electron] Loaded ${smtpConfigs.length} SMTP configs from ${smtpPath}`);
        return result;
      }
    }
    
    console.log(`[Electron] No SMTP config found`);
    return { success: true, smtpConfigs: [], currentSmtp: null, rotationEnabled: false };
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

// Parse config values
function parseValue(value) {
  if (value === '') return '';
  if (value === '0') return 0;
  if (value === '1') return 1;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});