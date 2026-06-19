import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig } from './config';
import { GenerationResult } from './gemini';

contextBridge.exposeInMainWorld('elivaAPI', {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config: Partial<AppConfig>) => ipcRenderer.invoke('save-config', config),
  generatePost: (description: string, style: string) => ipcRenderer.invoke('generate-post', description, style),
  checkSession: () => ipcRenderer.invoke('check-session'),
  publishPost: (content: string, mediaPaths: string[]) => ipcRenderer.invoke('publish-post', content, mediaPaths),
  selectMedia: () => ipcRenderer.invoke('select-media'),
  launchBrowserSession: () => ipcRenderer.invoke('launch-browser-session'),
  loadHistory: () => ipcRenderer.invoke('load-history'),
  addHistory: (description: string, style: string, postContent: string, mediaFiles: any[]) => ipcRenderer.invoke('add-history', description, style, postContent, mediaFiles),
  deleteHistory: (id: string) => ipcRenderer.invoke('delete-history', id),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  onAutomationLog: (callback: (log: { status: string; message: string }) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('automation-log', subscription);
    return () => {
      ipcRenderer.removeListener('automation-log', subscription);
    };
  }
});
