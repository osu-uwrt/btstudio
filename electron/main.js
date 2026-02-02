const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow = null;

// Determine if we're in development mode
const isDev = !app.isPackaged;

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'BTstudio',
    show: false
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tree...',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu:newTree')
        },
        { type: 'separator' },
        {
          label: 'Open Workspace...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu:openWorkspace')
        },
        {
          label: 'Open Tree...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow.webContents.send('menu:openTree')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save')
        },
        {
          label: 'Export Tree...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow.webContents.send('menu:export')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu:undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => mainWindow.webContents.send('menu:redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            if (!isDev) {
              checkForUpdates();
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Updates',
                message: 'Auto-update is disabled in development mode.'
              });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About BTstudio',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About BTstudio',
              message: 'BTstudio v0.1.0',
              detail: 'A visual editor for BehaviorTree.cpp compatible XML trees.'
            });
          }
        }
      ]
    }
  ];

  // Add macOS-specific menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  
  if (!isDev) {
    // Check for updates 5 seconds after launch
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 5000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============ IPC Handlers ============

// Open folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Workspace Folder'
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// Open file dialog
ipcMain.handle('dialog:openFile', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'BehaviorTree XML', extensions: ['xml'] }],
    title: options.title || 'Open Tree File',
    defaultPath: options.defaultPath
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// Save file dialog
ipcMain.handle('dialog:saveFile', async (event, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'BehaviorTree XML', extensions: ['xml'] }],
    title: options.title || 'Save Tree File',
    defaultPath: options.defaultPath
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePath;
});

// List XML files in a directory
ipcMain.handle('fs:listXmlFiles', async (event, dirPath) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    const xmlFiles = files.filter(f => f.endsWith('.xml') && f !== 'subtree_library.xml');
    
    // Get file stats for each
    const fileInfos = await Promise.all(
      xmlFiles.map(async (filename) => {
        const filePath = path.join(dirPath, filename);
        const stats = await fs.promises.stat(filePath);
        return {
          name: filename,
          path: filePath,
          modifiedTime: stats.mtime.toISOString()
        };
      })
    );
    
    return fileInfos;
  } catch (error) {
    console.error('Error listing XML files:', error);
    return [];
  }
});

// Read file
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const stats = await fs.promises.stat(filePath);
    return {
      content,
      modifiedTime: stats.mtime.toISOString()
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
});

// Write file
ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

// Check if file exists
ipcMain.handle('fs:fileExists', async (event, filePath) => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// Get file modification time
ipcMain.handle('fs:getModifiedTime', async (event, filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.mtime.toISOString();
  } catch {
    return null;
  }
});

// Show warning dialog
ipcMain.handle('dialog:showWarning', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: options.title || 'Warning',
    message: options.message,
    detail: options.detail,
    buttons: options.buttons || ['OK'],
    defaultId: 0,
    cancelId: options.cancelId ?? -1
  });
  
  return result.response;
});

// Show confirmation dialog
ipcMain.handle('dialog:showConfirm', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: options.title || 'Confirm',
    message: options.message,
    detail: options.detail,
    buttons: options.buttons || ['Yes', 'No'],
    defaultId: 0,
    cancelId: 1
  });
  
  return result.response === 0;
});

// Show prompt dialog (using message box since Electron doesn't have native prompts)
ipcMain.handle('dialog:showPrompt', async (event, options) => {
  // Use a save file dialog as a workaround for getting text input
  // The user types the filename which we extract
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Enter Name',
    defaultPath: options.defaultValue || 'Untitled',
    buttonLabel: 'OK',
    filters: options.filters || [{ name: 'XML Files', extensions: ['xml'] }],
    properties: ['showOverwriteConfirmation']
  });
  
  if (result.canceled || !result.filePath) {
    return null;
  }
  
  return result.filePath;
});

// Show input dialog for subtree name/description
ipcMain.handle('dialog:showInput', async (event, options) => {
  // Since Electron doesn't have native input dialogs, we use a workaround
  // Return a simple prompt-like structure that the renderer handles
  // For now, just return the title to indicate the dialog was triggered
  // The actual input will be handled by a custom React modal
  return { triggered: true, ...options };
});

// Set window title
ipcMain.on('window:setTitle', (event, title) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

// Auto-updater functions
function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

autoUpdater.on('checking-for-update', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update:checking');
  }
});

autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available!`,
    detail: 'Would you like to download it now?',
    buttons: ['Download', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-not-available', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'No Updates',
    message: 'You are running the latest version.'
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
  if (mainWindow) {
    mainWindow.webContents.send('update:download-progress', progressObj);
    mainWindow.setProgressBar(progressObj.percent / 100);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.setProgressBar(-1);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. The application will restart to install the update.',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: 'Update Error',
    message: 'An error occurred while checking for updates.',
    detail: err.toString()
  });
});
