import { chromium, BrowserContext, Page } from 'playwright';
import { loadConfig } from './config';

export interface AutomationLog {
  status: 'info' | 'success' | 'error';
  message: string;
}

type LogCallback = (log: AutomationLog) => void;

export async function checkLinkedInSession(
  onLog: LogCallback
): Promise<boolean> {
  const config = loadConfig();
  const profileDir = config.linkedinProfileDir;

  onLog({ status: 'info', message: 'Launching Chromium in visible mode to check session...' });
  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: ['--start-maximized'],
      viewport: null
    });

    const page = await context.newPage();
    onLog({ status: 'info', message: 'Navigating to LinkedIn Feed...' });
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });

    // Wait a bit to check if we are logged in or redirected to login
    await page.waitForTimeout(4000);

    const url = page.url();
    if (url.includes('/feed') && (await page.$('.global-nav'))) {
      onLog({ status: 'success', message: 'Active session detected. You are already logged in!' });
      await context.close();
      return true;
    }

    onLog({ status: 'info', message: 'No active session. Directing to LinkedIn login page...' });
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    onLog({ status: 'info', message: 'Please log in manually in the browser window within 5 minutes.' });

    // Wait for the user to log in manually and land on the feed page
    try {
      await page.waitForURL('**/feed**', { timeout: 300000 });
      await page.waitForSelector('.global-nav', { timeout: 30000 });
      onLog({ status: 'success', message: 'Login detected! Saving session...' });
      await page.waitForTimeout(3000); // Give it a moment to write cookies
      await context.close();
      return true;
    } catch (e) {
      onLog({ status: 'error', message: 'Login timed out or window was closed.' });
      await context.close();
      return false;
    }
  } catch (err: any) {
    onLog({ status: 'error', message: `Automation Error: ${err.message || err}` });
    if (context) {
      try {
        await context.close();
      } catch {}
    }
    return false;
  }
}

export async function publishLinkedInPost(
  postContent: string,
  imagePath: string | null,
  onLog: LogCallback
): Promise<boolean> {
  const config = loadConfig();
  const profileDir = config.linkedinProfileDir;

  onLog({ status: 'info', message: 'Launching visible Chromium session to publish post...' });
  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: ['--start-maximized'],
      viewport: null
    });

    const page = await context.newPage();
    onLog({ status: 'info', message: 'Navigating to LinkedIn feed...' });
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });

    // Check login
    await page.waitForTimeout(4000);
    const url = page.url();
    if (!url.includes('/feed') || !(await page.$('.global-nav'))) {
      onLog({ status: 'error', message: 'LinkedIn session is not active. Please authenticate via settings first!' });
      await context.close();
      return false;
    }

    onLog({ status: 'info', message: 'Opening post creator modal...' });
    
    // Click the trigger/button to start a post
    // Selection can match "Start a post" text or specific selectors
    const startPostSelector = 'button.share-box-feed-entry__trigger, button.artdeco-button--muted.share-box-feed-entry__trigger, button:has-text("Start a post")';
    await page.waitForSelector(startPostSelector, { timeout: 10000 });
    await page.click(startPostSelector);
    onLog({ status: 'info', message: 'Post composer modal opened.' });

    // Wait for the modal editor
    const editorSelector = 'div.ql-editor, div[role="textbox"][aria-label="Editor"]';
    await page.waitForSelector(editorSelector, { timeout: 10000 });

    if (imagePath) {
      onLog({ status: 'info', message: 'Adding image upload...' });
      
      // Click the media upload button
      // On LinkedIn desktop, it is typically a button with aria-label containing "Add media" or "Add a photo"
      // or button with class containing share-promoted-detour-button
      const mediaBtnSelector = 'button[aria-label="Add media"], button[aria-label="Add a photo"], button.share-promoted-detour-button';
      await page.waitForSelector(mediaBtnSelector, { timeout: 5000 });
      
      // We will set up file chooser trigger
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click(mediaBtnSelector)
      ]);
      
      onLog({ status: 'info', message: `Uploading file: ${imagePath}` });
      await fileChooser.setFiles(imagePath);

      onLog({ status: 'info', message: 'Waiting for media editor modal and clicking Next...' });
      // LinkedIn shows a preview editor with a "Next" button (sometimes "Done" or "Apply")
      const nextBtnSelector = 'div.share-box-footer button:has-text("Next"), div.share-media-editor__footer button:has-text("Next"), button.share-box-footer__primary-btn, button:has-text("Done")';
      await page.waitForSelector(nextBtnSelector, { timeout: 15000 });
      await page.click(nextBtnSelector);
      
      // Give it a brief moment to close media modal and return to compose modal
      await page.waitForTimeout(2000);
    }

    // Now write the text content into editor
    onLog({ status: 'info', message: 'Inserting post text...' });
    await page.focus(editorSelector);
    
    // Type/insert text using playwright keyboard simulation for compatibility with contenteditable listener
    await page.keyboard.insertText(postContent);
    await page.waitForTimeout(1000);

    onLog({ status: 'info', message: 'Publishing post to LinkedIn...' });
    // Click the "Post" button
    const postButtonSelector = 'button.share-actions__primary-action, button:has-text("Post"), .share-box_actions button';
    await page.waitForSelector(postButtonSelector, { timeout: 5000 });
    
    // Ensure the button is enabled before clicking
    await page.click(postButtonSelector);

    // Wait for successful publishing confirmation (e.g., toast or modal closing)
    onLog({ status: 'info', message: 'Waiting for publish verification...' });
    await page.waitForTimeout(5000);

    onLog({ status: 'success', message: 'Post successfully published!' });
    await context.close();
    return true;
  } catch (err: any) {
    onLog({ status: 'error', message: `Failed to publish post: ${err.message || err}` });
    if (context) {
      try {
        await context.close();
      } catch {}
    }
    return false;
  }
}
