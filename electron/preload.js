/**
 * Electron Preload Script
 *
 * Bridges the context-isolated renderer with the main process.
 * Exposes `window.electronAPI` containing:
 * - Dialog helpers (openFolder, openFile, saveFile, showWarning, showConfirm, showPrompt)
 * - File-system helpers (listXmlFiles, readFile, writeFile, fileExists, getModifiedTime)
 * - Window helpers (setTitle)
 * - Menu event listeners (onMenuNewTree, onMenuOpenWorkspace, onMenuOpenTree, onMenuSave,
 *   onMenuExport, onMenuUndo, onMenuRedo) -- each returns a cleanup function.
 *
 * Also exposes `window.isElectron = true` so the renderer can detect the runtime
 * environment without importing Electron modules.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // ---- Dialog operations ----
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  showWarning: (options) => ipcRenderer.invoke('dialog:showWarning', options),
  showConfirm: (options) => ipcRenderer.invoke('dialog:showConfirm', options),
  showPrompt: (options) => ipcRenderer.invoke('dialog:showPrompt', options),

  // ---- File system operations ----
  listXmlFiles: (dirPath) => ipcRenderer.invoke('fs:listXmlFiles', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),
  getModifiedTime: (filePath) => ipcRenderer.invoke('fs:getModifiedTime', filePath),

  // ---- Window operations ----
  setTitle: (title) => ipcRenderer.send('window:setTitle', title),

  // ---- Menu event listeners (each returns a cleanup function) ----
  onMenuNewTree: (callback) => {
    ipcRenderer.on('menu:newTree', () => callback());
    return () => ipcRenderer.removeAllListeners('menu:newTree');
  },
  onMenuOpenWorkspace: (callback) => {
    ipcRenderer.on('menu:openWorkspace', () => callback());
    return () => ipcRenderer.removeAllListeners('menu:openWorkspace');
  },
  onMenuOpenTree: (callback) => {
    ipcRenderer.on('menu:openTree', () => callback());
    return () => ipcRenderer.removeAllListeners('menu:openTree');
  },
  onMenuSave: (callback) => {
    ipcRenderer.on('menu:save', () => callback());
    return () => ipcRenderer.removeAllListeners('menu:save');
  },
  onMenuExport: (callback) => {
    ipcRenderer.on('menu:export', () => callback());
    return () => ipcRenderer.removeAllListeners('menu:export');
  },
  onMenuUndo: (callback) => {
    ipcRenderer.on('menu:undo', () => callback());
    return () => ipcRenderer.removeAllListeners('menu:undo');
  },
  onMenuRedo: (callback) => {
    ipcRenderer.on('menu:redo', () => callback());
    return () => ipcRenderer.removeAllListeners('menu:redo');
  }
});

// Indicate that we're running in Electron
contextBridge.exposeInMainWorld('isElectron', true);
