import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig, saveConfig, AppConfig } from './config';
import { generateLinkedInPost } from './gemini';
import { checkLinkedInSession, publishLinkedInPost, launchLinkedInBrowserSession } from './linkedin';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, '../src/renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('load-config', () => {
  return loadConfig();
});

ipcMain.handle('save-config', (_event, updates: Partial<AppConfig>) => {
  return saveConfig(updates);
});

ipcMain.handle('generate-post', async (_event, description: string, style: string) => {
  return await generateLinkedInPost(description, style);
});

ipcMain.handle('check-session', async () => {
  const onLog = (log: { status: 'info' | 'success' | 'error'; message: string }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation-log', log);
    }
  };
  return await checkLinkedInSession(onLog);
});

ipcMain.handle('publish-post', async (_event, content: string, imagePath: string | null) => {
  const onLog = (log: { status: 'info' | 'success' | 'error'; message: string }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation-log', log);
    }
  };
  return await publishLinkedInPost(content, imagePath, onLog);
});

ipcMain.handle('select-image', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Image',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  const filePath = result.filePaths[0];
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1);
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const base64 = `data:${mime};base64,${data.toString('base64')}`;
    return { filePath, base64 };
  } catch (err) {
    console.error('Failed to read image to base64:', err);
    return { filePath, base64: null };
  }
});

ipcMain.handle('launch-browser-session', async () => {
  const onLog = (log: { status: 'info' | 'success' | 'error'; message: string }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation-log', log);
    }
  };
  return await launchLinkedInBrowserSession(onLog);
});
