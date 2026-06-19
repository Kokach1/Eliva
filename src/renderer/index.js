// ── Global State ────────────────────────────────────────────
let currentMediaFiles = []; // [{ filePath, previewSrc, type: 'image'|'video' }]
let currentConfig    = null;

// ── DOM References ───────────────────────────────────────────
const tabDashboardBtn    = document.getElementById('tab-dashboard-btn');
const tabHistoryBtn      = document.getElementById('tab-history-btn');
const tabSettingsBtn     = document.getElementById('tab-settings-btn');
const dashboardPage      = document.getElementById('dashboard-page');
const historyPage        = document.getElementById('history-page');
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

// Media Fullscreen Preview Modal
const previewModal          = document.getElementById('preview-modal');
const closePreviewBtn       = document.getElementById('close-preview-btn');
const previewMediaContainer = document.getElementById('preview-media-container');

// History Elements
const historyList         = document.getElementById('history-list');
const clearAllHistoryBtn  = document.getElementById('clear-all-history-btn');

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
  setupHistoryHandlers();
  setupFullscreenPreview();
});

// ── Navigation ───────────────────────────────────────────────
function setupNavigation() {
  tabDashboardBtn.addEventListener('click', () => {
    tabDashboardBtn.classList.add('active-tab-btn');
    tabHistoryBtn.classList.remove('active-tab-btn');
    tabSettingsBtn.classList.remove('active-tab-btn');
    dashboardPage.classList.add('active-page');
    historyPage.classList.remove('active-page');
    settingsPage.classList.remove('active-page');
  });

  tabHistoryBtn.addEventListener('click', () => {
    tabHistoryBtn.classList.add('active-tab-btn');
    tabDashboardBtn.classList.remove('active-tab-btn');
    tabSettingsBtn.classList.remove('active-tab-btn');
    historyPage.classList.add('active-page');
    dashboardPage.classList.remove('active-page');
    settingsPage.classList.remove('active-page');
    refreshHistoryList();
  });

  tabSettingsBtn.addEventListener('click', () => {
    tabSettingsBtn.classList.add('active-tab-btn');
    tabDashboardBtn.classList.remove('active-tab-btn');
    tabHistoryBtn.classList.remove('active-tab-btn');
    settingsPage.classList.add('active-page');
    dashboardPage.classList.remove('active-page');
    historyPage.classList.remove('active-page');
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
    thumb.setAttribute('draggable', 'true');

    // Drag events
    thumb.addEventListener('dragstart', (e) => handleDragStart(e, index));
    thumb.addEventListener('dragover', (e) => handleDragOver(e));
    thumb.addEventListener('dragenter', (e) => handleDragEnter(e, index));
    thumb.addEventListener('dragleave', (e) => handleDragLeave(e));
    thumb.addEventListener('drop', (e) => handleDrop(e, index));
    thumb.addEventListener('dragend', (e) => handleDragEnd(e));

    // Full screen preview on click
    thumb.addEventListener('click', (e) => {
      if (e.target.closest('.remove-thumb-btn') || e.target.closest('.reorder-btn')) {
        return;
      }
      openFullscreenPreview(file);
    });

    if (file.type === 'video') {
      const video = document.createElement('video');
      video.src = `file://${file.filePath}`;
      video.muted = true;
      video.preload = 'metadata';
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

    // Reorder buttons (Move Left / Move Right)
    if (index > 0) {
      const leftBtn = document.createElement('button');
      leftBtn.className = 'reorder-btn move-left-btn';
      leftBtn.innerHTML = '‹';
      leftBtn.title = 'Move Left';
      leftBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [moved] = currentMediaFiles.splice(index, 1);
        currentMediaFiles.splice(index - 1, 0, moved);
        refreshMediaGrid();
        showToast('Media reordered.');
      });
      thumb.appendChild(leftBtn);
    }

    if (index < currentMediaFiles.length - 1) {
      const rightBtn = document.createElement('button');
      rightBtn.className = 'reorder-btn move-right-btn';
      rightBtn.innerHTML = '›';
      rightBtn.title = 'Move Right';
      rightBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [moved] = currentMediaFiles.splice(index, 1);
        currentMediaFiles.splice(index + 1, 0, moved);
        refreshMediaGrid();
        showToast('Media reordered.');
      });
      thumb.appendChild(rightBtn);
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

    const description = postDescInput.value.trim();
    const style       = postStyleSelect.value;
    const mediaFiles  = currentMediaFiles.map(f => ({ filePath: f.filePath, type: f.type }));
    const mediaPaths  = currentMediaFiles.map(f => f.filePath);

    automationLogs.innerHTML = '';
    automationModal.classList.remove('hidden');
    closeModalBtn.setAttribute('disabled', 'true');
    closeModalBtn.textContent = 'Automating...';

    // Add to History
    try {
      await window.elivaAPI.addHistory(description, style, textContent, mediaFiles);
    } catch (historyErr) {
      console.error('Failed to save to history:', historyErr);
    }

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

// ── Drag & Drop Reordering ────────────────────────────────────
let draggedIndex = null;

function handleDragStart(e, index) {
  draggedIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.target.classList.add('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  return false;
}

function handleDragEnter(e, index) {
  if (index !== draggedIndex) {
    e.currentTarget.classList.add('drag-over-thumb');
  }
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over-thumb');
}

function handleDrop(e, targetIndex) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over-thumb');

  if (draggedIndex !== null && draggedIndex !== targetIndex) {
    const [moved] = currentMediaFiles.splice(draggedIndex, 1);
    currentMediaFiles.splice(targetIndex, 0, moved);
    refreshMediaGrid();
    showToast('Media reordered.');
  }
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedIndex = null;
}

// ── Fullscreen Media Preview Modal ──────────────────────────
function setupFullscreenPreview() {
  closePreviewBtn.addEventListener('click', () => {
    previewModal.classList.add('hidden');
    previewMediaContainer.innerHTML = '';
  });

  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
      previewModal.classList.add('hidden');
      previewMediaContainer.innerHTML = '';
    }
  });
}

