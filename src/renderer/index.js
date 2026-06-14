// ── Global State ────────────────────────────────────────────
let currentImagePath = null;
let currentConfig    = null;

// ── DOM References ───────────────────────────────────────────
const tabDashboardBtn    = document.getElementById('tab-dashboard-btn');
const tabSettingsBtn     = document.getElementById('tab-settings-btn');
const dashboardPage      = document.getElementById('dashboard-page');
const settingsPage       = document.getElementById('settings-page');

const dropZone           = document.getElementById('drop-zone');
const dropZonePrompt     = document.getElementById('drop-zone-prompt');
const previewWrapper     = document.getElementById('preview-wrapper');
const imagePreviewImg    = document.getElementById('image-preview-img');
const removeImageBtn     = document.getElementById('remove-image-btn');

const postDescInput      = document.getElementById('post-desc-input');
const postStyleSelect    = document.getElementById('post-style-select');
const generateBtn        = document.getElementById('generate-btn');

const editBtn            = document.getElementById('edit-btn');
const copyBtn            = document.getElementById('copy-btn');
const regenerateBtn      = document.getElementById('regenerate-btn');
const generatedPostText  = document.getElementById('generated-post-text');
const publishBtn         = document.getElementById('publish-btn');

// Session pill (header)
const sessionPill        = document.getElementById('session-status-pill');
const sessionLabel       = document.getElementById('session-status-label');

// Settings
const settingsApiKey           = document.getElementById('settings-api-key');
const settingsProfileDir       = document.getElementById('settings-profile-dir');
const settingsDefaultStyle     = document.getElementById('settings-default-style');
const saveSettingsBtn          = document.getElementById('save-settings-btn');
const checkSessionBtn          = document.getElementById('check-session-btn');
const settingsLaunchBrowserBtn = document.getElementById('settings-launch-browser-btn');

// Toast
const toastNotification  = document.getElementById('toast-notification');
const toastMessage       = document.getElementById('toast-message');

// Modal
const automationModal    = document.getElementById('automation-modal');
const automationLogs     = document.getElementById('automation-logs');
const closeModalBtn      = document.getElementById('close-modal-btn');

// ── Initialise ───────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  currentConfig = await window.elivaAPI.loadConfig();

  settingsApiKey.value       = currentConfig.geminiApiKey       || '';
  settingsProfileDir.value   = currentConfig.linkedinProfileDir || '';
  settingsDefaultStyle.value = currentConfig.defaultPostStyle   || 'Professional';
  postStyleSelect.value      = currentConfig.defaultPostStyle   || 'Professional';

  setupNavigation();
  setupImageSelection();
  setupPostGeneration();
  setupPublishing();
  setupSettingsHandlers();
  setupAutomationLogger();
});

// ── Navigation ───────────────────────────────────────────────
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

// ── Toast ────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  toastMessage.textContent = message;
  toastNotification.className = `toast-box show ${type}`;
  setTimeout(() => toastNotification.classList.remove('show'), 4000);
}

// ── Session Pill ─────────────────────────────────────────────
function setSessionPill(state) {
  // state: 'verified' | 'inactive' | 'unknown'
  sessionPill.className = `session-pill session-${state}`;
  const labels = {
    verified: 'Session verified',
    inactive: 'Session not verified',
    unknown:  'Session not verified'
  };
  sessionLabel.textContent = labels[state] || 'Session not verified';
}

