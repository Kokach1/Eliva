import { chromium, BrowserContext, Page } from 'playwright';
import { loadConfig } from './config';

export interface AutomationLog {
  status: 'info' | 'success' | 'error';
  message: string;
}

type LogCallback = (log: AutomationLog) => void;

// ---------------------------------------------------------------------------
// Session Check
// ---------------------------------------------------------------------------
export async function checkLinkedInSession(
  onLog: LogCallback
): Promise<boolean> {
  const config = loadConfig();
  const profileDir = config.linkedinProfileDir;

  onLog({ status: 'info', message: 'Launching Chromium to verify LinkedIn session...' });
  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: ['--start-maximized'],
      viewport: null
    });

    const page = await context.newPage();
    onLog({ status: 'info', message: 'Navigating to LinkedIn Feed...' });
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'load', timeout: 30000 });

    // Give LinkedIn 3 seconds to settle any redirect
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log(`[checkLinkedInSession] Final URL: ${url}`);

    if (url.includes('/feed')) {
      onLog({ status: 'success', message: 'Session is ACTIVE — you are logged in to LinkedIn!' });
      await context.close();
      return true;
    }

    // Not logged in — open login page and wait for manual login
    onLog({ status: 'info', message: 'Session not active. Opening LinkedIn login page...' });
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'load' });
    onLog({ status: 'info', message: 'Please log in manually in the browser. Waiting up to 5 minutes...' });

    try {
      await page.waitForURL('**/feed**', { timeout: 300000 });
      await page.waitForTimeout(3000); // let cookies settle
      onLog({ status: 'success', message: 'Login successful! Session saved to profile.' });
      await context.close();
      return true;
    } catch (_e) {
      onLog({ status: 'error', message: 'Login timed out or window was closed.' });
      await context.close();
      return false;
    }

  } catch (err: any) {
    onLog({ status: 'error', message: `Session check error: ${err.message || err}` });
    if (context) { try { await context.close(); } catch {} }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Publish Post
// ---------------------------------------------------------------------------
export async function publishLinkedInPost(
  postContent: string,
  imagePath: string | null,
  onLog: LogCallback
): Promise<boolean> {
  const config = loadConfig();
  const profileDir = config.linkedinProfileDir;

  onLog({ status: 'info', message: 'Launching visible Chromium for LinkedIn posting...' });
  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: ['--start-maximized'],
      viewport: null
    });

    const page = await context.newPage();
    onLog({ status: 'info', message: 'Opening LinkedIn feed...' });
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log(`[publishLinkedInPost] Final URL: ${url}`);

    if (!url.includes('/feed')) {
      onLog({ status: 'error', message: `Not on LinkedIn feed (URL: ${url}). Please authenticate first via Settings → Test LinkedIn Session.` });
      await context.close();
      return false;
    }

    onLog({ status: 'success', message: 'Logged in! Starting post creation...' });

    if (imagePath) {
      // ── Path A: Image post ────────────────────────────────────────────────
      // STEP 1: Click the "Photo" button → This opens the "Editor" modal (empty)
      onLog({ status: 'info', message: 'Clicking the Photo button — opening Editor modal...' });
      const photoBtn = await page.waitForSelector(
        '[data-view-name="share-sharebox-bottom-bar-image"]',
        { timeout: 15000 }
      );
      await photoBtn.click();

      // STEP 2: Wait for the empty Editor modal ("Select files to begin")
      // Then click "Upload from computer" to trigger the file chooser
      onLog({ status: 'info', message: 'Editor modal opened. Clicking "Upload from computer"...' });
      const uploadBtn = await page.waitForSelector(
        'button:has-text("Upload from computer"), button:has-text("Upload"), label:has-text("Upload")',
        { timeout: 10000 }
      );
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        uploadBtn.click()
      ]);

      // STEP 3: Set the actual file — image preview will appear in the Editor
      onLog({ status: 'info', message: `Uploading image: ${imagePath}` });
      await fileChooser.setFiles(imagePath);

      // Wait for image preview to render inside the Editor
      onLog({ status: 'info', message: 'Waiting for image preview to render...' });
      await page.waitForTimeout(3000);

      // STEP 4: Click "Next" to proceed to the post text composer
      onLog({ status: 'info', message: 'Clicking Next to open post text editor...' });
      const nextBtn = await page.waitForSelector(
        'button:has-text("Next")',
        { timeout: 20000 }
      );
      await nextBtn.click();
      onLog({ status: 'info', message: 'Next clicked — post text composer is now open.' });
      await page.waitForTimeout(2500);

    } else {
      // ── Path B: Text-only post ────────────────────────────────────────────
      onLog({ status: 'info', message: 'Opening post composer (text only)...' });
      const startBtn = await page.waitForSelector(
        '[data-view-name="share-sharebox-focus"]',
        { timeout: 15000 }
      );
      await startBtn.click();
      await page.waitForTimeout(2000);
    }

    // ── Type text into the editor ─────────────────────────────────────────
    onLog({ status: 'info', message: 'Typing post content into editor...' });
    const editor = await page.waitForSelector(
      'div[contenteditable="true"], div.ql-editor, div[role="textbox"]',
      { timeout: 15000 }
    );
    await editor.click();
    await page.keyboard.insertText(postContent);
    await page.waitForTimeout(1000);

    // ── Click the Post button ─────────────────────────────────────────────
    onLog({ status: 'info', message: 'Clicking the Post button...' });
    const postBtn = await page.waitForSelector(
      'button.share-actions__primary-action, button[data-control-name="share.post"], button:has-text("Post"):not(:has-text("Next")):not(:has-text("Photo")):not(:has-text("Video"))',
      { timeout: 10000 }
    );
    await postBtn.click();

    // Wait for the modal to close = post submitted
    await page.waitForTimeout(5000);
    onLog({ status: 'success', message: '✅ Post published to LinkedIn successfully!' });
    await context.close();
    return true;

  } catch (err: any) {
    onLog({ status: 'error', message: `Posting failed: ${err.message || err}` });
    if (context) { try { await context.close(); } catch {} }
    return false;
  }
}

// ---------------------------------------------------------------------------
// No-Timeout Browser Session
// ---------------------------------------------------------------------------
export async function launchLinkedInBrowserSession(
  onLog: LogCallback
): Promise<void> {
  const config = loadConfig();
  const profileDir = config.linkedinProfileDir;

  onLog({ status: 'info', message: 'Launching Chromium with NO TIME LIMIT...' });
  onLog({ status: 'info', message: 'Close the browser window manually when done.' });
  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: ['--start-maximized'],
      viewport: null
    });

    const page = await context.newPage();
    await page.goto('https://www.linkedin.com/', { waitUntil: 'load' });

    await new Promise<void>((resolve) => {
      if (context) {
        context.on('close', () => {
          onLog({ status: 'success', message: 'Browser session closed by user.' });
          resolve();
        });
      } else {
        resolve();
      }
    });

  } catch (err: any) {
    onLog({ status: 'error', message: `Browser session error: ${err.message || err}` });
    if (context) { try { await context.close(); } catch {} }
  }
}
