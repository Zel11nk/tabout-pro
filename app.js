/* ================================================================
   Tab Out - Dashboard App (Pure Extension Edition)

   This file is the brain of the dashboard. Now that the dashboard
   IS the extension page (not inside an iframe), it can call
   chrome.tabs and chrome.storage directly - no postMessage bridge needed.

   What this file does:
   1. Reads open browser tabs directly via chrome.tabs.query()
   2. Groups tabs by domain with a landing pages category
   3. Renders domain cards, banners, and stats
   4. Handles all user actions (close tabs, save for later, focus tab)
   5. Stores "Saved for Later" tabs in chrome.storage.local (no server)
   ================================================================ */

'use strict';


/* ----------------------------------------------------------------
   CHROME TABS - Direct API Access

   Since this page IS the extension's new tab page, it has full
   access to chrome.tabs and chrome.storage. No middleman needed.
   ---------------------------------------------------------------- */

// All open tabs - populated by fetchOpenTabs()
let openTabs = [];

const DEFAULT_APPEARANCE = {
  hasBackgroundImage: false,
  mask: 45,
  palette: 'forest',
  effectsEnabled: true,
};

const MAX_BACKGROUND_IMAGE_SIZE = 20 * 1024 * 1024;
const BACKGROUND_DB_NAME = 'tabOutAppearance';
const BACKGROUND_DB_STORE = 'images';
const BACKGROUND_DB_KEY = 'background';
let currentBackgroundObjectUrl = '';
let currentBackgroundImage = null;
let autoContrastFrame = 0;

const PALETTES = {
  forest: {
    '--ink': '#1a2f1a',
    '--paper': '#f8f9f4',
    '--warm-gray': '#e8e9e2',
    '--muted': '#6b7b5f',
    '--accent-amber': '#2d5a27',
    '--accent-sage': '#4a7c59',
    '--accent-slate': '#5a6b5e',
    '--accent-rose': '#c97b7b',
    '--status-active': '#3d7a4a',
    '--status-cooling': '#8b7355',
    '--status-abandoned': '#a85a5a',
    '--card-bg': 'rgba(var(--bg-mask-rgb), 0.34)',
    '--on-accent': '#ffffff',
    '--shadow': 'rgba(45, 90, 39, 0.06)',
    '--bg-mask-rgb': '248, 249, 244',
  },
  slate: {
    '--ink': '#172330',
    '--paper': '#f6f7f8',
    '--warm-gray': '#e2e6ea',
    '--muted': '#657789',
    '--accent-amber': '#314151',
    '--accent-sage': '#667b8d',
    '--accent-slate': '#536170',
    '--accent-rose': '#9a6f78',
    '--status-active': '#4f7f70',
    '--status-cooling': '#8b7b61',
    '--status-abandoned': '#9a6f78',
    '--card-bg': 'rgba(var(--bg-mask-rgb), 0.34)',
    '--on-accent': '#ffffff',
    '--shadow': 'rgba(23, 35, 48, 0.07)',
    '--bg-mask-rgb': '246, 247, 248',
  },
  dusk: {
    '--ink': '#2f211c',
    '--paper': '#fbf7f2',
    '--warm-gray': '#eadfd6',
    '--muted': '#82695d',
    '--accent-amber': '#684b3f',
    '--accent-sage': '#9b6a57',
    '--accent-slate': '#75645e',
    '--accent-rose': '#a06461',
    '--status-active': '#7b8061',
    '--status-cooling': '#9b7654',
    '--status-abandoned': '#a06461',
    '--card-bg': 'rgba(var(--bg-mask-rgb), 0.34)',
    '--on-accent': '#ffffff',
    '--shadow': 'rgba(104, 75, 63, 0.07)',
    '--bg-mask-rgb': '251, 247, 242',
  },
  ocean: {
    '--ink': '#122f3d',
    '--paper': '#f2f8fa',
    '--warm-gray': '#dce9ed',
    '--muted': '#5f7b86',
    '--accent-amber': '#1d6475',
    '--accent-sage': '#3f8fa0',
    '--accent-slate': '#587782',
    '--accent-rose': '#b06f7c',
    '--status-active': '#3f8a82',
    '--status-cooling': '#8a7858',
    '--status-abandoned': '#b06f7c',
    '--card-bg': 'rgba(var(--bg-mask-rgb), 0.34)',
    '--on-accent': '#ffffff',
    '--shadow': 'rgba(18, 47, 61, 0.07)',
    '--bg-mask-rgb': '242, 248, 250',
  },
  plum: {
    '--ink': '#2d2433',
    '--paper': '#faf6fb',
    '--warm-gray': '#eadfec',
    '--muted': '#79657e',
    '--accent-amber': '#6d4b75',
    '--accent-sage': '#8c6796',
    '--accent-slate': '#6f6277',
    '--accent-rose': '#b3667e',
    '--status-active': '#6f8a68',
    '--status-cooling': '#927250',
    '--status-abandoned': '#b3667e',
    '--card-bg': 'rgba(var(--bg-mask-rgb), 0.34)',
    '--on-accent': '#ffffff',
    '--shadow': 'rgba(45, 36, 51, 0.07)',
    '--bg-mask-rgb': '250, 246, 251',
  },
  graphite: {
    '--ink': '#181b1f',
    '--paper': '#f4f4f2',
    '--warm-gray': '#deded9',
    '--muted': '#696d70',
    '--accent-amber': '#3f464d',
    '--accent-sage': '#68706c',
    '--accent-slate': '#565d64',
    '--accent-rose': '#9b6969',
    '--status-active': '#61766a',
    '--status-cooling': '#7b725f',
    '--status-abandoned': '#9b6969',
    '--card-bg': 'rgba(var(--bg-mask-rgb), 0.34)',
    '--on-accent': '#ffffff',
    '--shadow': 'rgba(24, 27, 31, 0.08)',
    '--bg-mask-rgb': '244, 244, 242',
  },
  mint: {
    '--ink': '#17352f',
    '--paper': '#f4fbf7',
    '--warm-gray': '#dcece3',
    '--muted': '#5d7e71',
    '--accent-amber': '#2f705e',
    '--accent-sage': '#5a9c82',
    '--accent-slate': '#5e7d75',
    '--accent-rose': '#bf7474',
    '--status-active': '#4e9570',
    '--status-cooling': '#8b7b56',
    '--status-abandoned': '#bf7474',
    '--card-bg': 'rgba(var(--bg-mask-rgb), 0.34)',
    '--on-accent': '#ffffff',
    '--shadow': 'rgba(23, 53, 47, 0.06)',
    '--bg-mask-rgb': '244, 251, 247',
  },
  rosewood: {
    '--ink': '#34201f',
    '--paper': '#fcf6f5',
    '--warm-gray': '#ecddda',
    '--muted': '#826664',
    '--accent-amber': '#7a4540',
    '--accent-sage': '#a2685f',
    '--accent-slate': '#776463',
    '--accent-rose': '#bd6b6b',
    '--status-active': '#7f805d',
    '--status-cooling': '#9a744f',
    '--status-abandoned': '#bd6b6b',
    '--card-bg': 'rgba(var(--bg-mask-rgb), 0.34)',
    '--on-accent': '#ffffff',
    '--shadow': 'rgba(52, 32, 31, 0.07)',
    '--bg-mask-rgb': '252, 246, 245',
  },
};

let currentAppearance = { ...DEFAULT_APPEARANCE };
let cursorStarTrailCleanup = null;
let closeSoundContext = null;
let closeSoundBuffer = null;

/**
 * fetchOpenTabs()
 *
 * Reads all currently open browser tabs directly from Chrome.
 * Sets the extensionId flag so we can identify Tab Out's own pages.
 */
async function fetchOpenTabs() {
  try {
    const extensionId = chrome.runtime.id;
    // The new URL for this page is now index.html (not newtab.html)
    const newtabUrl = `chrome-extension://${extensionId}/index.html`;

    const tabs = await chrome.tabs.query({});
    openTabs = tabs.map(t => ({
      id:       t.id,
      url:      t.url,
      title:    t.title,
      windowId: t.windowId,
      active:   t.active,
      // Flag Tab Out's own pages so we can detect duplicate new tabs
      isTabOut: t.url === newtabUrl || t.url === 'chrome://newtab/',
    }));
  } catch {
    // chrome.tabs API unavailable (shouldn't happen in an extension page)
    openTabs = [];
  }
}

/**
 * closeTabsByUrls(urls)
 *
 * Closes all open tabs whose hostname matches any of the given URLs.
 * After closing, re-fetches the tab list to keep our state accurate.
 *
 * Special case: file:// URLs are matched exactly (they have no hostname).
 */