// ── Image Selection ──────────────────────────────────────────
function setupImageSelection() {
  dropZone.addEventListener('click', async (e) => {
    if (e.target === removeImageBtn) return;
    if (currentImagePath) return;
    try {
      const res = await window.elivaAPI.selectImage();
      if (res && res.filePath) handleImageLoaded(res.filePath, res.base64);
    } catch {
      showToast('Failed to open image selector', 'error');
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (currentImagePath) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const ext  = file.name.split('.').pop().toLowerCase();
      if (['jpg','jpeg','png','webp'].includes(ext)) {
        handleImageLoaded(file.path, URL.createObjectURL(file));
      } else {
        showToast('Unsupported format. Use JPG, PNG, or WEBP.', 'error');
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
  showToast('Image loaded.', 'success');
}

// ── Post Generation ──────────────────────────────────────────
function setupPostGeneration() {
  generateBtn.addEventListener('click', async () => {
    const description = postDescInput.value.trim();
    const style       = postStyleSelect.value;

    if (!description) {
      showToast('Please enter a description first.', 'error');
      return;
    }

    setGeneratingState(true);

    try {
      const result = await window.elivaAPI.generatePost(description, style);

      // Merge hashtags inline at the end of the post body
      const hashtagsInline = (result.hashtags || []).join(' ');
      const fullPost = hashtagsInline
        ? result.postContent.trimEnd() + '\n\n' + hashtagsInline
        : result.postContent;

      generatedPostText.value = fullPost;
      generatedPostText.removeAttribute('readonly');
      regenerateBtn.removeAttribute('disabled');
      publishBtn.removeAttribute('disabled');

      showToast('Post generated successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Generation failed. Check your API key.', 'error');
    } finally {
      setGeneratingState(false);
    }
  });

  regenerateBtn.addEventListener('click', () => generateBtn.click());

  copyBtn.addEventListener('click', () => {
    const content = generatedPostText.value.trim();
    if (!content) return;
    navigator.clipboard.writeText(content);
    showToast('Copied to clipboard.', 'success');
  });

  editBtn.addEventListener('click', () => generatedPostText.focus());
}

function setGeneratingState(isGenerating) {
  if (isGenerating) {
    generateBtn.textContent = 'Generating with AI...';
    generateBtn.setAttribute('disabled', 'true');
  } else {
    generateBtn.textContent = 'Generate LinkedIn Post';
    generateBtn.removeAttribute('disabled');
  }
}

// ── Publishing ───────────────────────────────────────────────
function setupPublishing() {
  publishBtn.addEventListener('click', async () => {
    const textContent = generatedPostText.value.trim();
    if (!textContent) {
      showToast('No content to publish.', 'error');
      return;
    }

    automationLogs.innerHTML = '';
    automationModal.classList.remove('hidden');
    closeModalBtn.setAttribute('disabled', 'true');
    closeModalBtn.textContent = 'Automating...';

    try {
      const success = await window.elivaAPI.publishPost(textContent, currentImagePath);
      if (success) {
        showToast('Published to LinkedIn successfully.', 'success');
      } else {
        showToast('Posting failed. Check the automation log.', 'error');
      }
    } catch (err) {
      showToast('Automation error: ' + err.message, 'error');
    } finally {
      closeModalBtn.removeAttribute('disabled');
      closeModalBtn.textContent = 'Close Console';
    }
  });

  closeModalBtn.addEventListener('click', () => automationModal.classList.add('hidden'));
}

// ── Automation Log Stream ─────────────────────────────────────
function setupAutomationLogger() {
  window.elivaAPI.onAutomationLog((log) => {
    const line = document.createElement('div');
    line.className = `console-line ${log.status}`;
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${log.message}`;
    automationLogs.appendChild(line);
    automationLogs.scrollTop = automationLogs.scrollHeight;
  });
}

// ── Settings ─────────────────────────────────────────────────
function setupSettingsHandlers() {
  saveSettingsBtn.addEventListener('click', async () => {
    const apiKey = settingsApiKey.value.trim();
    const style  = settingsDefaultStyle.value;

    if (!apiKey) {
      showToast('A Gemini API key is required.', 'error');
      return;
    }

    try {
      currentConfig = await window.elivaAPI.saveConfig({ geminiApiKey: apiKey, defaultPostStyle: style });
      postStyleSelect.value = currentConfig.defaultPostStyle;
      showToast('Settings saved.', 'success');
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    }
  });

  // Verify session
  const verifySession = async () => {
    automationLogs.innerHTML = '';
    automationModal.classList.remove('hidden');
    closeModalBtn.setAttribute('disabled', 'true');
    closeModalBtn.textContent = 'Verifying...';

    try {
      const active = await window.elivaAPI.checkSession();
      setSessionPill(active ? 'verified' : 'inactive');
      showToast(active ? 'LinkedIn session is active.' : 'Session inactive — please sign in.', active ? 'success' : 'error');
    } catch (err) {
      setSessionPill('inactive');
      showToast('Session check failed: ' + err.message, 'error');
    } finally {
      closeModalBtn.removeAttribute('disabled');
      closeModalBtn.textContent = 'Close Console';
    }
  };

  checkSessionBtn.addEventListener('click', verifySession);

  // Open persistent browser session (settings only)
  settingsLaunchBrowserBtn.addEventListener('click', async () => {
    automationLogs.innerHTML = '';
    automationModal.classList.remove('hidden');
    closeModalBtn.setAttribute('disabled', 'true');
    closeModalBtn.textContent = 'Session Running...';

    try {
      await window.elivaAPI.launchBrowserSession();
      showToast('Browser session ended.', 'info');
      const active = await window.elivaAPI.checkSession();
      setSessionPill(active ? 'verified' : 'inactive');
    } catch (err) {
      showToast('Failed to start browser: ' + err.message, 'error');
    } finally {
      closeModalBtn.removeAttribute('disabled');
      closeModalBtn.textContent = 'Close Console';
    }
  });
}
