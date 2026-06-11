// Global state
let currentImagePath = null;
let currentConfig = null;
let generatedContent = null;
let generatedHashtags = [];

// DOM Elements
const tabDashboardBtn = document.getElementById('tab-dashboard-btn');
const tabSettingsBtn = document.getElementById('tab-settings-btn');
const dashboardPage = document.getElementById('dashboard-page');
const settingsPage = document.getElementById('settings-page');

const dropZone = document.getElementById('drop-zone');
const dropZonePrompt = document.getElementById('drop-zone-prompt');
const previewWrapper = document.getElementById('preview-wrapper');
const imagePreviewImg = document.getElementById('image-preview-img');
const removeImageBtn = document.getElementById('remove-image-btn');

const postDescInput = document.getElementById('post-desc-input');
const postStyleSelect = document.getElementById('post-style-select');
const generateBtn = document.getElementById('generate-btn');

const editBtn = document.getElementById('edit-btn');
const copyBtn = document.getElementById('copy-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
const generatedPostText = document.getElementById('generated-post-text');
const hashtagsContainer = document.getElementById('hashtags-container');
const publishBtn = document.getElementById('publish-btn');

const statusBadge = document.getElementById('status-badge');
const verifySessionQuickBtn = document.getElementById('verify-session-quick-btn');
const launchBrowserQuickBtn = document.getElementById('launch-browser-quick-btn');

// Settings DOM Elements
const settingsApiKey = document.getElementById('settings-api-key');
const settingsProfileDir = document.getElementById('settings-profile-dir');
const settingsDefaultStyle = document.getElementById('settings-default-style');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const checkSessionBtn = document.getElementById('check-session-btn');
const settingsLaunchBrowserBtn = document.getElementById('settings-launch-browser-btn');

// Toast
const toastNotification = document.getElementById('toast-notification');
const toastMessage = document.getElementById('toast-message');

// Modal
const automationModal = document.getElementById('automation-modal');
const automationLogs = document.getElementById('automation-logs');
const closeModalBtn = document.getElementById('close-modal-btn');

// Initialize App
window.addEventListener('DOMContentLoaded', async () => {
  // Load configuration
  currentConfig = await window.elivaAPI.loadConfig();
  
  // Populate settings fields
  settingsApiKey.value = currentConfig.geminiApiKey || '';
  settingsProfileDir.value = currentConfig.linkedinProfileDir || '';
  settingsDefaultStyle.value = currentConfig.defaultPostStyle || 'Professional';
  
  // Update dashboard style selector to match default
  postStyleSelect.value = currentConfig.defaultPostStyle || 'Professional';

  // Setup Event Listeners
  setupNavigation();
  setupImageSelection();
  setupPostGeneration();
  setupPublishing();
  setupSettingsHandlers();
  setupAutomationLogger();
});

// Navigation Handling
function setupNavigation() {
  tabDashboardBtn.addEventListener('click', () => {
    tabDashboardBtn.classList.add('active-tab-btn');
    tabSettingsBtn.classList.remove('active-tab-btn');
    dashboardPage.classList.add('active-page');
    settingsPage.classList.remove('active-page');
  });

  tabSettingsBtn.addEventListener('click', () => {
    tabSettingsBtn.classList.add('active-tab-btn');
    tabDashboardBtn.classList.remove('active-tab-btn');
    settingsPage.classList.add('active-page');
    dashboardPage.classList.remove('active-page');
  });
}

// Toast Notifications Helper
function showToast(message, type = 'info') {
  toastMessage.textContent = message;
  toastNotification.className = `toast-box show ${type}`;
  setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 4000);
}

// Image Drag, Drop, and Select Handlers
function setupImageSelection() {
  // File dialog click
  dropZone.addEventListener('click', async (e) => {
    // Avoid double trigger if clicking remove button
    if (e.target === removeImageBtn) return;
    if (currentImagePath) return;

    try {
      const res = await window.elivaAPI.selectImage();
      if (res && res.filePath) {
        handleImageLoaded(res.filePath, res.base64);
      }
    } catch (err) {
      showToast('Failed to open image selector', 'error');
    }
  });

  // Drag and Drop implementation
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    if (currentImagePath) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
      const ext = file.name.split('.').pop().toLowerCase();
      
      if (validExtensions.includes(ext)) {
        const objectUrl = URL.createObjectURL(file);
        handleImageLoaded(file.path, objectUrl);
      } else {
        showToast('Unsupported format. Please drop JPG, PNG, or WEBP.', 'error');
      }
    }
  });

  removeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentImagePath = null;
    imagePreviewImg.src = '';
    previewWrapper.classList.add('hidden');
    dropZonePrompt.classList.remove('hidden');
    showToast('Image removed.');
  });
}

function handleImageLoaded(filePath, previewSrc) {
  currentImagePath = filePath;
  imagePreviewImg.src = previewSrc || filePath;
  previewWrapper.classList.remove('hidden');
  dropZonePrompt.classList.add('hidden');
  showToast('Image uploaded successfully!', 'success');
}