async function closeTabsByUrls(urls) {
  if (!urls || urls.length === 0) return;

  // Separate file:// URLs (exact match) from regular URLs (hostname match)
  const targetHostnames = [];
  const exactUrls = new Set();

  for (const u of urls) {
    if (u.startsWith('file://')) {
      exactUrls.add(u);
    } else {
      try { targetHostnames.push(new URL(u).hostname); }
      catch { /* skip unparseable */ }
    }
  }

  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs
    .filter(tab => {
      const tabUrl = tab.url || '';
      if (tabUrl.startsWith('file://') && exactUrls.has(tabUrl)) return true;
      try {
        const tabHostname = new URL(tabUrl).hostname;
        return tabHostname && targetHostnames.includes(tabHostname);
      } catch { return false; }
    })
    .map(tab => tab.id);

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabsExact(urls)
 *
 * Closes tabs by exact URL match (not hostname). Used for landing pages
 * so closing "Gmail inbox" doesn't also close individual email threads.
 */
async function closeTabsExact(urls) {
  if (!urls || urls.length === 0) return;
  const urlSet = new Set(urls);
  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs.filter(t => urlSet.has(t.url)).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * focusTab(url)
 *
 * Switches Chrome to the tab with the given URL (exact match first,
 * then hostname fallback). Also brings the window to the front.
 */
async function focusTab(url) {
  if (!url) return;
  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();

  // Try exact URL match first
  let matches = allTabs.filter(t => t.url === url);

  // Fall back to hostname match
  if (matches.length === 0) {
    try {
      const targetHost = new URL(url).hostname;
      matches = allTabs.filter(t => {
        try { return new URL(t.url).hostname === targetHost; }
        catch { return false; }
      });
    } catch {}
  }

  if (matches.length === 0) return;

  // Prefer a match in a different window so it actually switches windows
  const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0];
  await chrome.tabs.update(match.id, { active: true });
  await chrome.windows.update(match.windowId, { focused: true });
}

/**
 * closeDuplicateTabs(urls, keepOne)
 *
 * Closes duplicate tabs for the given list of URLs.
 * keepOne=true - keep one copy of each, close the rest.
 * keepOne=false - close all copies.
 */
async function closeDuplicateTabs(urls, keepOne = true) {
  const allTabs = await chrome.tabs.query({});
  const toClose = [];

  for (const url of urls) {
    const matching = allTabs.filter(t => t.url === url);
    if (keepOne) {
      const keep = matching.find(t => t.active) || matching[0];
      for (const tab of matching) {
        if (tab.id !== keep.id) toClose.push(tab.id);
      }
    } else {
      for (const tab of matching) toClose.push(tab.id);
    }
  }

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabOutDupes()
 *
 * Closes all duplicate Tab Out new-tab pages except the current one.
 */
async function closeTabOutDupes() {
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/index.html`;

  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();
  const tabOutTabs = allTabs.filter(t =>
    t.url === newtabUrl || t.url === 'chrome://newtab/'
  );

  if (tabOutTabs.length <= 1) return;

  // Keep the active Tab Out tab in the CURRENT window - that's the one the
  // user is looking at right now. Falls back to any active one, then the first.
  const keep =
    tabOutTabs.find(t => t.active && t.windowId === currentWindow.id) ||
    tabOutTabs.find(t => t.active) ||
    tabOutTabs[0];
  const toClose = tabOutTabs.filter(t => t.id !== keep.id).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}


/* ----------------------------------------------------------------
   SAVED FOR LATER - chrome.storage.local

   Replaces the old server-side SQLite + REST API with Chrome's
   built-in key-value storage. Data persists across browser sessions
   and doesn't require a running server.

   Data shape stored under the "deferred" key:
   [
     {
       id: "1712345678901",          // timestamp-based unique ID
       url: "https://example.com",
       title: "Example Page",
       savedAt: "2026-04-04T10:00:00.000Z",  // ISO date string
       completed: false,             // true = checked off (archived)
       dismissed: false              // true = dismissed without reading
     },
     ...
   ]
   ---------------------------------------------------------------- */

/**
 * saveTabForLater(tab)
 *
 * Saves a single tab to the "Saved for Later" list in chrome.storage.local.
 * @param {{ url: string, title: string }} tab
 */
async function saveTabForLater(tab) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  deferred.push({
    id:        Date.now().toString(),
    url:       tab.url,
    title:     tab.title,
    savedAt:   new Date().toISOString(),
    completed: false,
    dismissed: false,
  });
  await chrome.storage.local.set({ deferred });
}

/**
 * getSavedTabs()
 *
 * Returns all saved tabs from chrome.storage.local.
 * Filters out dismissed items (those are gone for good).
 * Splits into active (not completed) and archived (completed).
 */
async function getSavedTabs() {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const visible = deferred.filter(t => !t.dismissed);
  return {
    active:   visible.filter(t => !t.completed),
    archived: visible.filter(t => t.completed),
  };
}

/**
 * checkOffSavedTab(id)
 *
 * Marks a saved tab as completed (checked off). It moves to the archive.
 */
async function checkOffSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.completed = true;
    tab.completedAt = new Date().toISOString();
    await chrome.storage.local.set({ deferred });
  }
}

/**
 * dismissSavedTab(id)
 *
 * Marks a saved tab as dismissed (removed from all lists).
 */
async function dismissSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.dismissed = true;
    await chrome.storage.local.set({ deferred });
  }
}


/* ----------------------------------------------------------------
   UI HELPERS
   ---------------------------------------------------------------- */

/**
 * playCloseSound()
 *
 * Plays a clean "swoosh" sound when tabs are closed.
 * Built entirely with the Web Audio API - no sound files needed.
 * A filtered noise sweep that descends in pitch, like air moving.
 */
function playCloseSound() {
  if (!areEffectsEnabled()) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = closeSoundContext || (closeSoundContext = new AudioContext());
    const t = ctx.currentTime;

    // Swoosh: shaped white noise through a sweeping bandpass filter
    const duration = 0.25;
    if (!closeSoundBuffer) {
      closeSoundBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const data = closeSoundBuffer.getChannelData(0);

      // Generate noise with a natural envelope (quick attack, smooth decay)
      for (let i = 0; i < data.length; i++) {
        const pos = i / data.length;
        const env = pos < 0.1 ? pos / 0.1 : Math.pow(1 - (pos - 0.1) / 0.9, 1.5);
        data[i] = (Math.random() * 2 - 1) * env;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = closeSoundBuffer;

    // Bandpass filter sweeps from high to low to create the "swoosh" character.
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration);

    // Volume
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    if (ctx.state === 'suspended') ctx.resume();
    source.start(t);
  } catch {
    // Audio not supported - fail silently.
  }
}

/**
 * shootClosingStars(x, y)
 *
 * Releases a denser burst of silver-blue stars from closed content.
 */
function shootClosingStars(x, y) {
  if (!areEffectsEnabled() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let layer = document.querySelector('.cursor-star-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'cursor-star-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }

  const colors = ['#ffffff', '#eef9ff', '#d7f1ff', '#c6e8ff', '#a9d4f6'];
  const particleCount = 11 + Math.floor(Math.random() * 5);

  for (let i = 0; i < particleCount; i++) {
    const star = document.createElement('span');
    const drift = -90 + Math.random() * 180;
    const fall = 48 + Math.random() * 105;
    const rotation = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 380);
    const opacity = 0.8 + Math.random() * 0.2;

    star.className = `cursor-star${Math.random() < 0.34 ? ' is-glint' : ''}`;
    star.style.left = `${x + (Math.random() - 0.5) * 20}px`;
    star.style.top = `${y + (Math.random() - 0.5) * 16}px`;
    star.style.setProperty('--star-size', `${6 + Math.random() * 10}px`);
    star.style.setProperty('--star-kick-x', `${drift * 0.28}px`);
    star.style.setProperty('--star-mid-x', `${drift * 0.58}px`);
    star.style.setProperty('--star-mid-y', `${fall * 0.3}px`);
    star.style.setProperty('--star-drift', `${drift}px`);
    star.style.setProperty('--star-fall', `${fall}px`);
    star.style.setProperty('--star-mid-rotation', `${rotation * 0.45}deg`);
    star.style.setProperty('--star-rotation', `${rotation}deg`);
    star.style.setProperty('--star-duration', `${820 + Math.random() * 520}ms`);
    star.style.setProperty('--star-opacity', String(opacity));
    star.style.setProperty('--star-mid-opacity', String(opacity * 0.84));
    star.style.setProperty('--star-glow', `${4 + Math.random() * 3}px`);
    star.style.setProperty('--star-color', colors[Math.floor(Math.random() * colors.length)]);

    layer.appendChild(star);
    star.addEventListener('animationend', () => star.remove(), { once: true });
  }
}

/**
 * animateCardOut(card)
 *
 * Smoothly removes a mission card: fade + scale down, then stars.
 * After the animation, checks if the grid is now empty.
 */
function animateCardOut(card) {
  if (!card) return;

  if (!areEffectsEnabled()) {
    card.remove();
    checkAndShowEmptyState();
    return;
  }

  const rect = card.getBoundingClientRect();
  shootClosingStars(rect.left + rect.width / 2, rect.top + rect.height / 2);

  card.classList.add('closing');
  setTimeout(() => {
    card.remove();
    checkAndShowEmptyState();
  }, 300);
}

/**
 * showToast(message)
 *
 * Brief pop-up notification at the bottom of the screen.
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

/**
 * checkAndShowEmptyState()
 *
 * Shows a cheerful "Inbox zero" message when all domain cards are gone.
 */
function checkAndShowEmptyState() {
  const missionsEl = document.getElementById('openTabsMissions');
  if (!missionsEl) return;

  const remaining = missionsEl.querySelectorAll('.mission-card:not(.closing)').length;
  if (remaining > 0) return;

  missionsEl.innerHTML = `
    <div class="missions-empty-state">
      <div class="empty-checkmark">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <div class="empty-title">Inbox zero, but for tabs.</div>
      <div class="empty-subtitle">You're free.</div>
    </div>
  `;

  const countEl = document.getElementById('openTabsSectionCount');
  if (countEl) countEl.textContent = '0 domains';
}

/**
 * timeAgo(dateStr)
 *
 * Converts an ISO date string into a human-friendly relative time.
 * "2026-04-04T10:00:00Z" becomes "2 hrs ago" or "yesterday".
 */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const now  = new Date();
  const diffMins  = Math.floor((now - then) / 60000);
  const diffHours = Math.floor((now - then) / 3600000);
  const diffDays  = Math.floor((now - then) / 86400000);

  if (diffMins < 1)   return 'just now';
  if (diffMins < 60)  return diffMins + ' min ago';
  if (diffHours < 24) return diffHours + ' hr' + (diffHours !== 1 ? 's' : '') + ' ago';
  if (diffDays === 1) return 'yesterday';
  return diffDays + ' days ago';
}

/**
 * getTimeDisplay() - "09:41"
 */
function getTimeDisplay() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function renderTimeDisplay() {
  const timeEl = document.getElementById('greeting');
  if (!timeEl) return;

  const time = getTimeDisplay();
  timeEl.textContent = time;
  timeEl.dataset.time = time;
  timeEl.setAttribute('aria-label', time);
}

/**
 * getDateDisplay() - "Friday, April 4, 2026"
 */
function getDateDisplay() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}


/* ----------------------------------------------------------------
   DOMAIN & TITLE CLEANUP HELPERS
   ---------------------------------------------------------------- */

// Map of known hostnames to friendly display names.
const FRIENDLY_DOMAINS = {
  'github.com':           'GitHub',
  'www.github.com':       'GitHub',
  'gist.github.com':      'GitHub Gist',
  'youtube.com':          'YouTube',
  'www.youtube.com':      'YouTube',
  'music.youtube.com':    'YouTube Music',
  'x.com':                'X',
  'www.x.com':            'X',
  'twitter.com':          'X',
  'www.twitter.com':      'X',
  'reddit.com':           'Reddit',
  'www.reddit.com':       'Reddit',
  'old.reddit.com':       'Reddit',
  'substack.com':         'Substack',
  'www.substack.com':     'Substack',
  'medium.com':           'Medium',
  'www.medium.com':       'Medium',
  'linkedin.com':         'LinkedIn',
  'www.linkedin.com':     'LinkedIn',
  'stackoverflow.com':    'Stack Overflow',
  'www.stackoverflow.com':'Stack Overflow',
  'news.ycombinator.com': 'Hacker News',
  'google.com':           'Google',
  'www.google.com':       'Google',
  'mail.google.com':      'Gmail',
  'docs.google.com':      'Google Docs',
  'drive.google.com':     'Google Drive',
  'calendar.google.com':  'Google Calendar',
  'meet.google.com':      'Google Meet',
  'gemini.google.com':    'Gemini',
  'chatgpt.com':          'ChatGPT',
  'www.chatgpt.com':      'ChatGPT',
  'chat.openai.com':      'ChatGPT',
  'claude.ai':            'Claude',
  'www.claude.ai':        'Claude',
  'code.claude.com':      'Claude Code',
  'notion.so':            'Notion',
  'www.notion.so':        'Notion',
  'figma.com':            'Figma',
  'www.figma.com':        'Figma',
  'slack.com':            'Slack',
  'app.slack.com':        'Slack',
  'discord.com':          'Discord',
  'www.discord.com':      'Discord',
  'wikipedia.org':        'Wikipedia',
  'en.wikipedia.org':     'Wikipedia',
  'amazon.com':           'Amazon',
  'www.amazon.com':       'Amazon',
  'netflix.com':          'Netflix',
  'www.netflix.com':      'Netflix',
  'spotify.com':          'Spotify',
  'open.spotify.com':     'Spotify',
  'vercel.com':           'Vercel',
  'www.vercel.com':       'Vercel',
  'npmjs.com':            'npm',
  'www.npmjs.com':        'npm',
  'developer.mozilla.org':'MDN',
  'arxiv.org':            'arXiv',
  'www.arxiv.org':        'arXiv',
  'huggingface.co':       'Hugging Face',
  'www.huggingface.co':   'Hugging Face',
  'producthunt.com':      'Product Hunt',
  'www.producthunt.com':  'Product Hunt',
  'xiaohongshu.com':      'RedNote',
  'www.xiaohongshu.com':  'RedNote',
  'local-files':          'Local Files',
};

function friendlyDomain(hostname) {
  if (!hostname) return '';
  if (FRIENDLY_DOMAINS[hostname]) return FRIENDLY_DOMAINS[hostname];

  if (hostname.endsWith('.substack.com') && hostname !== 'substack.com') {
    return capitalize(hostname.replace('.substack.com', '')) + "'s Substack";
  }
  if (hostname.endsWith('.github.io')) {
    return capitalize(hostname.replace('.github.io', '')) + ' (GitHub Pages)';
  }

  let clean = hostname
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk|co\.uk|co\.jp)$/, '');

  return clean.split('.').map(part => capitalize(part)).join(' ');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function stripTitleNoise(title) {
  if (!title) return '';
  // Strip leading notification count: "(2) Title"
  title = title.replace(/^\(\d+\+?\)\s*/, '');
  // Strip inline counts like "Inbox (16,359)"
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ');
  // Strip email addresses (privacy + cleaner display)
  title = title.replace(/\s*[\-\u2010-\u2015]\s*[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  title = title.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  // Clean X/Twitter format
  title = title.replace(/\s+on X:\s*/, ': ');
  title = title.replace(/\s*\/\s*X\s*$/, '');
  return title.trim();
}

function cleanTitle(title, hostname) {
  if (!title || !hostname) return title || '';

  const friendly = friendlyDomain(hostname);
  const domain   = hostname.replace(/^www\./, '');
  const seps     = [' - ', ' | ', ' \u2014 ', ' · ', ' \u2013 '];

  for (const sep of seps) {
    const idx = title.lastIndexOf(sep);
    if (idx === -1) continue;
    const suffix     = title.slice(idx + sep.length).trim();
    const suffixLow  = suffix.toLowerCase();
    if (
      suffixLow === domain.toLowerCase() ||
      suffixLow === friendly.toLowerCase() ||
      suffixLow === domain.replace(/\.\w+$/, '').toLowerCase() ||
      domain.toLowerCase().includes(suffixLow) ||
      friendly.toLowerCase().includes(suffixLow)
    ) {
      const cleaned = title.slice(0, idx).trim();
      if (cleaned.length >= 5) return cleaned;
    }
  }
  return title;
}

function smartTitle(title, url) {
  if (!url) return title || '';
  let pathname = '', hostname = '';
  try { const u = new URL(url); pathname = u.pathname; hostname = u.hostname; }
  catch { return title || ''; }

  const titleIsUrl = !title || title === url || title.startsWith(hostname) || title.startsWith('http');

  if ((hostname === 'x.com' || hostname === 'twitter.com' || hostname === 'www.x.com') && pathname.includes('/status/')) {
    const username = pathname.split('/')[1];
    if (username) return titleIsUrl ? `Post by @${username}` : title;
  }

  if (hostname === 'github.com' || hostname === 'www.github.com') {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const [owner, repo, ...rest] = parts;
      if (rest[0] === 'issues' && rest[1]) return `${owner}/${repo} Issue #${rest[1]}`;
      if (rest[0] === 'pull'   && rest[1]) return `${owner}/${repo} PR #${rest[1]}`;
      if (rest[0] === 'blob' || rest[0] === 'tree') return `${owner}/${repo} - ${rest.slice(2).join('/')}`;
      if (titleIsUrl) return `${owner}/${repo}`;
    }
  }

  if ((hostname === 'www.youtube.com' || hostname === 'youtube.com') && pathname === '/watch') {
    if (titleIsUrl) return 'YouTube Video';
  }

  if ((hostname === 'www.reddit.com' || hostname === 'reddit.com' || hostname === 'old.reddit.com') && pathname.includes('/comments/')) {
    const parts  = pathname.split('/').filter(Boolean);
    const subIdx = parts.indexOf('r');
    if (subIdx !== -1 && parts[subIdx + 1]) {
      if (titleIsUrl) return `r/${parts[subIdx + 1]} post`;
    }
  }

  return title || url;
}


