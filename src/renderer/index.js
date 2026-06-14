// ── Global State ────────────────────────────────────────────
let currentMediaFiles = []; // [{ filePath, previewSrc, type: 'image'|'video' }]
let currentConfig    = null;

// ── DOM References ───────────────────────────────────────────
const tabDashboardBtn    = document.getElementById('tab-dashboard-btn');
const tabSettingsBtn     = document.getElementById('tab-settings-btn');
const dashboardPage      = document.getElementById('dashboard-page');
const settingsPage       = document.getElementById('settings-page');

const dropZone           = document.getElementById('drop-zone');
const dropZonePrompt     = document.getElementById('drop-zone-prompt');
const mediaGridWrapper   = document.getElementById('media-grid-wrapper');
const mediaGrid          = document.getElementById('media-grid');
const addMoreMediaBtn    = document.getElementById('add-more-media-btn');
const clearAllMediaBtn   = document.getElementById('clear-all-media-btn');

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
  setupMediaSelection();
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
  sessionPill.className = `session-pill session-${state}`;
  const labels = { verified: 'Session verified', inactive: 'Session not verified', unknown: 'Session not verified' };
  sessionLabel.textContent = labels[state] || 'Session not verified';
}

// ── Media State Helpers ───────────────────────────────────────
function refreshMediaGrid() {
  mediaGrid.innerHTML = '';

  if (currentMediaFiles.length === 0) {
    mediaGridWrapper.classList.add('hidden');
    dropZonePrompt.classList.remove('hidden');
    return;
  }

  dropZonePrompt.classList.add('hidden');
  mediaGridWrapper.classList.remove('hidden');

  currentMediaFiles.forEach((file, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'media-thumb';

    if (file.type === 'video') {
      const video = document.createElement('video');
      video.src = `file://${file.filePath}`;
      video.muted = true;
      video.preload = 'metadata';
      // Seek to first frame for thumbnail
      video.addEventListener('loadedmetadata', () => { video.currentTime = 0.1; });
      thumb.appendChild(video);

      const badge = document.createElement('span');
      badge.className = 'video-badge';
      badge.textContent = 'VIDEO';
      thumb.appendChild(badge);
    } else {
      const img = document.createElement('img');
      img.src = file.previewSrc || `file://${file.filePath}`;
      img.alt = `Media ${index + 1}`;
      thumb.appendChild(img);
    }

    // Remove button (appears on hover)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-thumb-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentMediaFiles.splice(index, 1);
      refreshMediaGrid();
      showToast('File removed.');
    });
    thumb.appendChild(removeBtn);

    mediaGrid.appendChild(thumb);
  });
}

function addMediaFiles(files) {
  // files: array of { filePath, base64, type }
  files.forEach(f => {
    // Avoid duplicates by path
    if (!currentMediaFiles.find(m => m.filePath === f.filePath)) {
      currentMediaFiles.push({
        filePath: f.filePath,
        previewSrc: f.base64 || null,
        type: f.type
      });
    }
  });
  refreshMediaGrid();
}

// ── Media Selection ───────────────────────────────────────────
function setupMediaSelection() {
  // Click anywhere on drop zone (when empty) to open picker
  dropZone.addEventListener('click', async (e) => {
    // Only trigger if clicking empty state (not the grid actions)
    if (!dropZonePrompt.classList.contains('hidden')) {
      await openMediaPicker();
    }
  });

  // "Add More" button
  addMoreMediaBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await openMediaPicker();
  });

  // "Clear All" button
  clearAllMediaBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentMediaFiles = [];
    refreshMediaGrid();
    showToast('All media cleared.');
  });

  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files);
    const VALID = ['jpg','jpeg','png','webp','gif','mp4','mov','avi','mkv','webm'];
    const VIDEO_EXTS = new Set(['mp4','mov','avi','mkv','webm']);

    const mapped = files
      .filter(f => VALID.includes(f.name.split('.').pop().toLowerCase()))
      .map(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        const isVideo = VIDEO_EXTS.has(ext);
        return {
          filePath: f.path,
          previewSrc: isVideo ? null : URL.createObjectURL(f),
          type: isVideo ? 'video' : 'image'
        };
      });

    if (mapped.length > 0) {
      mapped.forEach(m => {
        if (!currentMediaFiles.find(x => x.filePath === m.filePath)) {
          currentMediaFiles.push(m);
        }
      });
      refreshMediaGrid();
      showToast(`${mapped.length} file(s) added.`, 'success');
    } else {
      showToast('No supported files found. Use JPG, PNG, MP4, MOV, etc.', 'error');
    }
  });
}

async function openMediaPicker() {
  try {
    const results = await window.elivaAPI.selectMedia();
    if (results && results.length > 0) {
      addMediaFiles(results);
      showToast(`${results.length} file(s) added.`, 'success');
    }
  } catch (err) {
    showToast('Failed to open media picker.', 'error');
  }
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

      // Merge hashtags inline
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
  generateBtn.textContent = isGenerating ? 'Generating with AI...' : 'Generate LinkedIn Post';
  isGenerating ? generateBtn.setAttribute('disabled', 'true') : generateBtn.removeAttribute('disabled');
}

// ── Publishing ───────────────────────────────────────────────
function setupPublishing() {
  publishBtn.addEventListener('click', async () => {
    const textContent = generatedPostText.value.trim();
    if (!textContent) {
      showToast('No content to publish.', 'error');
      return;
    }

    // Collect file paths from currentMediaFiles
    const mediaPaths = currentMediaFiles.map(f => f.filePath);

    automationLogs.innerHTML = '';
    automationModal.classList.remove('hidden');
    closeModalBtn.setAttribute('disabled', 'true');
    closeModalBtn.textContent = 'Automating...';

    try {
      const success = await window.elivaAPI.publishPost(textContent, mediaPaths);
      showToast(success ? 'Published to LinkedIn successfully.' : 'Posting failed. Check the log.', success ? 'success' : 'error');
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
    if (!apiKey) { showToast('A Gemini API key is required.', 'error'); return; }

    try {
      currentConfig = await window.elivaAPI.saveConfig({ geminiApiKey: apiKey, defaultPostStyle: style });
      postStyleSelect.value = currentConfig.defaultPostStyle;
      showToast('Settings saved.', 'success');
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error');
    }
  });

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