// Gemini Post Generation Handler
function setupPostGeneration() {
  generateBtn.addEventListener('click', async () => {
    const description = postDescInput.value.trim();
    const style = postStyleSelect.value;

    if (!description) {
      showToast('Please enter a description first.', 'error');
      return;
    }

    setGeneratingState(true);

    try {
      const result = await window.elivaAPI.generatePost(description, style);
      
      generatedContent = result.postContent;
      generatedHashtags = result.hashtags;
      
      // Update UI
      generatedPostText.value = generatedContent;
      renderHashtags(generatedHashtags);
      
      // Enable editing and action controls
      generatedPostText.removeAttribute('readonly');
      regenerateBtn.removeAttribute('disabled');
      publishBtn.removeAttribute('disabled');
      
      showToast('LinkedIn post optimized successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Generation failed. Check API key/connection.', 'error');
    } finally {
      setGeneratingState(false);
    }
  });

  // Regenerate/Retry button
  regenerateBtn.addEventListener('click', () => {
    generateBtn.click();
  });

  // Copy Content button
  copyBtn.addEventListener('click', () => {
    const content = getFinalPostText();
    if (!content) return;
    
    navigator.clipboard.writeText(content);
    showToast('Copied content to clipboard!', 'success');
  });

  // Edit / Preview Textarea interaction
  editBtn.addEventListener('click', () => {
    generatedPostText.focus();
  });
}

function setGeneratingState(isGenerating) {
  if (isGenerating) {
    generateBtn.textContent = 'Optimizing post with AI... ⏳';
    generateBtn.setAttribute('disabled', 'true');
  } else {
    generateBtn.textContent = 'Generate LinkedIn Post ⚡';
    generateBtn.removeAttribute('disabled');
  }
}

function renderHashtags(tags) {
  hashtagsContainer.innerHTML = '';
  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'hashtag-chip';
    chip.textContent = tag;
    hashtagsContainer.appendChild(chip);
  });
}

function getFinalPostText() {
  const text = generatedPostText.value.trim();
  if (!text) return '';
  const tagsStr = generatedHashtags.join(' ');
  return text + '\n\n' + tagsStr;
}

// Playwright Posting Actions
function setupPublishing() {
  publishBtn.addEventListener('click', async () => {
    const textContent = getFinalPostText();
    if (!textContent) {
      showToast('No content to publish.', 'error');
      return;
    }

    // Prepare modal
    automationLogs.innerHTML = '';
    automationModal.classList.remove('hidden');
    closeModalBtn.setAttribute('disabled', 'true');
    closeModalBtn.textContent = 'Automating...';

    try {
      const success = await window.elivaAPI.publishPost(textContent, currentImagePath);
      if (success) {
        showToast('Successfully published to LinkedIn!', 'success');
      } else {
        showToast('Posting failed. Check the automation log.', 'error');
      }
    } catch (err) {
      showToast('Automation Error: ' + err.message, 'error');
    } finally {
      closeModalBtn.removeAttribute('disabled');
      closeModalBtn.textContent = 'Close Console';
    }
  });

  closeModalBtn.addEventListener('click', () => {
    automationModal.classList.add('hidden');
  });
}

// Log streaming from Main Process
function setupAutomationLogger() {
  window.elivaAPI.onAutomationLog((log) => {
    const line = document.createElement('div');
    line.className = `console-line ${log.status}`;
    
    // Timestamp
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${log.message}`;
    
    automationLogs.appendChild(line);
    automationLogs.scrollTop = automationLogs.scrollHeight;
  });
}

// Settings handlers
function setupSettingsHandlers() {
  // Save Settings
  saveSettingsBtn.addEventListener('click', async () => {
    const apiKey = settingsApiKey.value.trim();
    const style = settingsDefaultStyle.value;

    if (!apiKey) {
      showToast('Gemini API key is required.', 'error');
      return;
    }

    try {
      currentConfig = await window.elivaAPI.saveConfig({
        geminiApiKey: apiKey,
        defaultPostStyle: style
      });
      postStyleSelect.value = currentConfig.defaultPostStyle;
      showToast('Settings saved successfully.', 'success');
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'error');
    }
  });

  // Verify / Setup session
  const verifySession = async () => {
    automationLogs.innerHTML = '';
    automationModal.classList.remove('hidden');
    closeModalBtn.setAttribute('disabled', 'true');
    closeModalBtn.textContent = 'Verifying Session...';

    try {
      const active = await window.elivaAPI.checkSession();
      updateStatusDisplay(active);
      if (active) {
        showToast('LinkedIn Session is ACTIVE.', 'success');
      } else {
        showToast('LinkedIn Session is INACTIVE. Please sign in.', 'error');
      }
    } catch (err) {
      showToast('Session check failed: ' + err.message, 'error');
    } finally {
      closeModalBtn.removeAttribute('disabled');
      closeModalBtn.textContent = 'Close Console';
    }
  };

  checkSessionBtn.addEventListener('click', verifySession);
  verifySessionQuickBtn.addEventListener('click', verifySession);

  // Open visible browser without timeout session manager
  const openBrowserSession = async () => {
    automationLogs.innerHTML = '';
    automationModal.classList.remove('hidden');
    closeModalBtn.setAttribute('disabled', 'true');
    closeModalBtn.textContent = 'Session Running...';

    try {
      await window.elivaAPI.launchBrowserSession();
      showToast('Browser session ended.', 'info');
      // Do a quick, silent check on session status after closing the browser
      const active = await window.elivaAPI.checkSession();
      updateStatusDisplay(active);
    } catch (err) {
      showToast('Failed to start browser: ' + err.message, 'error');
    } finally {
      closeModalBtn.removeAttribute('disabled');
      closeModalBtn.textContent = 'Close Console';
    }
  };

  launchBrowserQuickBtn.addEventListener('click', openBrowserSession);
  settingsLaunchBrowserBtn.addEventListener('click', openBrowserSession);
}

function updateStatusDisplay(isActive) {
  if (isActive) {
    statusBadge.className = 'status-indicator success';
    statusBadge.querySelector('.indicator-text').textContent = 'LinkedIn Session Active';
  } else {
    statusBadge.className = 'status-indicator error';
    statusBadge.querySelector('.indicator-text').textContent = 'Session Inactive';
  }
}