/* ----------------------------------------------------------------
   Favicon Helper Functions
   ---------------------------------------------------------------- */

// 国内 favicon 服务优先级，按速度排序
const FAVICON_SERVICES = [
  // 1. 首先尝试直接访问网站 favicon
  (domain) => `https://${domain}/favicon.ico`,
  // 2. 使用国内 CDN 提供 favicon 服务
  (domain) => `https://api.icon.kitchen/${domain}.png`,
  // 3. 使用 favicon.im 服务（速度快）
  (domain) => `https://favicon.im/${domain}`,
  // 4. 使用其他备用服务
  (domain) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  // 5. 最后尝试 Google 服务
  (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
];

function getFaviconUrl(pageUrl) {
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) return '';
  // 使用国内优先的 favicon 服务
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '32');
  return url.toString();
}

/* ----------------------------------------------------------------
   SVG ICON STRINGS
   ---------------------------------------------------------------- */
const ICONS = {
  close:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`,
  duplicate: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><rect x="8.5" y="8.5" width="10" height="10" rx="1.5" /><path stroke-linecap="round" stroke-linejoin="round" d="M15.5 8.5V6.75A1.75 1.75 0 0 0 13.75 5h-7A1.75 1.75 0 0 0 5 6.75v7A1.75 1.75 0 0 0 6.75 15.5H8.5" /></svg>`,
  archive: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`,
  focus:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" /></svg>`,
};


/* ----------------------------------------------------------------
   IN-MEMORY STORE FOR OPEN-TAB GROUPS
   ---------------------------------------------------------------- */
let domainGroups = [];


/* ----------------------------------------------------------------
   HELPER: filter out browser-internal pages
   ---------------------------------------------------------------- */

/**
 * getRealTabs()
 *
 * Returns tabs that are real web pages - no chrome:// or extension pages.
 * pages, about:blank, etc.
 */
function getRealTabs() {
  return openTabs.filter(t => {
    const url = t.url || '';
    return (
      !url.startsWith('chrome://') &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('about:') &&
      !url.startsWith('edge://') &&
      !url.startsWith('brave://')
    );
  });
}

/**
 * checkTabOutDupes()
 *
 * Counts how many Tab Out pages are open. If more than 1,
 * shows a banner offering to close the extras.
 */
function checkTabOutDupes() {
  const tabOutTabs = openTabs.filter(t => t.isTabOut);
  const banner  = document.getElementById('tabOutDupeBanner');
  const countEl = document.getElementById('tabOutDupeCount');
  if (!banner) return;

  if (tabOutTabs.length > 1) {
    if (countEl) countEl.textContent = tabOutTabs.length;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}


/* ----------------------------------------------------------------
   OVERFLOW CHIPS ("+N more" expand button in domain cards)
   ---------------------------------------------------------------- */

function buildOverflowChips(hiddenTabs, urlCounts = {}) {
  const hiddenChips = hiddenTabs.map(tab => {
    const label    = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), '');
    const count    = urlCounts[tab.url] || 1;
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = '';
    try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = getFaviconUrl(tab.url);
    return `<div class="page-chip clickable${chipClass}" draggable="true" data-action="focus-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${safeTitle}">
      ${faviconUrl ? `<img class="chip-favicon" src="${faviconUrl}" alt="" data-favicon data-domain="${domain}">` : ''}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="Save for later">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="Close this tab">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="page-chips-overflow" style="display:none">${hiddenChips}</div>
    <div class="page-chip page-chip-overflow clickable" data-action="expand-chips">
      <span class="chip-text">+${hiddenTabs.length} more</span>
    </div>`;
}


/* ----------------------------------------------------------------
   DOMAIN CARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderDomainCard(group, groupIndex)
 *
 * Builds the HTML for one domain group card.
 * group = { domain: string, tabs: [{ url, title, id, windowId, active }] }
 */
function renderDomainCard(group) {
  const tabs      = group.tabs || [];
  const tabCount  = tabs.length;
  const isLanding = group.domain === '__landing-pages__';
  const stableId  = 'domain-' + group.domain.replace(/[^a-z0-9]/g, '-');

  // Count duplicates (exact URL match)
  const urlCounts = {};
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeUrls   = Object.entries(urlCounts).filter(([, c]) => c > 1);
  const hasDupes   = dupeUrls.length > 0;
  const totalExtras = dupeUrls.reduce((s, [, c]) => s + c - 1, 0);

  const tabBadge = `<span class="card-tab-count" aria-label="${tabCount} tab${tabCount !== 1 ? 's' : ''} open">${tabCount}</span>`;

  const dupeUrlsEncoded = dupeUrls.map(([url]) => encodeURIComponent(url)).join(',');

  // Deduplicate for display: show each URL once, with (Nx) badge if duped
  const seen = new Set();
  const uniqueTabs = [];
  for (const tab of tabs) {
    if (!seen.has(tab.url)) { seen.add(tab.url); uniqueTabs.push(tab); }
  }

  const visibleTabs = uniqueTabs.slice(0, 8);
  const extraCount  = uniqueTabs.length - visibleTabs.length;

  const pageChips = visibleTabs.map(tab => {
    let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain);
    // For localhost tabs, prepend port number so you can tell projects apart
    try {
      const parsed = new URL(tab.url);
      if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`;
    } catch {}
    const count    = urlCounts[tab.url];
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = '';
    try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = getFaviconUrl(tab.url);
    return `<div class="page-chip clickable${chipClass}" draggable="true" data-action="focus-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${safeTitle}">
      ${faviconUrl ? `<img class="chip-favicon" src="${faviconUrl}" alt="" data-favicon data-domain="${domain}">` : ''}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="Save for later">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="Close this tab">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('') + (extraCount > 0 ? buildOverflowChips(uniqueTabs.slice(8), urlCounts) : '');

  const cardTools = `
    <div class="card-tools" aria-label="Card actions">
      <button class="card-action card-action-close" data-action="close-domain-tabs" data-domain-id="${stableId}" aria-label="Close all ${tabCount} tabs" title="Close all ${tabCount} tabs">
        ${ICONS.close}
      </button>
      ${hasDupes ? `
        <button class="card-action card-action-duplicate" data-action="dedup-keep-one" data-dupe-urls="${dupeUrlsEncoded}" aria-label="Close ${totalExtras} duplicate tab${totalExtras !== 1 ? 's' : ''}, keep one" title="Close ${totalExtras} duplicate tab${totalExtras !== 1 ? 's' : ''}, keep one">
          ${ICONS.duplicate}
          <span class="card-action-count">${totalExtras}</span>
        </button>` : ''}
    </div>`;

  return `
    <div class="mission-card domain-card ${hasDupes ? 'has-amber-bar' : 'has-neutral-bar'}" data-domain-id="${stableId}">
      <div class="status-bar"></div>
      <div class="mission-content">
        <div class="mission-top">
          <div class="mission-heading">
            ${tabBadge}
            <span class="mission-name">${isLanding ? 'Homepages' : (group.label || friendlyDomain(group.domain))}</span>
          </div>
          ${cardTools}
        </div>
        <div class="mission-pages">${pageChips}</div>
      </div>
      <div class="mission-meta">
        <div class="mission-page-count">${tabCount}</div>
        <div class="mission-page-label">tabs</div>
      </div>
    </div>`;
}


/* ----------------------------------------------------------------
   SAVED FOR LATER - Render Checklist Column
   ---------------------------------------------------------------- */

/**
 * renderBookmarksSidebar()
 *
 * Renders the bookmarks sidebar content with folder groups.
 */
async function renderBookmarksSidebar() {
  const sidebar = document.getElementById('bookmarksSidebar');
  const sidebarContent = document.getElementById('sidebarContent');

  if (!sidebar || !sidebarContent) return;

  try {
    const bookmarkGroups = await getAllBookmarks();
    
    if (!bookmarkGroups || bookmarkGroups.length === 0) {
      sidebar.style.display = 'none';
      return;
    }

    sidebar.style.display = 'flex';

    const validGroups = bookmarkGroups;
    
    if (validGroups.length === 0) {
      sidebar.style.display = 'none';
      return;
    }

    const openTimes = getBookmarkOpenTimes();
    const sortedGroups = sortBookmarkGroups(validGroups, openTimes, { keepRootLast: true });

    sidebarContent.innerHTML = sortedGroups.map((group, index) => {
      const hideHeader = validGroups.length === 1 && group.isRoot;
      return renderBookmarkGroup(group, { depth: 0, path: `${index}`, hideHeader });
    }).join('');

    setupGroupToggleHandlers();
    setupBookmarkDropTargets();
  } catch (err) {
    console.error('[tab-out] Failed to load bookmarks:', err);
    sidebar.style.display = 'none';
  }
}

function hasBookmarkContent(group) {
  return getBookmarkCount(group) > 0;
}

function getBookmarkCount(group) {
  const directCount = (group.bookmarks || []).filter(b => b && b.url && typeof b.url === 'string').length;
  const childCount = (group.children || []).reduce((sum, child) => sum + getBookmarkCount(child), 0);
  return directCount + childCount;
}

function getBookmarkOpenTimes() {
  try {
    return JSON.parse(localStorage.getItem('bookmarkOpenTimes') || '{}');
  } catch (err) {
    console.warn('[tab-out] Failed to parse bookmark open times:', err);
    return {};
  }
}

function getGroupLastOpenTime(group, openTimes) {
  const directTime = (group.bookmarks || []).reduce((latest, bookmark) => {
    if (!bookmark || !bookmark.url) return latest;
    return Math.max(latest, openTimes[bookmark.url] || 0);
  }, 0);

  const childTime = (group.children || []).reduce((latest, child) => {
    return Math.max(latest, getGroupLastOpenTime(child, openTimes));
  }, 0);

  return Math.max(directTime, childTime);
}

function sortBookmarkGroups(groups, openTimes, { keepRootLast = false } = {}) {
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      if (keepRootLast && a.group.isRoot !== b.group.isRoot) {
        return a.group.isRoot ? 1 : -1;
      }

      const timeDiff = getGroupLastOpenTime(b.group, openTimes) - getGroupLastOpenTime(a.group, openTimes);
      return timeDiff || a.index - b.index;
    })
    .map(item => item.group);
}

function renderBookmarkGroup(group, { depth, path, hideHeader = false }) {
  const count = getBookmarkCount(group);
  if (count === 0 && !group.id) return '';

  const isOpen = hideHeader;
  const groupName = group.name || 'Untitled folder';
  const safeGroupName = escapeHtml(groupName);
  const safeFolderId = escapeAttr(group.id || '');

  const headerHtml = hideHeader ? '' : `
    <div class="drawer-group-header bookmark-drop-target" data-bookmark-folder-id="${safeFolderId}" aria-expanded="${isOpen ? 'true' : 'false'}">
      <span class="drawer-group-name">${safeGroupName}</span>
      <span class="drawer-group-count">${count}</span>
      <button class="drawer-group-toggle" type="button" aria-label="Toggle ${escapeAttr(groupName)}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>`;

  const bookmarksHtml = renderBookmarkItems(group.bookmarks || []);
  const openTimes = getBookmarkOpenTimes();
  const sortedChildren = sortBookmarkGroups(
    group.children || [],
    openTimes
  );
  const childrenHtml = sortedChildren
    .map((child, index) => renderBookmarkGroup(child, {
      depth: depth + 1,
      path: `${path}-${index}`,
      hideHeader: false
    }))
    .join('');

  return `
    <div class="drawer-group ${depth > 0 ? 'drawer-subgroup' : ''}" data-group-path="${path}">
      ${headerHtml}
      <div class="drawer-group-content bookmark-drop-target" data-bookmark-folder-id="${safeFolderId}" ${isOpen ? '' : 'hidden'}>
        ${childrenHtml}
        ${bookmarksHtml}
      </div>
    </div>`;
}

function renderBookmarkItems(bookmarks) {
  const openTimes = getBookmarkOpenTimes();
  const sanitizedBookmarks = bookmarks
    .filter(b => b && b.url && typeof b.url === 'string')
    .slice()
    .sort((a, b) => {
      const timeA = openTimes[a.url] || 0;
      const timeB = openTimes[b.url] || 0;
      return timeB - timeA;
    });

  return sanitizedBookmarks.map(bookmark => {
    let domain = '';
    let faviconUrl = '';
    try {
      const parsed = new URL(bookmark.url);
      domain = parsed.hostname.replace(/^www\./, '');
      faviconUrl = getFaviconUrl(bookmark.url);
    } catch (urlErr) {
      console.warn('[tab-out] Invalid bookmark URL:', bookmark.url);
    }

    const title = bookmark.title || bookmark.url || 'Untitled';
    const safeUrl = escapeAttr(bookmark.url || '');
    const safeTitle = escapeAttr(title);
    const safeDomain = escapeHtml(domain);

    return `
      <button class="drawer-bookmark" data-action="open-bookmark" data-bookmark-url="${safeUrl}" title="${safeTitle}">
        ${faviconUrl ? `<img class="drawer-bookmark-favicon" src="${escapeAttr(faviconUrl)}" alt="" data-favicon data-domain="${escapeAttr(domain)}">` : ''}
        <div class="drawer-bookmark-content">
          <span class="drawer-bookmark-title">${escapeHtml(title)}</span>
          <span class="drawer-bookmark-domain">${safeDomain}</span>
        </div>
      </button>`;
  }).join('');
}

function escapeAttr(value) {
  return escapeHtml(String(value ?? '')).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * setupGroupToggleHandlers()
 *
 * Sets up click handlers for expanding/collapsing bookmark groups.
 */
function setupGroupToggleHandlers() {
  document.querySelectorAll('.drawer-group-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const content = header.nextElementSibling;
      const toggle = header.querySelector('.drawer-group-toggle');
      
      if (content && toggle) {
        const isOpen = !content.hidden;
        content.hidden = isOpen;
        header.setAttribute('aria-expanded', String(!isOpen));
        toggle.classList.toggle('open', !isOpen);
      }
    });
  });
}

