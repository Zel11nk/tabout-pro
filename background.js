/**
 * background.js — Service Worker for Badge Updates
 *
 * Chrome's "always-on" background script for Tab Out.
 * Its only job: keep the toolbar badge showing the current open tab count.
 *
 * Since we no longer have a server, we query chrome.tabs directly.
 * The badge counts real web tabs (skipping chrome:// and extension pages).
 *
 * Color coding gives a quick at-a-glance health signal:
 *   Green  (#3d7a4a) → 1–10 tabs  (focused, manageable)
 *   Amber  (#b8892e) → 11–20 tabs (getting busy)
 *   Red    (#b35a5a) → 21+ tabs   (time to cull!)
 */

// ─── Badge updater ────────────────────────────────────────────────────────────

/**
 * updateBadge()
 *
 * Counts open real-web tabs and updates the extension's toolbar badge.
 * "Real" tabs = not chrome://, not extension pages, not about:blank.
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});

    // Only count actual web pages — skip browser internals and extension pages
    const count = tabs.filter(t => {
      const url = t.url || '';
      return (
        !url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('about:') &&
        !url.startsWith('edge://') &&
        !url.startsWith('brave://')
      );
    }).length;

    // Don't show "0" — an empty badge is cleaner
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });

    if (count === 0) return;

    // Pick badge color based on workload level
    let color;
    if (count <= 10) {
      color = '#3d7a4a'; // Green — you're in control
    } else if (count <= 20) {
      color = '#b8892e'; // Amber — things are piling up
    } else {
      color = '#b35a5a'; // Red — time to focus and close some tabs
    }

    await chrome.action.setBadgeBackgroundColor({ color });

  } catch {
    // If something goes wrong, clear the badge rather than show stale data
    chrome.action.setBadgeText({ text: '' });
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

// Update badge when the extension is first installed
chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
});

// Update badge when Chrome starts up
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

// Update badge whenever a tab is opened
chrome.tabs.onCreated.addListener(() => {
  updateBadge();
});

// Update badge whenever a tab is closed
chrome.tabs.onRemoved.addListener(() => {
  updateBadge();
});

// Update badge when a tab's URL changes (e.g. navigating to/from chrome://)
chrome.tabs.onUpdated.addListener(() => {
  updateBadge();
});

// ─── Bookmarks API ────────────────────────────────────────────────────────────

/**
 * getBookmarksFromFolder(folderName)
 *
 * Retrieves all bookmarks from a specific folder by name.
 */
function getBookmarksFromFolder(folderName) {
  return new Promise((resolve, reject) => {
    if (!chrome.bookmarks || typeof chrome.bookmarks.search !== 'function') {
      console.warn('[tab-out-bg] Bookmarks API not available');
      resolve([]);
      return;
    }

    chrome.bookmarks.search({ title: folderName }, (results) => {
      if (chrome.runtime.lastError) {
        console.error('[tab-out-bg] Bookmarks search error:', chrome.runtime.lastError.message);
        reject(new Error('Bookmarks API error: ' + chrome.runtime.lastError.message));
        return;
      }
      
      console.log('[tab-out-bg] Found bookmark search results:', results);
      
      const folder = results.find(r => r.title === folderName && r.children);
      if (!folder) {
        console.log('[tab-out-bg] Bookmark folder not found:', folderName);
        resolve([]);
        return;
      }

      chrome.bookmarks.getChildren(folder.id, (children) => {
        if (chrome.runtime.lastError) {
          console.error('[tab-out-bg] Failed to get children:', chrome.runtime.lastError.message);
          reject(new Error('Failed to get children: ' + chrome.runtime.lastError.message));
          return;
        }
        console.log('[tab-out-bg] Found bookmarks:', children.length);
        resolve(children);
      });
    });
  });
}

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[tab-out-bg] Received message:', message);
  
  if (message.action === 'ping') {
    sendResponse({ pong: true });
    return;
  }
  
  if (message.action === 'getBookmarks') {
    getBookmarksFromFolder(message.folderName)
      .then(bookmarks => {
        console.log('[tab-out-bg] Sending response:', { success: true, count: bookmarks.length });
        sendResponse({ success: true, bookmarks });
      })
      .catch(error => {
        console.error('[tab-out-bg] Error processing bookmarks:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicate we will send a response asynchronously
  }
});

// ─── Initial run ─────────────────────────────────────────────────────────────

// Run once immediately when the service worker first loads
updateBadge();
