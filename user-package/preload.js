const { contextBridge, ipcRenderer } = require('electron');

// Expose Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
  readFile: (filepath) => ipcRenderer.invoke('read-file', filepath),
  writeFile: (filepath, content) => ipcRenderer.invoke('write-file', filepath, content),
  listFiles: (dirpath) => ipcRenderer.invoke('list-files', dirpath),
  readConfig: (configDir) => ipcRenderer.invoke('read-config', configDir),
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  loadLeads: () => ipcRenderer.invoke('load-leads'),
  smtpList: () => ipcRenderer.invoke('smtp-list'),
  smtpToggleRotation: (enabled) => ipcRenderer.invoke('smtp-toggle-rotation', enabled),
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
});

// Log that preload script has loaded
console.log('[Preload] electronAPI exposed to renderer process');