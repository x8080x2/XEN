const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onAdminBroadcast: (callback) => {
    ipcRenderer.on('admin-broadcast', (event, data) => callback(data));
  },
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
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  saveLeads: (leads) => ipcRenderer.invoke('save-leads', leads),
  smtpList: () => ipcRenderer.invoke('smtp:list'),
  smtpAdd: (config) => ipcRenderer.invoke('smtp:add', config),
  smtpDelete: (id) => ipcRenderer.invoke('smtp:delete', id),
  smtpRotate: () => ipcRenderer.invoke('smtp:rotate'),
  smtpToggleRotation: (enabled) => ipcRenderer.invoke('smtp:toggle-rotation', enabled),
  smtpTest: () => ipcRenderer.invoke('smtp:test'),

  // NOTE: Email sending and AI operations now use backend API via replitApiService
  // sendEmail, getEmailProgress, cancelEmail, and AI features have been removed from Electron IPC
  // Desktop app now connects to backend server for email processing and AI features

  // File upload
  fileUpload: (sourceFilePath) => ipcRenderer.invoke('file-upload', sourceFilePath),

  // Server configuration
  getServerUrl: () => process.env.REPLIT_SERVER_URL
});

// Log that preload script has loaded
console.log('[Preload] electronAPI exposed to renderer process');