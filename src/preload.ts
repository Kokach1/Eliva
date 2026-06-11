import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig } from './config';
import { GenerationResult } from './gemini';

contextBridge.exposeInMainWorld('elivaAPI', {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config: Partial<AppConfig>) => ipcRenderer.invoke('save-config', config),
  generatePost: (description: string, style: string) => ipcRenderer.invoke('generate-post', description, style),
  checkSession: () => ipcRenderer.invoke('check-session'),
  publishPost: (content: string, imagePath: string | null) => ipcRenderer.invoke('publish-post', content, imagePath),
  selectImage: () => ipcRenderer.invoke('select-image'),
  launchBrowserSession: () => ipcRenderer.invoke('launch-browser-session'),
  onAutomationLog: (callback: (log: { status: string; message: string }) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('automation-log', subscription);
    return () => {
      ipcRenderer.removeListener('automation-log', subscription);
    };
  }
});