/**
 * getAllBookmarks()
 *
 * Retrieves bookmarks from "4tab-out" folder only.
 * Returns an array of groups, each containing a folder name and its bookmarks.
 */
async function getAllBookmarks() {
  console.log('[tab-out] Requesting bookmarks from 4tab-out folder');
  
  if (!chrome.bookmarks || typeof chrome.bookmarks.getTree !== 'function') {
    console.warn('[tab-out] Bookmarks API not available');
    return [];
  }
  
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) {
        console.error('[tab-out] Failed to get bookmarks tree:', chrome.runtime.lastError.message);
        resolve([]);
        return;
      }
      
      console.log('[tab-out] Got bookmarks tree');
      
      // Extract bookmarks only from "4tab-out" folder
      let groups = [];
      
      function findOtherBookmarks(nodes) {
        for (const node of nodes) {
          if (node.title === '4tab-out' && node.children) {
            // Found the 4tab-out folder
            groups = buildBookmarkGroups(node.children);
            return true;
          }
          if (node.children) {
            if (findOtherBookmarks(node.children)) {
              return true;
            }
          }
        }
        return false;
      }
      
      function buildBookmarkGroups(nodes) {
        const rootBookmarks = [];
        const folderGroups = [];

        // Keep the browser bookmark tree order while preserving nested folders.
        for (const node of nodes) {
          if (node.url) {
            rootBookmarks.push(node);
          } else if (node.children && node.title) {
            const group = buildBookmarkFolder(node);
            if (hasBookmarkContent(group)) {
              folderGroups.push(group);
            }
          }
        }

        return rootBookmarks.length > 0
          ? [...folderGroups, { id: nodes[0]?.parentId || '', name: '4tab-out', bookmarks: rootBookmarks, children: [], isRoot: true }]
          : folderGroups;
      }

      function buildBookmarkFolder(folderNode) {
        const group = {
          id: folderNode.id,
          name: folderNode.title || 'Untitled folder',
          bookmarks: [],
          children: []
        };

        for (const node of folderNode.children || []) {
          if (node.url) {
            group.bookmarks.push(node);
          } else if (node.children && node.title) {
            const childGroup = buildBookmarkFolder(node);
            group.children.push(childGroup);
          }
        }

        return group;
      }
      
      findOtherBookmarks(tree);
      
      // Keep original order (no sorting)
      
      console.log('[tab-out] Found bookmark groups from 4tab-out:', groups.length);
      resolve(groups);
    });
  });
}

/**
 * getBookmarksFromFolder(folderName)
 *
 * Retrieves all bookmarks from a specific folder by name using chrome.bookmarks API directly.
 */
async function getBookmarksFromFolder(folderName) {
  console.log('[tab-out] Requesting bookmarks from folder:', folderName);
  
  if (!chrome.bookmarks || typeof chrome.bookmarks.search !== 'function') {
    console.warn('[tab-out] Bookmarks API not available');
    return [];
  }
  
  return new Promise((resolve) => {
    chrome.bookmarks.search({ title: folderName }, (results) => {
      if (chrome.runtime.lastError) {
        console.error('[tab-out] Bookmarks search error:', chrome.runtime.lastError.message);
        resolve([]);
        return;
      }
      
      console.log('[tab-out] Found bookmark search results:', results);
      
      const folder = results.find(r => r.title === folderName && r.children);
      if (!folder) {
        console.log('[tab-out] Bookmark folder not found:', folderName);
        resolve([]);
        return;
      }

      chrome.bookmarks.getChildren(folder.id, (children) => {
        if (chrome.runtime.lastError) {
          console.error('[tab-out] Failed to get children:', chrome.runtime.lastError.message);
          resolve([]);
          return;
        }
        console.log('[tab-out] Found bookmarks:', children.length);
        resolve(children);
      });
    });
  });
}

/**
 * renderDeferredColumn()
 *
 * Reads saved tabs from chrome.storage.local and renders the right-side
 * "Saved for Later" checklist column. Shows active items as a checklist
 * and completed items in a collapsible archive.
 */
async function renderDeferredColumn() {
  const column         = document.getElementById('deferredColumn');
  const list           = document.getElementById('deferredList');
  const empty          = document.getElementById('deferredEmpty');
  const countEl        = document.getElementById('deferredCount');
  const archiveEl      = document.getElementById('deferredArchive');
  const archiveCountEl = document.getElementById('archiveCount');
  const archiveList    = document.getElementById('archiveList');

  if (!column) return;

  try {
    const { active, archived } = await getSavedTabs();

    // Hide the entire column if there's nothing to show
    if (active.length === 0 && archived.length === 0) {
      column.style.display = 'none';
      return;
    }

    column.style.display = 'block';

    // Render active checklist items
    if (active.length > 0) {
      countEl.textContent = `${active.length} item${active.length !== 1 ? 's' : ''}`;
      list.innerHTML = active.map(item => renderDeferredItem(item)).join('');
      list.style.display = 'block';
      empty.style.display = 'none';
    } else {
      list.style.display = 'none';
      countEl.textContent = '';
      empty.style.display = 'block';
    }

    // Render archive section
    if (archived.length > 0) {
      archiveCountEl.textContent = `(${archived.length})`;
      archiveList.innerHTML = archived.map(item => renderArchiveItem(item)).join('');
      archiveEl.style.display = 'block';
    } else {
      archiveEl.style.display = 'none';
    }

  } catch (err) {
    console.warn('[tab-out] Could not load saved tabs:', err);
    column.style.display = 'none';
  }
}

/**
 * renderDeferredItem(item)
 *
 * Builds HTML for one active checklist item: checkbox, title link,
 * domain, time ago, dismiss button.
 */
function renderDeferredItem(item) {
  let domain = '';
  try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
  const faviconUrl = getFaviconUrl(item.url);
  const ago = timeAgo(item.savedAt);

  return `
    <div class="deferred-item" data-deferred-id="${item.id}">
      <input type="checkbox" class="deferred-checkbox" data-action="check-deferred" data-deferred-id="${item.id}">
      <div class="deferred-info">
        <a href="${item.url}" target="_blank" rel="noopener" class="deferred-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
          <img src="${faviconUrl}" alt="" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" data-favicon data-domain="${domain}">${item.title || item.url}
        </a>
        <div class="deferred-meta">
          <span>${domain}</span>
          <span>${ago}</span>
        </div>
      </div>
      <button class="deferred-dismiss" data-action="dismiss-deferred" data-deferred-id="${item.id}" title="Dismiss">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>`;
}

/**
 * renderArchiveItem(item)
 *
 * Builds HTML for one completed/archived item (simpler: just title + date).
 */
function renderArchiveItem(item) {
  const ago = item.completedAt ? timeAgo(item.completedAt) : timeAgo(item.savedAt);
  return `
    <div class="archive-item">
      <a href="${item.url}" target="_blank" rel="noopener" class="archive-item-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
        ${item.title || item.url}
      </a>
      <span class="archive-item-date">${ago}</span>
      <button class="archive-item-delete" data-action="delete-archive-item" data-deferred-id="${item.id}" title="Delete">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>`;
}


/* ----------------------------------------------------------------
   MAIN DASHBOARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderStaticDashboard()
 *
 * The main render function:
 * 1. Paints time + date
 * 2. Fetches open tabs via chrome.tabs.query()
 * 3. Groups tabs by domain (with landing pages pulled out to their own group)
 * 4. Renders domain cards
 * 5. Updates header stats
 * 6. Renders the "Saved for Later" checklist
 */
