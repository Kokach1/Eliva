import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig, saveConfig, AppConfig } from './config';
import { generateLinkedInPost } from './gemini';
import { checkLinkedInSession, publishLinkedInPost, launchLinkedInBrowserSession } from './linkedin';
import { loadHistory, addHistoryEntry, deleteHistoryEntry, clearHistory } from './history';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Icon path works both in dev (from project root) and when packaged
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'eliva_logo.png')
    : path.join(__dirname, '../src/renderer/assets/eliva_logo.png');

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true
  });

  // Renderer path — works in dev and packaged
  const rendererPath = app.isPackaged
    ? path.join(process.resourcesPath, 'renderer', 'index.html')
    : path.join(__dirname, '../src/renderer/index.html');

  mainWindow.loadFile(rendererPath);

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

ipcMain.handle('publish-post', async (_event, content: string, mediaPaths: string[]) => {
  const onLog = (log: { status: 'info' | 'success' | 'error'; message: string }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation-log', log);
    }
  };
  return await publishLinkedInPost(content, mediaPaths || [], onLog);
});

ipcMain.handle('select-media', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Photos & Videos',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
      { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
      { name: 'All Media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi', 'mkv', 'webm'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm']);

  const files = result.filePaths.map(filePath => {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const isVideo = VIDEO_EXTS.has(ext);
    try {
      if (isVideo) {
        // Don't base64 encode videos — too large; renderer will use file:// URL
        return { filePath, base64: null, type: 'video' as const };
      } else {
        const data = fs.readFileSync(filePath);
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        const base64 = `data:${mime};base64,${data.toString('base64')}`;
        return { filePath, base64, type: 'image' as const };
      }
    } catch {
      return { filePath, base64: null, type: isVideo ? 'video' as const : 'image' as const };
    }
  });

  return files;
});

ipcMain.handle('launch-browser-session', async () => {
  const onLog = (log: { status: 'info' | 'success' | 'error'; message: string }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation-log', log);
    }
  };
  return await launchLinkedInBrowserSession(onLog);
});

ipcMain.handle('load-history', () => {
  return loadHistory();
});

ipcMain.handle('add-history', (_event, description: string, style: string, postContent: string, mediaFiles: Array<{ filePath: string; type: 'image' | 'video' }>) => {
  return addHistoryEntry(description, style, postContent, mediaFiles);
});

ipcMain.handle('delete-history', (_event, id: string) => {
  return deleteHistoryEntry(id);
});

ipcMain.handle('clear-history', () => {
  return clearHistory();
});

