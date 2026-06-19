import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface HistoryMedia {
  originalPath: string;
  savedPath: string;
  type: 'image' | 'video';
  base64?: string | null;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  description: string;
  style: string;
  postContent: string;
  media: HistoryMedia[];
}

function getHistoryPath(): string {
  try {
    return path.join(app.getPath('userData'), 'history.json');
  } catch (e) {
    return path.join(process.cwd(), 'history.json');
  }
}

function getHistoryMediaDir(): string {
  try {
    return path.join(app.getPath('userData'), 'history_media');
  } catch (e) {
    return path.join(process.cwd(), 'history_media');
  }
}

export function loadHistory(): HistoryItem[] {
  const filePath = getHistoryPath();
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as HistoryItem[];
    } catch (e) {
      console.error('Failed to read history:', e);
      return [];
    }
  }
  return [];
}

export function saveHistory(items: HistoryItem[]) {
  const filePath = getHistoryPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

export function addHistoryEntry(
  description: string,
  style: string,
  postContent: string,
  mediaFiles: Array<{ filePath: string; type: 'image' | 'video' }>
): HistoryItem {
  const items = loadHistory();
  const id = Date.now().toString();
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  const timestamp = new Date().toLocaleString('en-US', dateOptions);

  const mediaDir = path.join(getHistoryMediaDir(), id);
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  const copiedMedia: HistoryMedia[] = [];

  for (const file of mediaFiles) {
    const fileName = path.basename(file.filePath);
    const destPath = path.join(mediaDir, fileName);

    try {
      // Ensure source file exists before trying to copy
      if (fs.existsSync(file.filePath)) {
        fs.copyFileSync(file.filePath, destPath);

        let base64: string | null = null;
        if (file.type === 'image') {
          const ext = path.extname(destPath).slice(1).toLowerCase();
          const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          const buffer = fs.readFileSync(destPath);
          base64 = `data:${mime};base64,${buffer.toString('base64')}`;
        }

        copiedMedia.push({
          originalPath: file.filePath,
          savedPath: destPath,
          type: file.type,
          base64
        });
      } else {
        // Source file doesn't exist, just keep reference
        copiedMedia.push({
          originalPath: file.filePath,
          savedPath: file.filePath,
          type: file.type,
          base64: null
        });
      }
    } catch (err) {
      console.error(`Failed to copy history media file ${file.filePath}:`, err);
      copiedMedia.push({
        originalPath: file.filePath,
        savedPath: file.filePath,
        type: file.type,
        base64: null
      });
    }
  }

  const newItem: HistoryItem = {
    id,
    timestamp,
    description,
    style,
    postContent,
    media: copiedMedia
  };

  items.unshift(newItem);

  // Keep last 20 and clean up others
  if (items.length > 20) {
    const removedItems = items.splice(20);
    for (const item of removedItems) {
      deleteHistoryMediaFolder(item.id);
    }
  }

  saveHistory(items);
  return newItem;
}

export function deleteHistoryEntry(id: string): HistoryItem[] {
  let items = loadHistory();
  items = items.filter(item => {
    if (item.id === id) {
      deleteHistoryMediaFolder(id);
      return false;
    }
    return true;
  });
  saveHistory(items);
  return items;
}

export function clearHistory() {
  const items = loadHistory();
  for (const item of items) {
    deleteHistoryMediaFolder(item.id);
  }
  saveHistory([]);
}

function deleteHistoryMediaFolder(id: string) {
  const mediaDir = path.join(getHistoryMediaDir(), id);
  if (fs.existsSync(mediaDir)) {
    try {
      fs.rmSync(mediaDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Failed to delete history media folder ${mediaDir}:`, err);
    }
  }
}