async function renderStaticDashboard() {
  // --- Header ---
  const dateEl     = document.getElementById('dateDisplay');
  renderTimeDisplay();
  if (dateEl)     dateEl.textContent     = getDateDisplay();

  // --- Fetch tabs ---
  await fetchOpenTabs();
  const realTabs = getRealTabs();

  // --- Group tabs by domain ---
  // Landing pages (Gmail inbox, Twitter home, etc.) get their own special group
  // so they can be closed together without affecting content tabs on the same domain.
  const LANDING_PAGE_PATTERNS = [
    { hostname: 'mail.google.com', test: (p, h) =>
        !h.includes('#inbox/') && !h.includes('#sent/') && !h.includes('#search/') },
    { hostname: 'x.com',               pathExact: ['/home'] },
    { hostname: 'www.linkedin.com',    pathExact: ['/'] },
    { hostname: 'github.com',          pathExact: ['/'] },
    { hostname: 'www.youtube.com',     pathExact: ['/'] },
    // Merge personal patterns from config.local.js (if it exists)
    ...(typeof LOCAL_LANDING_PAGE_PATTERNS !== 'undefined' ? LOCAL_LANDING_PAGE_PATTERNS : []),
  ];

  function isLandingPage(url) {
    try {
      const parsed = new URL(url);
      return LANDING_PAGE_PATTERNS.some(p => {
        // Support both exact hostname and suffix matching (for wildcard subdomains)
        const hostnameMatch = p.hostname
          ? parsed.hostname === p.hostname
          : p.hostnameEndsWith
            ? parsed.hostname.endsWith(p.hostnameEndsWith)
            : false;
        if (!hostnameMatch) return false;
        if (p.test)       return p.test(parsed.pathname, url);
        if (p.pathPrefix) return parsed.pathname.startsWith(p.pathPrefix);
        if (p.pathExact)  return p.pathExact.includes(parsed.pathname);
        return parsed.pathname === '/';
      });
    } catch { return false; }
  }

  domainGroups = [];
  const groupMap    = {};
  const landingTabs = [];

  // Custom group rules from config.local.js (if any)
  const customGroups = typeof LOCAL_CUSTOM_GROUPS !== 'undefined' ? LOCAL_CUSTOM_GROUPS : [];

  // Check if a URL matches a custom group rule; returns the rule or null
  function matchCustomGroup(url) {
    try {
      const parsed = new URL(url);
      return customGroups.find(r => {
        const hostMatch = r.hostname
          ? parsed.hostname === r.hostname
          : r.hostnameEndsWith
            ? parsed.hostname.endsWith(r.hostnameEndsWith)
            : false;
        if (!hostMatch) return false;
        if (r.pathPrefix) return parsed.pathname.startsWith(r.pathPrefix);
        return true; // hostname matched, no path filter
      }) || null;
    } catch { return null; }
  }

  for (const tab of realTabs) {
    try {
      if (isLandingPage(tab.url)) {
        landingTabs.push(tab);
        continue;
      }

      // Check custom group rules first (e.g. merge subdomains, split by path)
      const customRule = matchCustomGroup(tab.url);
      if (customRule) {
        const key = customRule.groupKey;
        if (!groupMap[key]) groupMap[key] = { domain: key, label: customRule.groupLabel, tabs: [] };
        groupMap[key].tabs.push(tab);
        continue;
      }

      let hostname;
      if (tab.url && tab.url.startsWith('file://')) {
        hostname = 'local-files';
      } else {
        hostname = new URL(tab.url).hostname;
      }
      if (!hostname) continue;

      if (!groupMap[hostname]) groupMap[hostname] = { domain: hostname, tabs: [] };
      groupMap[hostname].tabs.push(tab);
    } catch {
      // Skip malformed URLs
    }
  }

  if (landingTabs.length > 0) {
    groupMap['__landing-pages__'] = { domain: '__landing-pages__', tabs: landingTabs };
  }

  // Sort: landing pages first, then domains from landing page sites, then by tab count
  // Collect exact hostnames and suffix patterns for priority sorting
  const landingHostnames = new Set(LANDING_PAGE_PATTERNS.map(p => p.hostname).filter(Boolean));
  const landingSuffixes = LANDING_PAGE_PATTERNS.map(p => p.hostnameEndsWith).filter(Boolean);
  function isLandingDomain(domain) {
    if (landingHostnames.has(domain)) return true;
    return landingSuffixes.some(s => domain.endsWith(s));
  }
  domainGroups = Object.values(groupMap).sort((a, b) => {
    const aIsLanding = a.domain === '__landing-pages__';
    const bIsLanding = b.domain === '__landing-pages__';
    if (aIsLanding !== bIsLanding) return aIsLanding ? -1 : 1;

    const aIsPriority = isLandingDomain(a.domain);
    const bIsPriority = isLandingDomain(b.domain);
    if (aIsPriority !== bIsPriority) return aIsPriority ? -1 : 1;

    return b.tabs.length - a.tabs.length;
  });

  // --- Render domain cards ---
  const openTabsSection      = document.getElementById('openTabsSection');
  const openTabsMissionsEl   = document.getElementById('openTabsMissions');
  const openTabsSectionCount = document.getElementById('openTabsSectionCount');
  const openTabsSectionTitle = document.getElementById('openTabsSectionTitle');

  if (domainGroups.length > 0 && openTabsSection) {
    if (openTabsSectionTitle) openTabsSectionTitle.textContent = 'Open tabs';
    openTabsSectionCount.innerHTML = `${domainGroups.length} domain${domainGroups.length !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; <button class="action-btn close-tabs" data-action="close-all-open-tabs" style="font-size:11px;padding:3px 10px;">${ICONS.close} Close all ${realTabs.length} tabs</button>`;
    openTabsMissionsEl.innerHTML = domainGroups.map(g => renderDomainCard(g)).join('');
    openTabsSection.style.display = 'block';
  } else if (openTabsSection) {
    openTabsSection.style.display = 'none';
  }

  // --- Header stats ---
  const statTabs = document.getElementById('statTabs');
  if (statTabs) statTabs.textContent = openTabs.length;

  // --- Check for duplicate Tab Out tabs ---
  checkTabOutDupes();

  // --- Render "Saved for Later" column ---
  await renderDeferredColumn();

  // --- Render bookmarks sidebar ---
  await renderBookmarksSidebar();

  // --- Render todo sidebar ---
  await renderTodoSidebar();
}

async function renderDashboard() {
  await renderStaticDashboard();
}


/* ----------------------------------------------------------------
   EVENT HANDLERS - using event delegation

   One listener on document handles ALL button clicks.
   Think of it as one security guard watching the whole building
   instead of one per door.
   ---------------------------------------------------------------- */

document.addEventListener('click', async (e) => {
  // Walk up the DOM to find the nearest element with data-action
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  // ---- Todo Actions ----
  if (action === 'add-todo') {
    const input = document.getElementById('todoInput');
    const dueDateInput = document.getElementById('todoDueDate');
    await addTodo(input.value, dueDateInput.value);
    input.value = '';
    dueDateInput.value = '';
    return;
  }

  if (action === 'clear-due-date') {
    const dueDateInput = document.getElementById('todoDueDate');
    dueDateInput.value = '';
    return;
  }

  if (action === 'toggle-todo') {
    const id = actionEl.dataset.todoId;
    if (id) await toggleTodo(id);
    return;
  }

  if (action === 'edit-todo') {
    const id = actionEl.dataset.todoId;
    const todo = todos.find(t => t.id === id);
    if (todo) showEditTodoModal(todo);
    return;
  }

  if (action === 'delete-todo') {
    const id = actionEl.dataset.todoId;
    if (id) await deleteTodo(id);
    return;
  }

  if (action === 'cancel-edit') {
    closeEditTodoModal();
    return;
  }

  // ---- Close duplicate Tab Out tabs ----
  if (action === 'close-tabout-dupes') {
    await closeTabOutDupes();
    playCloseSound();
    const banner = document.getElementById('tabOutDupeBanner');
    if (banner) {
      const rect = banner.getBoundingClientRect();
      shootClosingStars(rect.left + rect.width / 2, rect.top + rect.height / 2);
      banner.style.transition = 'opacity 0.4s';
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; banner.style.opacity = '1'; }, 400);
    }
    showToast('Closed extra Tab Out tabs');
    return;
  }

  const card = actionEl.closest('.mission-card');

  // ---- Expand overflow chips ("+N more") ----
  if (action === 'expand-chips') {
    const overflowContainer = actionEl.parentElement.querySelector('.page-chips-overflow');
    if (overflowContainer) {
      overflowContainer.style.display = 'contents';
      actionEl.remove();
    }
    return;
  }

  // ---- Focus a specific tab ----
  if (action === 'focus-tab') {
    const tabUrl = actionEl.dataset.tabUrl;
    if (tabUrl) await focusTab(tabUrl);
    return;
  }

  // ---- Open a bookmark in a new tab ----
  if (action === 'open-bookmark') {
    const url = actionEl.dataset.bookmarkUrl;
    if (!url) return;

    // Record the open time for sorting
    const openTimes = getBookmarkOpenTimes();
    openTimes[url] = Date.now();
    localStorage.setItem('bookmarkOpenTimes', JSON.stringify(openTimes));

    await chrome.tabs.create({ url: url });
    showToast('Bookmark opened');
    return;
  }

  // ---- Close a single tab ----
  if (action === 'close-single-tab') {
    e.stopPropagation(); // don't trigger parent chip's focus-tab
    const tabUrl = actionEl.dataset.tabUrl;
    if (!tabUrl) return;

    // Close the tab in Chrome directly
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    playCloseSound();

    // Animate the chip row out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      const rect = chip.getBoundingClientRect();
      shootClosingStars(rect.left + rect.width / 2, rect.top + rect.height / 2);
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => {
        chip.remove();
        // If the card now has no tabs, remove it too
        const parentCard = document.querySelector('.mission-card:has(.mission-pages:empty)');
        if (parentCard) animateCardOut(parentCard);
        document.querySelectorAll('.mission-card').forEach(c => {
          if (c.querySelectorAll('.page-chip[data-action="focus-tab"]').length === 0) {
            animateCardOut(c);
          }
        });
      }, 200);
    }

    // Update header stats
    const statTabs = document.getElementById('statTabs');
    if (statTabs) statTabs.textContent = openTabs.length;

    showToast('Tab closed');
    return;
  }

  // ---- Save a single tab for later (then close it) ----
  if (action === 'defer-single-tab') {
    e.stopPropagation();
    const tabUrl   = actionEl.dataset.tabUrl;
    const tabTitle = actionEl.dataset.tabTitle || tabUrl;
    if (!tabUrl) return;

    // Save to chrome.storage.local
    try {
      await saveTabForLater({ url: tabUrl, title: tabTitle });
    } catch (err) {
      console.error('[tab-out] Failed to save tab:', err);
      showToast('Failed to save tab');
      return;
    }

    // Close the tab in Chrome
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    // Animate chip out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => chip.remove(), 200);
    }

    showToast('Saved for later');
    await renderDeferredColumn();
    return;
  }

  // ---- Check off a saved tab (moves it to archive) ----
  if (action === 'check-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await checkOffSavedTab(id);

    // Animate: strikethrough first, then slide out
    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('checked');
      setTimeout(() => {
        item.classList.add('removing');
        setTimeout(() => {
          item.remove();
          renderDeferredColumn(); // refresh counts and archive
        }, 300);
      }, 800);
    }
    return;
  }

  // ---- Dismiss a saved tab (removes it entirely) ----
  if (action === 'dismiss-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await dismissSavedTab(id);

    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('removing');
      setTimeout(() => {
        item.remove();
        renderDeferredColumn();
      }, 300);
    }
    return;
  }

  // ---- Delete an archived item ----
  if (action === 'delete-archive-item') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await dismissSavedTab(id);

    const item = actionEl.closest('.archive-item');
    if (item) {
      item.style.transition = 'opacity 0.2s, transform 0.2s';
      item.style.opacity = '0';
      item.style.transform = 'scale(0.9)';
      setTimeout(() => {
        item.remove();
        renderDeferredColumn();
      }, 200);
    }
    
    showToast('Archived item deleted');
    return;
  }

  // ---- Close all tabs in a domain group ----
  if (action === 'close-domain-tabs') {
    const domainId = actionEl.dataset.domainId;
    const group    = domainGroups.find(g => {
      return 'domain-' + g.domain.replace(/[^a-z0-9]/g, '-') === domainId;
    });
    if (!group) return;

    const urls      = group.tabs.map(t => t.url);
    // Landing pages and custom groups (whose domain key isn't a real hostname)
    // must use exact URL matching to avoid closing unrelated tabs
    const useExact  = group.domain === '__landing-pages__' || !!group.label;

    if (useExact) {
      await closeTabsExact(urls);
    } else {
      await closeTabsByUrls(urls);
    }

    if (card) {
      playCloseSound();
      animateCardOut(card);
    }

    // Remove from in-memory groups
    const idx = domainGroups.indexOf(group);
    if (idx !== -1) domainGroups.splice(idx, 1);

    const groupLabel = group.domain === '__landing-pages__' ? 'Homepages' : (group.label || friendlyDomain(group.domain));
    showToast(`Closed ${urls.length} tab${urls.length !== 1 ? 's' : ''} from ${groupLabel}`);

    const statTabs = document.getElementById('statTabs');
    if (statTabs) statTabs.textContent = openTabs.length;
    return;
  }

  // ---- Close duplicates, keep one copy ----
  if (action === 'dedup-keep-one') {
    const urlsEncoded = actionEl.dataset.dupeUrls || '';
    const urls = urlsEncoded.split(',').map(u => decodeURIComponent(u)).filter(Boolean);
    if (urls.length === 0) return;

    await closeDuplicateTabs(urls, true);
    playCloseSound();
    const rect = actionEl.getBoundingClientRect();
    shootClosingStars(rect.left + rect.width / 2, rect.top + rect.height / 2);

    // Hide the dedup button
    actionEl.style.transition = 'opacity 0.2s';
    actionEl.style.opacity    = '0';
    setTimeout(() => actionEl.remove(), 200);

    // Remove dupe badges from the card
    if (card) {
      card.querySelectorAll('.chip-dupe-badge').forEach(b => {
        b.style.transition = 'opacity 0.2s';
        b.style.opacity    = '0';
        setTimeout(() => b.remove(), 200);
      });
      card.classList.remove('has-amber-bar');
      card.classList.add('has-neutral-bar');
    }

    showToast('Closed duplicates, kept one copy each');
    return;
  }

  // ---- Close ALL open tabs ----
  if (action === 'close-all-open-tabs') {
    const allUrls = openTabs
      .filter(t => t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about:'))
      .map(t => t.url);
    await closeTabsByUrls(allUrls);
    playCloseSound();

    document.querySelectorAll('#openTabsMissions .mission-card').forEach(c => {
      animateCardOut(c);
    });

    showToast('All tabs closed. Fresh start.');
    return;
  }
});

