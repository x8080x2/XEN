const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  readFile: (filepath) => ipcRenderer.invoke('read-file', filepath),
  writeFile: (filepath, content) => ipcRenderer.invoke('write-file', filepath, content),
  listFiles: (dirpath) => ipcRenderer.invoke('list-files', dirpath),
  readConfig: (configDir) => ipcRenderer.invoke('read-config', configDir),

  // File selection dialogs
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFiles: () => ipcRenderer.invoke('select-files'),

  // Config and SMTP operations
  loadConfig: () => ipcRenderer.invoke('load-config'),
  loadLeads: () => ipcRenderer.invoke('load-leads'),
  smtpList: () => ipcRenderer.invoke('smtp-list'),
  smtpToggleRotation: (enabled) => ipcRenderer.invoke('smtp-toggle-rotation', enabled),
  smtpAdd: (smtpData) => ipcRenderer.invoke('smtp-add', smtpData),
  smtpDelete: (smtpId) => ipcRenderer.invoke('smtp-delete', smtpId),
  
  // Server configuration
  getServerUrl: () => process.env.REPLIT_SERVER_URL
});

// Log that preload script has loaded
console.log('[Preload] electronAPI exposed to renderer process');