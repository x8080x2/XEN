const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');

// Keep a global reference of the window object
let mainWindow;

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

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

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
    
    // Resolve relative paths from the app directory
    const resolvedPath = path.resolve(process.cwd(), filepath);
    console.log(`[Electron] Resolved path: ${resolvedPath}`);
    
    if (!existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }
    
    const content = await fs.readFile(resolvedPath, 'utf-8');
    console.log(`[Electron] Successfully read file: ${filepath} (${content.length} chars)`);
    return content;
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
    
    // Resolve relative paths from the app directory
    const resolvedPath = path.resolve(process.cwd(), dirpath);
    console.log(`[Electron] Resolved directory: ${resolvedPath}`);
    
    if (!existsSync(resolvedPath)) {
      console.log(`[Electron] Directory not found: ${resolvedPath}`);
      return [];
    }
    
    const files = await fs.readdir(resolvedPath);
    const htmlFiles = files.filter(file => /\.(html|htm)$/i.test(file));
    
    console.log(`[Electron] Found ${htmlFiles.length} HTML files in ${dirpath}:`, htmlFiles);
    return htmlFiles;
  } catch (error) {
    console.error(`[Electron] Failed to list files in ${dirpath}:`, error);
    return [];
  }
});

ipcMain.handle('read-config', async (event, configDir) => {
  try {
    console.log(`[Electron] Reading config from: ${configDir}`);
    
    const setupPath = path.resolve(process.cwd(), configDir, 'setup.ini');
    const smtpPath = path.resolve(process.cwd(), configDir, 'smtp.ini');
    
    const config = {};
    
    // Read setup.ini if it exists
    if (existsSync(setupPath)) {
      const setupContent = await fs.readFile(setupPath, 'utf-8');
      console.log(`[Electron] Found setup.ini`);
      // Basic INI parsing - you might want to use a proper INI parser
      config.setup = setupContent;
    }
    
    // Read smtp.ini if it exists
    if (existsSync(smtpPath)) {
      const smtpContent = await fs.readFile(smtpPath, 'utf-8');
      console.log(`[Electron] Found smtp.ini`);
      config.smtp = smtpContent;
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

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});