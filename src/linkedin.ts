import { chromium, BrowserContext, Page } from 'playwright';
import { loadConfig } from './config';

export interface AutomationLog {
  status: 'info' | 'success' | 'error';
  message: string;
}

type LogCallback = (log: AutomationLog) => void;

async function verifyLoginState(page: Page): Promise<boolean> {
  // Modern LinkedIn no longer uses .global-nav. 
  // We detect login by checking the URL is /feed AND the share box is present.
  // We also look for login form elements to detect the NOT-logged-in state.
  try {
    await Promise.any([
      // Logged-in indicators: share box or profile icon area
      page.waitForSelector(
        '[data-view-name="share-sharebox-focus"], [data-view-name="share-sharebox-bottom-bar-image"], .global-nav__me-photo, .global-nav',
        { timeout: 15000 }
      ),
      // Logged-out indicators: login form
      page.waitForSelector(
        '#username, input[name="session_key"], form.login__form',
        { timeout: 15000 }
      )
    ]);
  } catch (e) {
    // Timeout — neither appeared, fall through to URL check
  }

  const url = page.url();
  // If URL contains /feed AND the share box (post composer) is present, we are logged in
  const shareBoxPresent = (await page.$('[data-view-name="share-sharebox-focus"]')) !== null;
  const oldNavPresent = (await page.$('.global-nav')) !== null;
  const loggedIn = url.includes('/feed') && (shareBoxPresent || oldNavPresent);

  // Debug log
  console.log(`[verifyLoginState] url=${url}, shareBoxPresent=${shareBoxPresent}, oldNavPresent=${oldNavPresent}, loggedIn=${loggedIn}`);
  return loggedIn;
}

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

    const active = await verifyLoginState(page);
    if (active) {
      onLog({ status: 'success', message: 'Active session detected. You are already logged in!' });
      await context.close();
      return true;
    }

    onLog({ status: 'info', message: 'No active session. Directing to LinkedIn login page...' });
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    onLog({ status: 'info', message: 'Please log in manually in the browser window. Waiting up to 5 minutes...' });

    // Wait for user to log in manually — look for feed URL + sharebox (modern LinkedIn)
    try {
      await page.waitForURL('**/feed**', { timeout: 300000 });
      // Wait for the share box (modern LinkedIn) or old nav
      await Promise.any([
        page.waitForSelector('[data-view-name="share-sharebox-focus"]', { timeout: 30000 }),
        page.waitForSelector('.global-nav', { timeout: 30000 })
      ]);
      onLog({ status: 'success', message: 'Login detected! Session saved.' });
      await page.waitForTimeout(3000); // Let cookies settle
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

    const active = await verifyLoginState(page);
    if (!active) {
      onLog({ status: 'error', message: 'LinkedIn session is not active. Please authenticate via settings first!' });
      await context.close();
      return false;
    }

    onLog({ status: 'info', message: 'Opening post creator modal...' });
    
    let isModalOpened = false;

    if (imagePath) {
      const feedPhotoSelector = '[data-view-name="share-sharebox-bottom-bar-image"], .share-box-feed-entry__trigger[data-control-name="share_media"]';
      onLog({ status: 'info', message: 'Checking for quick Photo button on feed...' });
      const quickPhotoBtn = await page.$(feedPhotoSelector);
      
      if (quickPhotoBtn) {
        onLog({ status: 'info', message: 'Quick Photo button found. Initiating file upload...' });
        try {
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 8000 }),
            quickPhotoBtn.click()
          ]);
          onLog({ status: 'info', message: `Uploading file: ${imagePath}` });
          await fileChooser.setFiles(imagePath);
          
          onLog({ status: 'info', message: 'Waiting for media preview modal and clicking Next...' });
          const nextBtnSelector = 'div.share-box-footer button:has-text("Next"), div.share-media-editor__footer button:has-text("Next"), button.share-box-footer__primary-btn, button:has-text("Done"), button:has-text("Apply")';
          await page.waitForSelector(nextBtnSelector, { timeout: 15000 });
          await page.click(nextBtnSelector);
          
          isModalOpened = true;
          await page.waitForTimeout(2000);
        } catch (e: any) {
          onLog({ status: 'info', message: `Quick photo button failed or timed out: ${e.message || e}. Falling back to standard flow...` });
        }
      }
    }

    if (!isModalOpened) {
      // Standard flow: click "Start a post" first
      const startPostSelector = '[data-view-name="share-sharebox-focus"], button.share-box-feed-entry__trigger, button.artdeco-button--muted.share-box-feed-entry__trigger, button:has-text("Start a post")';
      await page.waitForSelector(startPostSelector, { timeout: 10000 });
      await page.click(startPostSelector);
      onLog({ status: 'info', message: 'Post composer modal opened.' });
      
      if (imagePath) {
        onLog({ status: 'info', message: 'Adding image upload inside modal...' });
        const mediaBtnSelector = 'button[aria-label="Add media"], button[aria-label="Add a photo"], [data-view-name="share-sharebox-bottom-bar-image"], button.share-promoted-detour-button';
        await page.waitForSelector(mediaBtnSelector, { timeout: 10000 });
        
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          page.click(mediaBtnSelector)
        ]);
        
        onLog({ status: 'info', message: `Uploading file: ${imagePath}` });
        await fileChooser.setFiles(imagePath);

        onLog({ status: 'info', message: 'Waiting for media editor modal and clicking Next...' });
        const nextBtnSelector = 'div.share-box-footer button:has-text("Next"), div.share-media-editor__footer button:has-text("Next"), button.share-box-footer__primary-btn, button:has-text("Done"), button:has-text("Apply")';
        await page.waitForSelector(nextBtnSelector, { timeout: 15000 });
        await page.click(nextBtnSelector);
        
        await page.waitForTimeout(2000);
      }
    }

    // Wait for the modal editor text box
    const editorSelector = 'div.ql-editor, div[role="textbox"][aria-label="Editor"], div[role="textbox"]';
    await page.waitForSelector(editorSelector, { timeout: 15000 });

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

export async function launchLinkedInBrowserSession(
  onLog: LogCallback
): Promise<void> {
  const config = loadConfig();
  const profileDir = config.linkedinProfileDir;

  onLog({ status: 'info', message: 'Launching visible Chromium with NO TIMELIMIT...' });
  onLog({ status: 'info', message: 'Close the Chromium browser window manually when finished.' });
  let context: BrowserContext | null = null;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: ['--start-maximized'],
      viewport: null
    });

    const page = await context.newPage();
    onLog({ status: 'info', message: 'Navigating to LinkedIn...' });
    await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded' });

    // Keep context open until the user closes it manually
    await new Promise<void>((resolve) => {
      if (context) {
        context.on('close', () => {
          onLog({ status: 'success', message: 'Browser session closed manually.' });
          resolve();
        });
      } else {
        resolve();
      }
    });

  } catch (err: any) {
    onLog({ status: 'error', message: `Session Launch Error: ${err.message || err}` });
    if (context) {
      try {
        await context.close();
      } catch {}
    }
  }
}