function openFullscreenPreview(file) {
  previewMediaContainer.innerHTML = '';
  if (file.type === 'video') {
    const video = document.createElement('video');
    video.src = `file://${file.filePath}`;
    video.controls = true;
    video.autoplay = true;
    previewMediaContainer.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = file.previewSrc || `file://${file.filePath}`;
    img.alt = 'Fullscreen Preview';
    previewMediaContainer.appendChild(img);
  }
  previewModal.classList.remove('hidden');
}

// ── History Management ────────────────────────────────────────
function setupHistoryHandlers() {
  clearAllHistoryBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all history? This will delete all saved media files.')) {
      try {
        await window.elivaAPI.clearHistory();
        refreshHistoryList();
        showToast('History cleared.', 'success');
      } catch (err) {
        showToast('Failed to clear history: ' + err.message, 'error');
      }
    }
  });
}

async function refreshHistoryList() {
  historyList.innerHTML = '';

  try {
    const items = await window.elivaAPI.loadHistory();

    if (!items || items.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <h3>No History Yet</h3>
          <p>Generate and publish posts on the Dashboard to see them here.</p>
        </div>
      `;
      return;
    }

    items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';

      // Header row
      const headerRow = document.createElement('div');
      headerRow.className = 'history-item-header';

      const meta = document.createElement('div');
      meta.className = 'history-item-meta';

      const dateSp = document.createElement('span');
      dateSp.className = 'history-item-date';
      dateSp.textContent = item.timestamp;
      meta.appendChild(dateSp);

      const styleSp = document.createElement('span');
      styleSp.className = 'history-item-style';
      styleSp.textContent = item.style;
      meta.appendChild(styleSp);

      headerRow.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'history-item-actions';

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'btn btn-secondary btn-sm';
      restoreBtn.textContent = 'Restore to Editor';
      restoreBtn.addEventListener('click', () => {
        restoreHistoryItem(item);
      });
      actions.appendChild(restoreBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Delete this history entry?')) {
          try {
            await window.elivaAPI.deleteHistory(item.id);
            refreshHistoryList();
            showToast('History entry deleted.');
          } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
          }
        }
      });
      actions.appendChild(deleteBtn);

      headerRow.appendChild(actions);
      itemEl.appendChild(headerRow);

      // Prompt/Description
      if (item.description) {
        const promptEl = document.createElement('div');
        promptEl.className = 'history-item-prompt';
        promptEl.textContent = `Prompt: "${item.description}"`;
        itemEl.appendChild(promptEl);
      }

      // Generated content
      const contentEl = document.createElement('div');
      contentEl.className = 'history-item-content';
      contentEl.textContent = item.postContent;
      itemEl.appendChild(contentEl);

      // Media previews
      if (item.media && item.media.length > 0) {
        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'history-item-media';

        item.media.forEach(m => {
          if (m.type === 'video') {
            const videoContainer = document.createElement('div');
            videoContainer.style.position = 'relative';
            videoContainer.style.display = 'inline-block';

            const videoEl = document.createElement('video');
            videoEl.src = `file://${m.savedPath}`;
            videoEl.className = 'history-media-thumb';
            videoEl.muted = true;
            videoEl.preload = 'metadata';
            videoEl.addEventListener('loadedmetadata', () => { videoEl.currentTime = 0.1; });
            videoContainer.appendChild(videoEl);

            const badge = document.createElement('span');
            badge.className = 'video-badge';
            badge.textContent = 'VIDEO';
            badge.style.fontSize = '7px';
            badge.style.padding = '1px 3px';
            badge.style.bottom = '2px';
            badge.style.left = '2px';
            videoContainer.appendChild(badge);

            mediaContainer.appendChild(videoContainer);
          } else {
            const imgEl = document.createElement('img');
            imgEl.className = 'history-media-thumb';
            imgEl.src = m.base64 || `file://${m.savedPath}`;
            imgEl.alt = 'History media';
            mediaContainer.appendChild(imgEl);
          }
        });

        itemEl.appendChild(mediaContainer);
      }

      historyList.appendChild(itemEl);
    });

  } catch (err) {
    showToast('Failed to load history: ' + err.message, 'error');
  }
}

function restoreHistoryItem(item) {
  postDescInput.value = item.description || '';
  postStyleSelect.value = item.style || 'Professional';
  generatedPostText.value = item.postContent || '';

  // Restore current media files pointing to persistent copy paths
  currentMediaFiles = (item.media || []).map(m => ({
    filePath: m.savedPath,
    previewSrc: m.base64 || null,
    type: m.type
  }));

  // Re-enable editor fields
  generatedPostText.removeAttribute('readonly');
  regenerateBtn.removeAttribute('disabled');
  publishBtn.removeAttribute('disabled');

  refreshMediaGrid();

  // Switch to Dashboard
  tabDashboardBtn.click();
  showToast('Post restored to editor!', 'success');
}

