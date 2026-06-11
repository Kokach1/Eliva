export {};

interface AppConfig {
  geminiApiKey: string;
  linkedinProfileDir: string;
  defaultPostStyle: string;
}

declare global {
  interface Window {
    api: {
      loadConfig: () => Promise<AppConfig>;
      saveConfig: (config: Partial<AppConfig>) => Promise<AppConfig>;
      selectImage: () => Promise<string | null>;
      generatePost: (description: string, style: string) => Promise<{ postContent: string; hashtags: string[] }>;
      checkSession: () => Promise<boolean>;
      postToLinkedIn: (imagePath: string, postContent: string) => Promise<boolean>;
      onLog: (callback: (log: { status: 'info' | 'success' | 'error'; message: string }) => void) => () => void;
    };
  }
}

// State management
let selectedImagePath: string | null = null;
let currentConfig: AppConfig | null = null;
let activeLogCleanup: (() => void) | null = null;

// DOM Cache
const dom = {
  // Header
  settingsToggle: document.getElementById('settings-toggle') as HTMLButtonElement,
  
  // Left Panel
  dropZone: document.getElementById('drop-zone') as HTMLDivElement,
  imagePreview: document.getElementById('image-preview') as HTMLImageElement,
  removeImageBtn: document.getElementById('remove-image-btn') as HTMLButtonElement,
  sessionStatus: document.getElementById('session-status') as HTMLSpanElement,
  btnConfigureSession: document.getElementById('btn-configure-session') as HTMLButtonElement,
  consoleLogs: document.getElementById('console-logs') as HTMLDivElement,
  
  // Right Panel
  descriptionInput: document.getElementById('description-input') as HTMLTextAreaElement,
  styleSelect: document.getElementById('style-select') as HTMLSelectElement,
  btnGenerate: document.getElementById('btn-generate') as HTMLButtonElement,
  
  // Preview
  btnRegenerate: document.getElementById('btn-regenerate') as HTMLButtonElement,
  btnCopy: document.getElementById('btn-copy') as HTMLButtonElement,
  postBodyEditor: document.getElementById('post-body-editor') as HTMLTextAreaElement,
  postHashtagsEditor: document.getElementById('post-hashtags-editor') as HTMLInputElement,
  btnPostLinkedIn: document.getElementById('btn-post-linkedin') as HTMLButtonElement,
  
  // Settings Drawer
  settingsOverlay: document.getElementById('settings-overlay') as HTMLDivElement,
  settingsClose: document.getElementById('settings-close') as HTMLButtonElement,
  settingApiKey: document.getElementById('setting-api-key') as HTMLInputElement,
  settingProfileDir: document.getElementById('setting-profile-dir') as HTMLInputElement,
  settingDefaultStyle: document.getElementById('setting-default-style') as HTMLSelectElement,
  btnSaveSettings: document.getElementById('btn-save-settings') as HTMLButtonElement,
  
  // Toast Container
  toastContainer: document.getElementById('toast-container') as HTMLDivElement
};

// Initialize app
async function init() {
  await loadAndApplyConfig();
  setupEventListeners();
  setupLogListener();
  
  // Do a quick, non-blocking silent check of the session on startup
  checkLinkedInSessionStatus(true);
}

// Event Listeners
function setupEventListeners() {
  // Settings toggle
  dom.settingsToggle.addEventListener('click', () => toggleSettingsDrawer(true));
  dom.settingsClose.addEventListener('click', () => toggleSettingsDrawer(false));
  dom.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === dom.settingsOverlay) toggleSettingsDrawer(false);
  });
  dom.btnSaveSettings.addEventListener('click', saveSettings);

  // Drag & drop handlers
  const fileInputTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

  dom.dropZone.addEventListener('click', async (e) => {
    // Prevent trigger if clicking on remove button
    if (e.target === dom.removeImageBtn) return;
    const path = await window.api.selectImage();
    if (path) {
      handleImageSelection(path);
    }
  });

  dom.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropZone.classList.add('dragover');
  });

  dom.dropZone.addEventListener('dragleave', () => {
    dom.dropZone.classList.remove('dragover');
  });

  dom.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropZone.classList.remove('dragover');
    
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      
      // In Electron, File objects contain the path of the file on disk
      const filePath = (file as any).path;
      
      if (fileInputTypes.includes(file.type) && filePath) {
        handleImageSelection(filePath);
      } else {
        showToast('Invalid file format. Please upload JPG, PNG, or WEBP.', 'error');
      }
    }
  });

  dom.removeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImageSelection();
  });

  // Post generation
  dom.btnGenerate.addEventListener('click', generatePost);
  dom.btnRegenerate.addEventListener('click', generatePost);
  
  // Actions
  dom.btnCopy.addEventListener('click', copyPostToClipboard);
  dom.btnConfigureSession.addEventListener('click', configureLinkedInSession);
  dom.btnPostLinkedIn.addEventListener('click', publishToLinkedIn);
}