document.addEventListener('dragstart', (e) => {
  const chip = e.target.closest?.('.page-chip[draggable="true"]');
  if (!chip || !e.dataTransfer) return;

  const tab = {
    url: chip.dataset.tabUrl,
    title: chip.dataset.tabTitle || chip.querySelector('.chip-text')?.textContent?.trim(),
  };

  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/x-tab-out-tab', JSON.stringify(tab));
  e.dataTransfer.setData('text/plain', tab.url || '');
  chip.classList.add('dragging');
});

document.addEventListener('dragend', (e) => {
  const chip = e.target.closest?.('.page-chip[draggable="true"]');
  chip?.classList.remove('dragging');
  document.querySelectorAll('.bookmark-drop-target.drop-ready').forEach(target => {
    target.classList.remove('drop-ready');
  });
});

// ---- Archive toggle - expand/collapse the archive section ----
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('#archiveToggle');
  if (!toggle) return;

  toggle.classList.toggle('open');
  const body = document.getElementById('archiveBody');
  if (body) {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }
});

/* ----------------------------------------------------------------
   TODO LIST FUNCTIONS
   ---------------------------------------------------------------- */

let todos = [];

async function loadTodos() {
  try {
    const result = await chrome.storage.local.get('tabOutTodos');
    todos = result.tabOutTodos || [];
  } catch (err) {
    console.error('[tab-out] Failed to load todos:', err);
    todos = [];
  }
}

async function saveTodos() {
  try {
    await chrome.storage.local.set({ tabOutTodos: todos });
  } catch (err) {
    console.error('[tab-out] Failed to save todos:', err);
  }
}

function generateTodoId() {
  return 'todo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todoDate = new Date(date);
  todoDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((todoDate - today) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return { text: 'Today', class: 'today' };
  if (diffDays === 1) return { text: 'Tomorrow', class: '' };
  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, class: 'overdue' };
  
  const options = { month: 'short', day: 'numeric' };
  return { text: date.toLocaleDateString('en-US', options), class: '' };
}

function formatCompletedDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderTodoItem(todo) {
  const dueDateInfo = formatDate(todo.dueDate);
  const completedDate = formatCompletedDate(todo.completedAt);
  
  return `
    <div class="todo-item ${todo.completed ? 'completed' : ''}" data-todo-id="${todo.id}">
      <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} data-action="toggle-todo" data-todo-id="${todo.id}">
      <div class="todo-content">
        <span class="todo-text">${escapeHtml(todo.text)}</span>
        <div class="todo-meta">
          ${dueDateInfo ? `<span class="todo-due-date-badge ${dueDateInfo.class}">${dueDateInfo.text}</span>` : ''}
          ${completedDate ? `<span class="todo-completed-at">Completed ${completedDate}</span>` : ''}
        </div>
      </div>
      <div class="todo-actions">
        <button class="todo-action-btn todo-edit-btn" data-action="edit-todo" data-todo-id="${todo.id}" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button class="todo-action-btn todo-delete-btn" data-action="delete-todo" data-todo-id="${todo.id}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  `;
}

