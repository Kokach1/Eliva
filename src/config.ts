import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface AppConfig {
  geminiApiKey: string;
  linkedinProfileDir: string;
  defaultPostStyle: string;
}

const DEFAULT_CONFIG: AppConfig = {
  geminiApiKey: '',
  linkedinProfileDir: '',
  defaultPostStyle: 'Professional'
};

let configFilePath: string = '';

function getConfigPath(): string {
  if (!configFilePath) {
    try {
      const userDataPath = app.getPath('userData');
      configFilePath = path.join(userDataPath, 'config.json');
    } catch (e) {
      configFilePath = path.join(process.cwd(), 'config.json');
    }
  }
  return configFilePath;
}

export function loadConfig(): AppConfig {
  const filePath = getConfigPath();
  let defaultProfileDir = '';
  try {
    defaultProfileDir = path.join(app.getPath('userData'), 'linkedin-profile');
  } catch (e) {
    defaultProfileDir = path.join(process.cwd(), 'linkedin-profile');
  }

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const loaded = JSON.parse(data);
      const config = { ...DEFAULT_CONFIG, ...loaded };
      if (!config.linkedinProfileDir) {
        config.linkedinProfileDir = defaultProfileDir;
      }
      return config;
    } catch (err) {
      console.error('Failed to parse config file, using defaults', err);
    }
  }

  const config = { ...DEFAULT_CONFIG };
  if (!config.linkedinProfileDir) {
    config.linkedinProfileDir = defaultProfileDir;
  }
  saveConfig(config);
  return config;
}

export function saveConfig(config: Partial<AppConfig>): AppConfig {
  const filePath = getConfigPath();
  let current: AppConfig;
  
  // We avoid circular call of loadConfig by checking if file exists or reading it directly
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      current = JSON.parse(data);
    } catch (e) {
      current = { ...DEFAULT_CONFIG };
    }
  } else {
    current = { ...DEFAULT_CONFIG };
  }

  const updated = { ...current, ...config };
  
  // Ensure we have a profile directory
  if (!updated.linkedinProfileDir) {
    try {
      updated.linkedinProfileDir = path.join(app.getPath('userData'), 'linkedin-profile');
    } catch (e) {
      updated.linkedinProfileDir = path.join(process.cwd(), 'linkedin-profile');
    }
  }

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save config file', err);
  }
  return updated;
}