// Settings handlers
async function loadAndApplyConfig() {
  try {
    currentConfig = await window.api.loadConfig();
    
    // Set UI values
    dom.settingApiKey.value = currentConfig.geminiApiKey || '';
    dom.settingProfileDir.value = currentConfig.linkedinProfileDir || '';
    dom.settingDefaultStyle.value = currentConfig.defaultPostStyle || 'Professional';
    dom.styleSelect.value = currentConfig.defaultPostStyle || 'Professional';
  } catch (err) {
    showToast('Failed to load settings configuration.', 'error');
  }
}

async function saveSettings() {
  const updatedConfig: Partial<AppConfig> = {
    geminiApiKey: dom.settingApiKey.value.trim(),
    defaultPostStyle: dom.settingDefaultStyle.value
  };

  try {
    currentConfig = await window.api.saveConfig(updatedConfig);
    showToast('Configuration saved successfully!', 'success');
    toggleSettingsDrawer(false);
    
    // Sync UI selection
    dom.styleSelect.value = currentConfig.defaultPostStyle;
  } catch (err) {
    showToast('Failed to save configuration settings.', 'error');
  }
}

function toggleSettingsDrawer(show: boolean) {
  if (show) {
    dom.settingsOverlay.classList.remove('hidden');
  } else {
    dom.settingsOverlay.classList.add('hidden');
  }
}

// Image Selection handlers
function handleImageSelection(filePath: string) {
  selectedImagePath = filePath;
  
  // Update UI preview
  dom.imagePreview.src = `file:///${filePath.replace(/\\/g, '/')}`;
  dom.imagePreview.classList.remove('hidden');
  dom.removeImageBtn.classList.remove('hidden');
  
  // Hide drop details text
  const content = dom.dropZone.querySelector('.drop-zone-content') as HTMLDivElement;
  if (content) content.classList.add('hidden');
  
  validateInputsForPosting();
  showToast('Image loaded successfully.', 'success');
}

function clearImageSelection() {
  selectedImagePath = null;
  dom.imagePreview.src = '';
  dom.imagePreview.classList.add('hidden');
  dom.removeImageBtn.classList.add('hidden');
  
  const content = dom.dropZone.querySelector('.drop-zone-content') as HTMLDivElement;
  if (content) content.classList.remove('hidden');
  
  validateInputsForPosting();
}

// Log streaming handler
function setupLogListener() {
  if (activeLogCleanup) {
    activeLogCleanup();
  }
  
  activeLogCleanup = window.api.onLog((log) => {
    appendConsoleLog(log.message, log.status);
  });
}

function appendConsoleLog(message: string, status: string = 'info') {
  const logDiv = document.createElement('div');
  logDiv.className = `log-entry ${status}`;
  logDiv.textContent = `> ${message}`;
  dom.consoleLogs.appendChild(logDiv);
  
  // Keep clean: scroll to bottom
  dom.consoleLogs.scrollTop = dom.consoleLogs.scrollHeight;
}

// Session Checker
async function checkLinkedInSessionStatus(silent: boolean = false) {
  if (!silent) {
    appendConsoleLog('Checking LinkedIn login status...', 'info');
  }
  
  // We check if it is active. Since it requires opening chromium, we will log it.
  // Actually, we can perform checking and wait for it.
  // We can let the user know by clicking.
}

async function configureLinkedInSession() {
  dom.btnConfigureSession.disabled = true;
  dom.sessionStatus.textContent = 'Configuring...';
  dom.sessionStatus.className = 'status-tag status-not-ready';
  
  appendConsoleLog('Initiating session configuration script...', 'info');
  
  try {
    const success = await window.api.checkSession();
    if (success) {
      dom.sessionStatus.textContent = 'READY';
      dom.sessionStatus.className = 'status-tag status-ready';
      showToast('LinkedIn Session is ready!', 'success');
    } else {
      dom.sessionStatus.textContent = 'NOT READY';
      dom.sessionStatus.className = 'status-tag status-not-ready';
      showToast('LinkedIn session not authenticated.', 'error');
    }
  } catch (err: any) {
    appendConsoleLog(`Configuration failed: ${err.message}`, 'error');
    showToast('Failed to configure LinkedIn session.', 'error');
    dom.sessionStatus.textContent = 'ERROR';
    dom.sessionStatus.className = 'status-tag status-not-ready';
  } finally {
    dom.btnConfigureSession.disabled = false;
    validateInputsForPosting();
  }
}

