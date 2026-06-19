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
  mediaPaths: string[],          // array: images and/or videos
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
      onLog({ status: 'error', message: `Not on LinkedIn feed (URL: ${url}). Please authenticate first via Settings.` });
      await context.close();
      return false;
    }

    onLog({ status: 'success', message: 'Logged in! Starting post creation...' });

    const hasMedia = mediaPaths && mediaPaths.length > 0;

    if (hasMedia) {
      // ── Path A: Media post (images and/or video) ──────────────────────────
      onLog({ status: 'info', message: `Media detected: ${mediaPaths.length} file(s). Locating Photo/Media button...` });

      let photoBtn = null;
      const photoSelectors = [
        '[data-view-name="share-sharebox-bottom-bar-image"]',
        'div[role="button"]:has-text("Photo")',
        'div[role="button"]:has-text("Media")',
        'button:has-text("Photo")',
        'button:has-text("Media")',
        'button[aria-label*="photo" i]',
        'button[aria-label*="media" i]',
        '[id="image-medium"]',
        '[data-view-name="share-sharebox-bottom-bar-video"]',
        'text=Photo',
        'text=Media'
      ];

      // Try to find the button directly on the feed page first
      for (const selector of photoSelectors) {
        try {
          photoBtn = await page.waitForSelector(selector, { timeout: 1500, state: 'visible' });
          if (photoBtn) {
            onLog({ status: 'info', message: `Found media button on feed: ${selector}` });
            break;
          }
        } catch {}
      }

      // If not found, open the composer modal first, then find the photo button inside it
      if (!photoBtn) {
        onLog({ status: 'info', message: 'Media button not found directly on feed. Opening post composer first...' });
        const startSelectors = [
          '[data-view-name="share-sharebox-focus"]',
          '[aria-label="Start a post"]',
          'div[role="button"]:has-text("Start a post")',
          'button:has-text("Start a post")',
          'button.share-box-feed-entry__trigger',
          'text=Start a post'
        ];
        
        let startBtn = null;
        for (const selector of startSelectors) {
          try {
            startBtn = await page.waitForSelector(selector, { timeout: 2000, state: 'visible' });
            if (startBtn) {
              await startBtn.click();
              onLog({ status: 'info', message: 'Opened post composer modal.' });
              await page.waitForTimeout(2000);
              break;
            }
          } catch {}
        }

        // Now search for the photo/media button inside the opened modal
        for (const selector of photoSelectors) {
          try {
            photoBtn = await page.waitForSelector(selector, { timeout: 2000, state: 'visible' });
            if (photoBtn) {
              onLog({ status: 'info', message: `Found media button inside modal: ${selector}` });
              break;
            }
          } catch {}
        }
      }

      if (!photoBtn) {
        throw new Error('Could not locate the Photo/Media button on the feed or inside the post composer.');
      }

      await photoBtn.click();

      // Wait for empty Editor modal and click "Upload from computer"
      onLog({ status: 'info', message: 'Editor modal opened. Preparing file upload...' });
      
      let uploaded = false;
      // Try to upload directly via input[type="file"] if present
      try {
        const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 2000 });
        if (fileInput) {
          onLog({ status: 'info', message: `Uploading ${mediaPaths.length} file(s) directly...` });
          await fileInput.setInputFiles(mediaPaths);
          uploaded = true;
        }
      } catch {}

      if (!uploaded) {
        const uploadBtn = await page.waitForSelector(
          'button:has-text("Upload from computer"), button:has-text("Upload"), label:has-text("Upload"), button:has-text("Select files to begin")',
          { timeout: 10000 }
        );

        // Upload ALL files at once via the file chooser
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 10000 }),
          uploadBtn.click()
        ]);

        onLog({ status: 'info', message: `Uploading ${mediaPaths.length} file(s) via file chooser...` });
        await fileChooser.setFiles(mediaPaths);
      }

      // Wait for LinkedIn to process the uploads (videos take longer)
      const hasVideo = mediaPaths.some(p => /\.(mp4|mov|avi|mkv|webm)$/i.test(p));
      const waitMs = hasVideo ? 8000 : 3000;
      onLog({ status: 'info', message: `Waiting for media to process (${hasVideo ? 'video detected' : 'images'})...` });
      await page.waitForTimeout(waitMs);

      // Click "Next" — LinkedIn's primary action footer button
      // Strategy: look for artdeco-button--primary class (LinkedIn's design system), excluding vjs player buttons
      onLog({ status: 'info', message: 'Clicking Next to go to caption editor...' });

      // Try multiple specific selectors in order - most specific first
      const nextSelectors = [
        'button.share-box-footer__primary-btn.artdeco-button--primary',
        'button.artdeco-button--primary[aria-label="Next"]',
        'button.artdeco-button--primary:has-text("Next")',
        'button.artdeco-button--primary:not(.vjs-done-button)',
      ];

      let nextClicked = false;
      for (const sel of nextSelectors) {
        try {
          const btn = await page.waitForSelector(sel, { timeout: 5000, state: 'visible' });
          if (btn) {
            await btn.click();
            nextClicked = true;
            onLog({ status: 'info', message: `Clicked Next button via: ${sel}` });
            break;
          }
        } catch {}
      }

      if (!nextClicked) {
        // Last resort: use page.locator to find the footer primary button by text "Next" excluding vjs
        const fallbackBtn = page.locator('button:has-text("Next"):not(.vjs-done-button)').first();
        const isVisible = await fallbackBtn.isVisible();
        if (isVisible) {
          await fallbackBtn.click();
          nextClicked = true;
          onLog({ status: 'info', message: 'Clicked Next via fallback locator.' });
        }
      }

      if (!nextClicked) {
        throw new Error('Could not find the Next button to proceed to post caption editor.');
      }

      onLog({ status: 'info', message: 'Next clicked — post caption editor is open.' });
      await page.waitForTimeout(2500);

    } else {
      // ── Path B: Text-only post ────────────────────────────────────────────
      onLog({ status: 'info', message: 'Opening post composer (text only)...' });
      const startSelectors = [
        '[data-view-name="share-sharebox-focus"]',
        '[aria-label="Start a post"]',
        'div[role="button"]:has-text("Start a post")',
        'button:has-text("Start a post")',
        'button.share-box-feed-entry__trigger',
        'text=Start a post'
      ];
      
      let startBtn = null;
      for (const selector of startSelectors) {
        try {
          startBtn = await page.waitForSelector(selector, { timeout: 2000, state: 'visible' });
          if (startBtn) {
            await startBtn.click();
            break;
          }
        } catch {}
      }

      if (!startBtn) {
        throw new Error('Could not locate the Start a Post button on the LinkedIn feed.');
      }
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
      'button.share-actions__primary-action',
      { timeout: 10000, state: 'visible' }
    );
    await postBtn.click();

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