async function renderTodoSidebar() {
  await loadTodos();
  
  // 未完成的任务按截止时间排序（越近越靠前）
  const activeTodos = todos.filter(t => !t.completed).sort((a, b) => {
    const hasDueDateA = !!a.dueDate;
    const hasDueDateB = !!b.dueDate;
    
    // 都有截止日期，按日期远近排序
    if (hasDueDateA && hasDueDateB) {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    }
    
    // 只有一个有截止日期，有截止日期的排前面
    if (hasDueDateA) return -1;
    if (hasDueDateB) return 1;
    
    // 都没有截止日期，按创建时间排序（最新创建的在前）
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
  
  // 已完成的任务按完成时间排序（最新完成的在前）
  const completedTodos = todos.filter(t => t.completed).sort((a, b) => {
    const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return timeB - timeA;
  });
  
  const activeTodoList = document.getElementById('activeTodoList');
  const completedTodoList = document.getElementById('completedTodoList');
  const activeEmpty = document.getElementById('activeEmpty');
  const completedEmpty = document.getElementById('completedEmpty');
  const activeTodoCount = document.getElementById('activeTodoCount');
  const completedTodoCount = document.getElementById('completedTodoCount');
  const todoStats = document.getElementById('todoStats');
  
  const activeCount = activeTodos.length;
  const completedCount = completedTodos.length;
  
  // Render active todos
  if (activeCount === 0) {
    activeTodoList.innerHTML = '';
    if (activeEmpty) activeEmpty.style.display = 'block';
  } else {
    if (activeEmpty) activeEmpty.style.display = 'none';
    activeTodoList.innerHTML = activeTodos.map(renderTodoItem).join('');
  }
  
  // Render completed todos
  if (completedCount === 0) {
    completedTodoList.innerHTML = '';
    if (completedEmpty) completedEmpty.style.display = 'block';
  } else {
    if (completedEmpty) completedEmpty.style.display = 'none';
    completedTodoList.innerHTML = completedTodos.map(renderTodoItem).join('');
  }
  
  // Update counts
  if (activeTodoCount) activeTodoCount.textContent = activeCount;
  if (completedTodoCount) completedTodoCount.textContent = completedCount;
  
  if (todoStats) {
    todoStats.innerHTML = `<span class="todo-active-count">${activeCount}</span> active / <span class="todo-completed-count">${completedCount}</span> completed`;
  }
}



function showEditTodoModal(todo) {
  let modal = document.getElementById('todoEditModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'todoEditModal';
    modal.className = 'todo-edit-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'todoEditTitle');
    modal.innerHTML = `
      <div class="todo-edit-content">
        <div class="todo-edit-title" id="todoEditTitle">Edit Todo</div>
        <form class="todo-edit-form" id="todoEditForm">
          <input type="hidden" id="todoEditId">
          <input type="text" id="todoEditText" class="todo-edit-input" placeholder="Todo text">
          <input type="date" id="todoEditDueDate" class="todo-edit-due-date">
          <div class="todo-edit-buttons">
            <button type="button" class="todo-edit-btn cancel" data-action="cancel-edit">Cancel</button>
            <button type="submit" class="todo-edit-btn primary">Save</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('todoEditId').value = todo.id;
  document.getElementById('todoEditText').value = todo.text;
  document.getElementById('todoEditDueDate').value = todo.dueDate || '';
  
  modal.classList.add('open');
}

function closeEditTodoModal() {
  const modal = document.getElementById('todoEditModal');
  if (modal) {
    modal.classList.remove('open');
  }
}

async function addTodo(text, dueDate) {
  if (!text.trim()) return;
  
  const newTodo = {
    id: generateTodoId(),
    text: text.trim(),
    dueDate: dueDate || null,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString()
  };
  
  todos.unshift(newTodo);
  await saveTodos();
  await renderTodoSidebar();
  
  showToast('Todo added');
}

async function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  
  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? new Date().toISOString() : null;
  
  await saveTodos();
  await renderTodoSidebar();
  
  showToast(todo.completed ? 'Todo completed!' : 'Todo reactivated');
}

async function updateTodo(id, text, dueDate) {
  if (!text.trim()) return;
  
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  
  todo.text = text.trim();
  todo.dueDate = dueDate || null;
  
  await saveTodos();
  await renderTodoSidebar();
  
  showToast('Todo updated');
}

async function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  await saveTodos();
  await renderTodoSidebar();
  
  showToast('Todo deleted');
}

// ---- Todo edit form submit ----
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'todoEditForm') {
    e.preventDefault();
    const id = document.getElementById('todoEditId').value;
    const text = document.getElementById('todoEditText').value;
    const dueDate = document.getElementById('todoEditDueDate').value;
    
    await updateTodo(id, text, dueDate);
    closeEditTodoModal();
  }
});

// ---- Todo input enter key ----
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'todoInput' && e.key === 'Enter') {
    const addBtn = document.querySelector('[data-action="add-todo"]');
    if (addBtn) addBtn.click();
  }
});

// ---- Archive search - filter archived items as user types ----
document.addEventListener('input', async (e) => {
  if (e.target.id !== 'archiveSearch') return;

  const q = e.target.value.trim().toLowerCase();
  const archiveList = document.getElementById('archiveList');
  if (!archiveList) return;

  try {
    const { archived } = await getSavedTabs();

    if (q.length < 2) {
      // Show all archived items
      archiveList.innerHTML = archived.map(item => renderArchiveItem(item)).join('');
      return;
    }

    // Filter by title or URL containing the query string
    const results = archived.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.url  || '').toLowerCase().includes(q)
    );

    archiveList.innerHTML = results.map(item => renderArchiveItem(item)).join('')
      || '<div style="font-size:12px;color:var(--muted);padding:8px 0">No results</div>';
  } catch (err) {
    console.warn('[tab-out] Archive search failed:', err);
  }
});


/* ----------------------------------------------------------------
   FAVICON ERROR HANDLER
   ---------------------------------------------------------------- */

/**
 * setupFaviconErrorHandlers()
 *
 * Sets up error handlers for favicon images that fail to load.
 * Uses event delegation to handle dynamically added images and tries backup services.
 */
function setupFaviconErrorHandlers() {
  document.addEventListener('error', (e) => {
    const target = e.target;
    if (target.tagName === 'IMG' && target.hasAttribute('data-favicon')) {
      target.style.display = 'none';
      return;
      // 获取域名
      const currentSrc = target.src;
      let domain = target.getAttribute('data-domain') || '';
      
      // 如果没有存储域名，尝试从当前 src 中提取
      if (!domain) {
        try {
          const url = new URL(currentSrc);
          domain = url.hostname;
          target.setAttribute('data-domain', domain);
        } catch (err) {
          // 无法提取域名，隐藏图标
          target.style.display = 'none';
          return;
        }
      }
      
      // 跟踪当前尝试的备用服务索引
      let backupIndex = parseInt(target.getAttribute('data-backup-index') || '-1');
      backupIndex++;
      
      // 跳过第一个服务（因为已经尝试过了），从索引 1 开始尝试备份服务
      if (backupIndex === 0) backupIndex = 1;
      
      if (backupIndex < FAVICON_SERVICES.length) {
        // 尝试下一个备用服务
        target.setAttribute('data-backup-index', backupIndex.toString());
        target.src = FAVICON_SERVICES[backupIndex](domain);
      } else {
        // 所有服务都失败了，隐藏图片
        target.style.display = 'none';
      }
    }
  }, true);
}

/**
 * setupConfigScriptHandler()
 *
 * Handles the config.local.js script load failure gracefully.
 */
function setupConfigScriptHandler() {
  const configScript = document.getElementById('configScript');
  if (configScript) {
    configScript.addEventListener('error', () => {
      // Config file not found is expected behavior, no action needed
    });
  }
}

/* ----------------------------------------------------------------
   DRAWER FUNCTIONS
   ---------------------------------------------------------------- */

function setupDrawerHandlers() {
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditTodoModal();
    }
  });
}

function setupSidebarToggleHandlers() {
  const setupToggle = (sidebarId, label) => {
    const sidebar = document.getElementById(sidebarId);
    const header = sidebar?.querySelector('.sidebar-header');
    const button = sidebar?.querySelector('.sidebar-toggle');
    if (!sidebar || !header || !button) return;

    const startsExpanded = !sidebar.classList.contains('collapsed');
    button.setAttribute('aria-expanded', String(startsExpanded));
    button.setAttribute('aria-label', `${startsExpanded ? 'Collapse' : 'Expand'} ${label}`);

    header.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      button.setAttribute('aria-expanded', String(!isCollapsed));
      button.setAttribute('aria-label', `${isCollapsed ? 'Expand' : 'Collapse'} ${label}`);
    });
  };

  setupToggle('bookmarksSidebar', 'bookmarks');
  setupToggle('todoSidebar', 'todo list');
}

function setupBookmarkDropTargets() {
  document.querySelectorAll('.bookmark-drop-target').forEach(target => {
    target.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('application/x-tab-out-tab')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      target.classList.add('drop-ready');
    });

    target.addEventListener('dragleave', (e) => {
      if (!target.contains(e.relatedTarget)) target.classList.remove('drop-ready');
    });

    target.addEventListener('drop', async (e) => {
      e.preventDefault();
      target.classList.remove('drop-ready');

      const folderId = target.dataset.bookmarkFolderId;
      const serializedTab = e.dataTransfer?.getData('application/x-tab-out-tab');
      if (!folderId || !serializedTab) return;

      try {
        const tab = JSON.parse(serializedTab);
        await saveTabToBookmarkFolder(folderId, tab);
        await renderBookmarksSidebar();
        showToast('Saved to bookmarks');
      } catch (err) {
        console.error('[tab-out] Failed to save dragged tab:', err);
        showToast('Could not save bookmark');
      }
    });
  });
}

async function saveTabToBookmarkFolder(parentId, tab) {
  if (!tab?.url || !chrome.bookmarks) return;

  const children = await new Promise((resolve, reject) => {
    chrome.bookmarks.getChildren(parentId, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(items);
    });
  });

  if (children.some(item => item.url === tab.url)) return;

  await new Promise((resolve, reject) => {
    chrome.bookmarks.create({ parentId, title: tab.title || tab.url, url: tab.url }, (bookmark) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(bookmark);
    });
  });
}

/* ----------------------------------------------------------------
   SEARCH FUNCTIONS
   ---------------------------------------------------------------- */

/**
 * setupSearchHandlers()
 *
 * Sets up the tab search functionality.
 */
function setupSearchHandlers() {
  const searchContainer = document.getElementById('searchContainer');
  const searchToggle = document.getElementById('searchToggle');
  const searchBox = document.getElementById('searchBox');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const searchResults = document.getElementById('searchResults');

  if (!searchContainer || !searchToggle || !searchBox || !searchInput || !searchClear || !searchResults) {
    return;
  }

  // Toggle search box visibility
  searchToggle.addEventListener('click', () => {
    if (searchBox.style.display === 'flex') {
      closeSearch();
    } else {
      openSearch();
    }
  });

  // Clear button
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.setAttribute('aria-expanded', 'false');
    searchClear.style.display = 'none';
    searchResults.innerHTML = '';
    searchResults.classList.remove('open');
  });

  // Real-time search
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    
    if (query) {
      searchClear.style.display = 'flex';
      performSearch(query);
    } else {
      searchInput.setAttribute('aria-expanded', 'false');
      searchClear.style.display = 'none';
      searchResults.innerHTML = '';
      searchResults.classList.remove('open');
    }
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    const items = searchResults.querySelectorAll('.search-result-item');
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        navigateSearchResults(items, 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateSearchResults(items, -1);
        break;
      case 'Enter':
        e.preventDefault();
        const activeItem = searchResults.querySelector('.search-result-item.active');
        if (activeItem) {
          activateSearchResult(activeItem);
        }
        break;
      case 'Escape':
        closeSearch(true);
        break;
    }
  });

  // Close search when clicking outside
  document.addEventListener('click', (e) => {
    const isSearchArea = searchContainer.contains(e.target);
    if (!isSearchArea && searchBox.style.display === 'flex') {
      closeSearch();
    }
  });

  // Ctrl+K shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (searchBox.style.display === 'flex') {
        closeSearch(true);
      } else {
        openSearch();
      }
    }
  });
}

/**
 * openSearch()
 *
 * Opens the search box and focuses the input.
 */
function openSearch() {
  const searchBox = document.getElementById('searchBox');
  const searchInput = document.getElementById('searchInput');
  const searchToggle = document.getElementById('searchToggle');

  setAppearancePanelOpen(false);
  
  searchBox.style.display = 'flex';
  searchBox.classList.add('focused');
  searchToggle?.setAttribute('aria-expanded', 'true');
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.focus();
}

/**
 * closeSearch()
 *
 * Closes the search box and clears results.
 */
function closeSearch(restoreFocus = false) {
  const searchBox = document.getElementById('searchBox');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const searchResults = document.getElementById('searchResults');
  const searchToggle = document.getElementById('searchToggle');
  
  searchBox.style.display = 'none';
  searchBox.classList.remove('focused');
  searchToggle?.setAttribute('aria-expanded', 'false');
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.value = '';
  searchClear.style.display = 'none';
  searchResults.innerHTML = '';
  searchResults.classList.remove('open');
  if (restoreFocus) searchToggle?.focus();
}

/**
 * performSearch(query)
 *
 * Performs real-time search on open tabs.
 */
async function performSearch(query) {
  const searchResults = document.getElementById('searchResults');
  
  if (!query || !searchResults) {
    searchResults.innerHTML = '';
    searchResults.classList.remove('open');
    document.getElementById('searchInput')?.setAttribute('aria-expanded', 'false');
    return;
  }

  // Get current open tabs
  const tabs = await chrome.tabs.query({});
  
  // Filter tabs (exclude Chrome internal pages)
  const filteredTabs = tabs.filter(tab => 
    tab.url && 
    !tab.url.startsWith('chrome://') && 
    !tab.url.startsWith('about:')
  );

  // Filter by title or URL containing the query
  const results = filteredTabs.filter(tab => {
    const title = (tab.title || '').toLowerCase();
    const url = (tab.url || '').toLowerCase();
    return title.includes(query) || url.includes(query);
  });

  if (results.length === 0) {
    searchResults.innerHTML = `
      <div class="search-no-results">
        No tabs found matching "${query}"
      </div>
    `;
    searchResults.classList.add('open');
    document.getElementById('searchInput')?.setAttribute('aria-expanded', 'true');
    return;
  }

  // Render results with highlighted matches
  searchResults.innerHTML = results.map((tab, index) => {
    const isActive = index === 0;
    let domain = '';
    let faviconUrl = '';
    
    try {
      const parsed = new URL(tab.url);
      domain = parsed.hostname.replace(/^www\./, '');
      faviconUrl = getFaviconUrl(tab.url);
    } catch (e) {
      domain = tab.url;
    }

    const highlightedTitle = highlightMatch(tab.title || tab.url || 'Untitled', query);
    const highlightedDomain = highlightMatch(domain, query);

    return `
      <div 
        class="search-result-item ${isActive ? 'active' : ''}" 
        role="option"
        aria-selected="${isActive ? 'true' : 'false'}"
        data-tab-id="${tab.id}"
        data-tab-url="${(tab.url || '').replace(/"/g, '&quot;')}"
        title="${(tab.title || tab.url || '').replace(/"/g, '&quot;')}"
      >
        ${faviconUrl ? `<img class="search-result-favicon" src="${faviconUrl}" alt="" data-favicon data-domain="${domain}">` : ''}
        <div class="search-result-content">
          <span class="search-result-title">${highlightedTitle}</span>
          <span class="search-result-domain">${highlightedDomain}</span>
        </div>
      </div>
    `;
  }).join('');

  searchResults.classList.add('open');
  document.getElementById('searchInput')?.setAttribute('aria-expanded', 'true');

  // Add click handlers to results
  searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      activateSearchResult(item);
    });
  });
}

/**
 * highlightMatch(text, query)
 *
 * Highlights matching parts of text with the search query.
 */
function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text);
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map(part => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return `<span class="search-highlight">${escapeHtml(part)}</span>`;
    }
    return escapeHtml(part);
  }).join('');
}

/**
 * escapeHtml(text)
 *
 * Escapes HTML special characters.
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * navigateSearchResults(items, direction)
 *
 * Navigates through search results with keyboard.
 */
function navigateSearchResults(items, direction) {
  if (!items || items.length === 0) return;
  
  const activeIndex = Array.from(items).findIndex(item => item.classList.contains('active'));
  let newIndex = activeIndex + direction;
  
  if (newIndex < 0) newIndex = items.length - 1;
  if (newIndex >= items.length) newIndex = 0;
  
  items.forEach((item, index) => {
    const isActive = index === newIndex;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', String(isActive));
  });
  
  // Scroll to active item
  items[newIndex].scrollIntoView({ block: 'nearest' });
}

/**
 * activateSearchResult(item)
 *
 * Activates (switches to) the selected tab and moves it to the front.
 */
async function activateSearchResult(item) {
  const tabId = parseInt(item.dataset.tabId);
  
  if (isNaN(tabId)) return;

  try {
    // Switch to the tab
    await chrome.tabs.update(tabId, { active: true });
    
    // Bring the window to front
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    // Move tab to the front
    await chrome.tabs.move(tabId, { index: 0 });

    closeSearch();
  } catch (err) {
    console.error('[tab-out] Failed to activate tab:', err);
  }
}

/* ----------------------------------------------------------------
   APPEARANCE FUNCTIONS
   ---------------------------------------------------------------- */

function areEffectsEnabled() {
  return currentAppearance.effectsEnabled !== false;
}

function setEffectsEnabled(enabled) {
  const isEnabled = enabled !== false;
  document.documentElement.classList.toggle('effects-disabled', !isEnabled);

  if (!isEnabled) {
    if (cursorStarTrailCleanup) cursorStarTrailCleanup();
    document.querySelector('.cursor-star-layer')?.remove();
    cursorStarTrailCleanup = null;
    if (closeSoundContext) {
      closeSoundContext.close().catch(() => {});
      closeSoundContext = null;
      closeSoundBuffer = null;
    }
  } else if (!cursorStarTrailCleanup) {
    setupCursorStarTrail();
  }
}

function applyAppearance(settings) {
  currentAppearance = {
    ...DEFAULT_APPEARANCE,
    ...settings,
    effectsEnabled: settings?.effectsEnabled !== false,
  };

  const palette = PALETTES[currentAppearance.palette] || PALETTES.forest;
  for (const [name, value] of Object.entries(palette)) {
    document.documentElement.style.setProperty(name, value);
  }

  document.documentElement.style.setProperty('--bg-mask-opacity', String(currentAppearance.mask / 100));
  setEffectsEnabled(currentAppearance.effectsEnabled);
  refreshAutoContrast();

  syncAppearanceControls();
}

function syncAppearanceControls() {
  const maskRange = document.getElementById('backgroundMaskRange');
  const maskValue = document.getElementById('backgroundMaskValue');
  const effectsToggle = document.getElementById('effectsToggle');

  if (maskRange) maskRange.value = String(currentAppearance.mask);
  if (maskValue) maskValue.textContent = `${currentAppearance.mask}%`;
  if (effectsToggle) {
    effectsToggle.checked = areEffectsEnabled();
    effectsToggle.setAttribute('aria-checked', String(areEffectsEnabled()));
  }

  document.querySelectorAll('.palette-swatch').forEach(button => {
    const isActive = button.dataset.palette === currentAppearance.palette;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

async function saveAppearance(partial) {
  currentAppearance = { ...currentAppearance, ...partial };
  for (const key of Object.keys(currentAppearance)) {
    if (currentAppearance[key] === undefined) delete currentAppearance[key];
  }
  await chrome.storage.local.set({ tabOutAppearance: currentAppearance });
  applyAppearance(currentAppearance);
}

function openBackgroundDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKGROUND_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BACKGROUND_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withBackgroundStore(mode, callback) {
  const db = await openBackgroundDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKGROUND_DB_STORE, mode);
      const store = tx.objectStore(BACKGROUND_DB_STORE);
      const request = callback(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function saveBackgroundFile(file) {
  await withBackgroundStore('readwrite', store => store.put({
    blob: file,
    type: file.type,
    name: file.name,
    updatedAt: Date.now(),
  }, BACKGROUND_DB_KEY));
}

async function loadBackgroundFile() {
  const record = await withBackgroundStore('readonly', store => store.get(BACKGROUND_DB_KEY));
  return record && record.blob ? record.blob : null;
}

async function clearBackgroundFile() {
  await withBackgroundStore('readwrite', store => store.delete(BACKGROUND_DB_KEY));
}

function refreshAutoContrast() {
  cancelAnimationFrame(autoContrastFrame);
  autoContrastFrame = requestAnimationFrame(() => {
    const targets = document.querySelectorAll('.header-left, .section-header, .action-btn.close-tabs');
    targets.forEach(target => target.classList.remove('light-content'));

    if (!currentBackgroundImage) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scale = Math.max(viewportWidth / currentBackgroundImage.naturalWidth, viewportHeight / currentBackgroundImage.naturalHeight);
    const renderedWidth = currentBackgroundImage.naturalWidth * scale;
    const renderedHeight = currentBackgroundImage.naturalHeight * scale;
    const offsetX = (viewportWidth - renderedWidth) / 2;
    const offsetY = (viewportHeight - renderedHeight) / 2;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    canvas.width = 24;
    canvas.height = 24;
    const maskRgb = getComputedStyle(document.documentElement).getPropertyValue('--bg-mask-rgb').split(',').map(Number);
    const maskOpacity = currentAppearance.mask / 100;

    targets.forEach(target => {
      if (!areEffectsEnabled() && !target.classList.contains('section-header')) return;

      const rect = target.getBoundingClientRect();
      const sourceX = Math.max(0, (rect.left - offsetX) / scale);
      const sourceY = Math.max(0, (rect.top - offsetY) / scale);
      const sourceWidth = Math.min(currentBackgroundImage.naturalWidth - sourceX, rect.width / scale);
      const sourceHeight = Math.min(currentBackgroundImage.naturalHeight - sourceY, rect.height / scale);
      if (sourceWidth <= 0 || sourceHeight <= 0) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(currentBackgroundImage, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let luminance = 0;

      for (let i = 0; i < pixels.length; i += 4) {
        const red = pixels[i] * (1 - maskOpacity) + maskRgb[0] * maskOpacity;
        const green = pixels[i + 1] * (1 - maskOpacity) + maskRgb[1] * maskOpacity;
        const blue = pixels[i + 2] * (1 - maskOpacity) + maskRgb[2] * maskOpacity;
        luminance += (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      }

      if (luminance / (pixels.length / 4) < 0.48) target.classList.add('light-content');
    });
  });
}

function applyBackgroundUrl(url) {
  if (currentBackgroundObjectUrl && currentBackgroundObjectUrl.startsWith('blob:')) {
    URL.revokeObjectURL(currentBackgroundObjectUrl);
  }

  currentBackgroundObjectUrl = url || '';
  currentBackgroundImage = null;

  if (url) {
    document.body.classList.add('has-custom-background');
    document.body.style.backgroundImage = `url("${url}")`;
    const image = new Image();
    image.onload = () => {
      if (currentBackgroundObjectUrl !== url) return;
      currentBackgroundImage = image;
      refreshAutoContrast();
    };
    image.src = url;
  } else {
    document.body.classList.remove('has-custom-background');
    document.body.style.removeProperty('background-image');
    document.body.style.removeProperty('--custom-bg-image');
    refreshAutoContrast();
  }
}

async function restoreBackgroundImage(settings) {
  if (settings && typeof settings.backgroundImage === 'string' && settings.backgroundImage.startsWith('data:')) {
    try {
      const response = await fetch(settings.backgroundImage);
      const blob = await response.blob();
      await saveBackgroundFile(blob);
      delete currentAppearance.backgroundImage;
      await saveAppearance({ hasBackgroundImage: true, backgroundImage: undefined });
      applyBackgroundUrl(URL.createObjectURL(blob));
      return;
    } catch {
      delete currentAppearance.backgroundImage;
      await saveAppearance({ hasBackgroundImage: false, backgroundImage: undefined });
    }
  }

  if (!settings || !settings.hasBackgroundImage) {
    applyBackgroundUrl('');
    return;
  }

  const blob = await loadBackgroundFile();
  if (!blob) {
    await saveAppearance({ hasBackgroundImage: false });
    applyBackgroundUrl('');
    return;
  }

  applyBackgroundUrl(URL.createObjectURL(blob));
}

function setAppearancePanelOpen(isOpen, restoreFocus = false) {
  const panel = document.getElementById('appearancePanel');
  const toggle = document.getElementById('appearanceToggle');
  if (!panel || !toggle) return;

  panel.hidden = !isOpen;
  toggle.classList.toggle('active', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));
  if (!isOpen && restoreFocus) toggle.focus();
}

async function setupAppearanceHandlers() {
  const panel = document.getElementById('appearancePanel');
  const toggle = document.getElementById('appearanceToggle');
  const chooseBtn = document.getElementById('chooseBackgroundBtn');
  const clearBtn = document.getElementById('clearBackgroundBtn');
  const input = document.getElementById('backgroundImageInput');
  const maskRange = document.getElementById('backgroundMaskRange');
  const paletteRow = document.getElementById('paletteRow');
  const effectsToggle = document.getElementById('effectsToggle');

  if (!panel || !toggle || !chooseBtn || !clearBtn || !input || !maskRange || !paletteRow || !effectsToggle) return;

  const { tabOutAppearance } = await chrome.storage.local.get('tabOutAppearance');
  applyAppearance(tabOutAppearance || DEFAULT_APPEARANCE);
  await restoreBackgroundImage(currentAppearance);

  toggle.addEventListener('click', () => {
    const shouldOpen = panel.hidden;
    if (shouldOpen) closeSearch();
    setAppearancePanelOpen(shouldOpen);
  });

  chooseBtn.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    if (file.size > MAX_BACKGROUND_IMAGE_SIZE) {
      showToast('Choose an image under 20MB');
      input.value = '';
      return;
    }

    try {
      await saveBackgroundFile(file);
      applyBackgroundUrl(URL.createObjectURL(file));
      await saveAppearance({ hasBackgroundImage: true });
      showToast('Background updated');
    } catch {
      showToast('Background update failed');
    }

    input.value = '';
  });

  clearBtn.addEventListener('click', async () => {
    await clearBackgroundFile();
    applyBackgroundUrl('');
    await saveAppearance({ hasBackgroundImage: false });
    showToast('Background cleared');
  });

  maskRange.addEventListener('input', async (e) => {
    await saveAppearance({ mask: Number(e.target.value) });
  });

  effectsToggle.addEventListener('change', async (e) => {
    await saveAppearance({ effectsEnabled: e.target.checked });
  });

  paletteRow.addEventListener('click', async (e) => {
    const button = e.target.closest('.palette-swatch');
    if (!button) return;
    await saveAppearance({ palette: button.dataset.palette || 'forest' });
  });

  document.addEventListener('click', (e) => {
    if (panel.hidden || panel.contains(e.target) || toggle.contains(e.target)) return;
    setAppearancePanelOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panel.hidden) return;
    setAppearancePanelOpen(false, true);
  });
}

function setupCursorStarTrail() {
  if (!areEffectsEnabled() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layer = document.createElement('div');
  layer.className = 'cursor-star-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const colors = ['#ffffff', '#ffffff', '#f2fbff', '#d7f1ff', '#c6e8ff', '#a9d4f6'];
  const activeStars = new Set();
  const hoverTimes = new WeakMap();
  let lastX = -100;
  let lastY = -100;
  let lastSpawn = 0;

  const createStar = (x, y, velocityX = 0) => {
    if (activeStars.size >= 48) return;

    const star = document.createElement('span');
    const isGlint = Math.random() < 0.28;
    const size = 5 + Math.pow(Math.random(), 1.7) * 9;
    const inheritedVelocity = Math.max(-60, Math.min(60, velocityX));
    const kickX = inheritedVelocity * 0.08 + (Math.random() - 0.5) * 8;
    const drift = inheritedVelocity * 0.18 + (Math.random() - 0.5) * 42;
    const fall = 42 + Math.random() * 70;
    const midX = drift * (0.35 + Math.random() * 0.2) + (Math.random() - 0.5) * 9;
    const midY = fall * (0.25 + Math.random() * 0.12);
    const rotation = (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 300);
    const duration = 780 + Math.random() * 680;
    const opacity = 0.76 + Math.random() * 0.24;

    star.className = `cursor-star${isGlint ? ' is-glint' : ''}`;
    star.style.left = `${x + (Math.random() - 0.5) * 12}px`;
    star.style.top = `${y + (Math.random() - 0.5) * 10}px`;
    star.style.setProperty('--star-size', `${size}px`);
    star.style.setProperty('--star-kick-x', `${kickX}px`);
    star.style.setProperty('--star-mid-x', `${midX}px`);
    star.style.setProperty('--star-mid-y', `${midY}px`);
    star.style.setProperty('--star-drift', `${drift}px`);
    star.style.setProperty('--star-fall', `${fall}px`);
    star.style.setProperty('--star-mid-rotation', `${rotation * 0.42}deg`);
    star.style.setProperty('--star-rotation', `${rotation}deg`);
    star.style.setProperty('--star-duration', `${duration}ms`);
    star.style.setProperty('--star-opacity', String(opacity));
    star.style.setProperty('--star-mid-opacity', String(opacity * 0.82));
    star.style.setProperty('--star-glow', `${isGlint ? 6 : 3 + Math.random() * 3}px`);
    star.style.setProperty('--star-color', colors[Math.floor(Math.random() * colors.length)]);

    activeStars.add(star);
    layer.appendChild(star);
    star.addEventListener('animationend', () => {
      activeStars.delete(star);
      star.remove();
    }, { once: true });
  };

  const handlePointerMove = (e) => {
    if (e.pointerType === 'touch') return;

    const now = performance.now();
    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 8 || now - lastSpawn < 22) return;

    const pointRatio = 0.42 + Math.random() * 0.5;
    const spawnX = lastX < 0 ? e.clientX : lastX + deltaX * pointRatio;
    const spawnY = lastY < 0 ? e.clientY : lastY + deltaY * pointRatio;
    createStar(spawnX, spawnY, deltaX);
    if (distance > 28 && Math.random() < 0.34) {
      createStar(e.clientX, e.clientY, deltaX);
    }
    lastX = e.clientX;
    lastY = e.clientY;
    lastSpawn = now;
  };

  const handlePointerOver = (e) => {
    if (e.pointerType === 'touch') return;

    const target = e.target.closest?.([
      'button',
      '.mission-card',
      '.bookmarks-sidebar',
      '.todo-sidebar',
      '.deferred-item',
      '.todo-item',
      '.search-box',
      '.search-results',
      '.appearance-panel',
    ].join(','));

    if (!target || target.contains(e.relatedTarget)) return;

    const now = performance.now();
    if (now - (hoverTimes.get(target) || 0) < 520) return;
    hoverTimes.set(target, now);

    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      createStar(e.clientX + (Math.random() - 0.5) * 14, e.clientY + (Math.random() - 0.5) * 10);
    }
  };

  document.addEventListener('pointermove', handlePointerMove, { passive: true });
  document.addEventListener('pointerover', handlePointerOver, { passive: true });

  cursorStarTrailCleanup = () => {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerover', handlePointerOver);
    activeStars.clear();
    layer.remove();
  };
}

function setupClock() {
  const refresh = () => {
    const dateEl = document.getElementById('dateDisplay');
    renderTimeDisplay();
    if (dateEl) dateEl.textContent = getDateDisplay();
  };

  const delay = 60000 - (Date.now() % 60000);
  setTimeout(() => {
    refresh();
    setInterval(refresh, 60000);
  }, delay);
}

/* ----------------------------------------------------------------
   INITIALIZE
   ---------------------------------------------------------------- */
setupFaviconErrorHandlers();
setupConfigScriptHandler();
setupAppearanceHandlers();
setupSearchHandlers();
setupDrawerHandlers();
setupSidebarToggleHandlers();
window.addEventListener('resize', refreshAutoContrast, { passive: true });
setupClock();
renderDashboard();