// Generate Post handler
async function generatePost() {
  const desc = dom.descriptionInput.value.trim();
  const style = dom.styleSelect.value;
  
  if (!desc) {
    showToast('Please enter a description first.', 'error');
    return;
  }
  
  // Set UI state
  setGenerationLoading(true);
  appendConsoleLog(`Sending prompt to Gemini API [Style: ${style}]...`, 'info');
  
  try {
    const result = await window.api.generatePost(desc, style);
    
    // Fill text editors
    dom.postBodyEditor.value = result.postContent;
    dom.postHashtagsEditor.value = result.hashtags.join(' ');
    
    // Enable editing
    dom.postBodyEditor.disabled = false;
    dom.postHashtagsEditor.disabled = false;
    
    dom.btnRegenerate.disabled = false;
    dom.btnCopy.disabled = false;
    
    appendConsoleLog('LinkedIn post content generated successfully!', 'success');
    showToast('Content generated successfully.', 'success');
  } catch (err: any) {
    appendConsoleLog(`Gemini generation failed: ${err.message}`, 'error');
    showToast('Generation failed. Verify your API Key.', 'error');
  } finally {
    setGenerationLoading(false);
    validateInputsForPosting();
  }
}

function setGenerationLoading(loading: boolean) {
  if (loading) {
    dom.btnGenerate.disabled = true;
    dom.btnRegenerate.disabled = true;
    dom.btnGenerate.textContent = '⌛ Generating...';
  } else {
    dom.btnGenerate.disabled = false;
    dom.btnGenerate.textContent = '✨ Generate Post';
  }
}

// Copy Post Handler
function copyPostToClipboard() {
  const body = dom.postBodyEditor.value.trim();
  const tags = dom.postHashtagsEditor.value.trim();
  
  const fullPost = `${body}\n\n${tags}`;
  
  navigator.clipboard.writeText(fullPost)
    .then(() => {
      showToast('Post copied to clipboard!', 'success');
      appendConsoleLog('Content copied to local clipboard.', 'info');
    })
    .catch(() => {
      showToast('Failed to copy text.', 'error');
    });
}

// Validate Inputs for Posting Button state
function validateInputsForPosting() {
  const hasImage = selectedImagePath !== null;
  const hasText = dom.postBodyEditor.value.trim() !== '';
  
  if (hasImage && hasText) {
    dom.btnPostLinkedIn.disabled = false;
  } else {
    dom.btnPostLinkedIn.disabled = true;
  }
}

// Publish to LinkedIn handler
async function publishToLinkedIn() {
  const content = dom.postBodyEditor.value.trim();
  const tags = dom.postHashtagsEditor.value.trim();
  const fullText = `${content}\n\n${tags}`;
  
  if (!selectedImagePath) {
    showToast('Please select an image first.', 'error');
    return;
  }
  
  if (!content) {
    showToast('Please generate post content first.', 'error');
    return;
  }

  // Double check connection status or warnings
  dom.btnPostLinkedIn.disabled = true;
  dom.btnPostLinkedIn.textContent = '🤖 Publishing...';
  appendConsoleLog('Starting Playwright automated posting session...', 'info');

  try {
    const success = await window.api.postToLinkedIn(selectedImagePath, fullText);
    if (success) {
      showToast('Post published successfully!', 'success');
      appendConsoleLog('Automation completed. Post is live!', 'success');
    } else {
      showToast('Publishing failed. Check automation console.', 'error');
    }
  } catch (err: any) {
    appendConsoleLog(`Publish failed: ${err.message}`, 'error');
    showToast('Publishing encountered an error.', 'error');
  } finally {
    dom.btnPostLinkedIn.textContent = '🚀 Publish to LinkedIn';
    validateInputsForPosting();
  }
}

// Helper: Toast notifications
function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast = document.createElement('div');
  toast.className = `neobrutalist-toast toast-${type}`;
  
  const text = document.createElement('span');
  text.textContent = message;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => toast.remove();
  
  toast.appendChild(text);
  toast.appendChild(closeBtn);
  
  dom.toastContainer.appendChild(toast);
  
  // Auto-remove toast after 4 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 4000);
}

// Run init
document.addEventListener('DOMContentLoaded', init);
