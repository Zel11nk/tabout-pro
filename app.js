/* ================================================================
   Tab Out - Dashboard App (Pure Extension Edition)

   This file is the brain of the dashboard. Now that the dashboard
   IS the extension page (not inside an iframe), it can call
   chrome.tabs and chrome.storage directly - no postMessage bridge needed.

   What this file does:
   1. Reads open browser tabs directly via chrome.tabs.query()
   2. Groups tabs by domain with a landing pages category
   3. Renders domain cards, banners, and stats
   4. Handles all user actions (close tabs, focus tab)
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
  language: 'zh',
};

const I18N = {
  zh: {
    appearance: '外观', appearanceHint: '自定义你的空间', chooseImage: '选择图片', clear: '清除', mask: '遮罩', effects: '效果', effectsHint: '鼠标轨迹、动效和声音', language: '语言', customColors: '自定义颜色', customColorsHint: '配置主题颜色', textColor: '文字', surface: '表面', border: '边框', mutedText: '次要文字', primary: '主色', secondary: '次色', dangerColor: '危险', onPrimary: '主色上的文字', chinese: '中文', english: 'English',
    searchPlaceholder: '搜索标签页和书签…', openTabs: '打开的标签页', closeAll: count => `关闭全部 ${count} 个标签页`, bookmarks: '书签', todoList: '待办清单', addTask: '添加待办', todoPlaceholder: '要做什么？', dueDate: '截止日期', add: '添加', links: '链接', addLink: '添加链接', toDo: '待处理', completed: '已完成', nextStep: '下一步会显示在这里', completedHint: '已完成的事项会保留在这里', emptyTitle: '标签页已清空', emptySubtitle: '现在可以专心做事了', noSearchResults: query => `没有找到与“${query}”匹配的标签页或书签`, domainCount: count => `${count} 个域名`, more: count => `还有 ${count} 个`, tabs: '标签页', closeThisTab: '关闭此标签页', cardActions: '卡片操作', activeStats: count => `${count} 项待处理`, completedStats: count => `${count} 项已完成`, activeSuffix: '项待处理', completedSuffix: '项已完成', edit: '编辑', editTodo: '编辑待办', delete: '删除', name: '名称', cancel: '取消', save: '保存', relatedLinks: '相关链接', completeTodo: text => `完成${text}`, reactivateTodo: text => `恢复${text}`, linkInvalid: '链接必须使用 http:// 或 https://', linkOpenFailed: '链接打开失败', enterName: '请输入待办名称', bookmarkOpened: '已打开书签', tabClosed: '已关闭标签页', duplicatesClosed: '已关闭重复标签页', allTabsClosed: '所有标签页已关闭', folderReorderFailed: '文件夹排序失败', bookmarkSaved: '已保存书签', bookmarkSaveFailed: '保存书签失败', imageTooLarge: '请选择 20MB 以内的图片', backgroundUpdated: '背景已更新', backgroundUpdateFailed: '背景更新失败', backgroundCleared: '背景已清除',
    today: '今天', tomorrow: '明天', daysAfter: count => `${count} 天后`, overdue: count => `逾期 ${count} 天`, completedAt: date => `完成于 ${date}`, priority: '优先级', urgent: '紧急', high: '高', normal: '普通', low: '低', lowest: '最低',
  },
  en: {
    appearance: 'Appearance', appearanceHint: 'Personalize your space', chooseImage: 'Choose image', clear: 'Clear', mask: 'Mask', effects: 'Effects', effectsHint: 'Cursor trail, motion and sound', language: 'Language', customColors: 'Custom colors', customColorsHint: 'Configure theme colors', textColor: 'Text', surface: 'Surface', border: 'Border', mutedText: 'Muted text', primary: 'Primary', secondary: 'Secondary', dangerColor: 'Danger', onPrimary: 'On primary', chinese: '中文', english: 'English',
    searchPlaceholder: 'Search tabs and bookmarks...', openTabs: 'Open tabs', closeAll: count => `Close all ${count} tabs`, bookmarks: 'Bookmarks', todoList: 'Todo List', addTask: 'Add task', todoPlaceholder: 'What needs to be done?', dueDate: 'Due date', add: 'Add', links: 'Links', addLink: 'Add link', toDo: 'To Do', completed: 'Completed', nextStep: 'Your next step will show up here.', completedHint: 'Completed tasks stay here for reference.', emptyTitle: 'Tabs cleared', emptySubtitle: 'You can focus now', noSearchResults: query => `No tabs or bookmarks match “${query}”`, domainCount: count => `${count} domain${count !== 1 ? 's' : ''}`, more: count => `${count} more`, tabs: 'tabs', closeThisTab: 'Close this tab', cardActions: 'Card actions', activeStats: count => `${count} active`, completedStats: count => `${count} completed`, activeSuffix: 'active', completedSuffix: 'completed', edit: 'Edit', editTodo: 'Edit todo', delete: 'Delete', name: 'Name', cancel: 'Cancel', save: 'Save', relatedLinks: 'Related links', completeTodo: text => `Complete ${text}`, reactivateTodo: text => `Reactivate ${text}`, linkInvalid: 'Links must use http:// or https://', linkOpenFailed: 'Could not open link', enterName: 'Enter a todo name', bookmarkOpened: 'Bookmark opened', tabClosed: 'Tab closed', duplicatesClosed: 'Duplicates closed', allTabsClosed: 'All tabs closed', folderReorderFailed: 'Could not reorder folder', bookmarkSaved: 'Bookmark saved', bookmarkSaveFailed: 'Could not save bookmark', imageTooLarge: 'Choose an image under 20MB', backgroundUpdated: 'Background updated', backgroundUpdateFailed: 'Background update failed', backgroundCleared: 'Background cleared',
    today: 'Today', tomorrow: 'Tomorrow', daysAfter: count => `${count} days`, overdue: count => `${count}d overdue`, completedAt: date => `Completed ${date}`, priority: 'Priority', urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low', lowest: 'Lowest',
  },
};

function t(key, ...args) {
  const language = currentAppearance?.language === 'en' ? 'en' : 'zh';
  if (key === 'closeAll' && args.length === 0) return language === 'en' ? 'Close all tabs' : '关闭全部标签页';
  if (key === 'closeExtras') return language === 'en' ? 'Close extra Tab Out pages' : '关闭多余 Tab Out';
  const value = I18N[language][key] ?? I18N.en[key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
}

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

const CUSTOM_COLOR_FIELDS = [
  '--ink',
  '--paper',
  '--warm-gray',
  '--muted',
  '--accent-amber',
  '--accent-sage',
  '--status-abandoned',
  '--on-accent',
];

function normalizeCustomColors(colors, fallbackPalette = PALETTES.forest) {
  const normalized = {};
  for (const name of CUSTOM_COLOR_FIELDS) {
    const value = colors?.[name];
    normalized[name] = /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : fallbackPalette[name];
  }
  return normalized;
}

function hexToRgbChannels(hex) {
  const value = hex.slice(1);
  return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`;
}

function createCustomPalette(colors) {
  const customColors = normalizeCustomColors(colors);
  return {
    ...PALETTES.forest,
    ...customColors,
    '--card-bg': 'rgba(var(--bg-mask-rgb), 0.34)',
    '--shadow': `rgba(${hexToRgbChannels(customColors['--ink'])}, 0.07)`,
    '--bg-mask-rgb': hexToRgbChannels(customColors['--paper']),
  };
}

let currentAppearance = { ...DEFAULT_APPEARANCE };

function applyLanguage(language = currentAppearance.language) {
  const nextLanguage = language === 'en' ? 'en' : 'zh';
  currentAppearance.language = nextLanguage;
  document.documentElement.lang = nextLanguage === 'en' ? 'en' : 'zh-CN';

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  setText('.appearance-heading strong', t('appearance'));
  setText('.appearance-heading span', t('appearanceHint'));
  setText('#chooseBackgroundBtn', t('chooseImage'));
  setText('#clearBackgroundBtn', t('clear'));
  setText('.appearance-range > span', t('mask'));
  setText('.appearance-switch strong', t('effects'));
  setText('.appearance-switch small', t('effectsHint'));
  setText('.language-control strong', t('language'));
  setText('.custom-colors-heading strong', t('customColors'));
  setText('.custom-colors-heading span', t('customColorsHint'));
  const customColorLabels = ['textColor', 'surface', 'border', 'mutedText', 'primary', 'secondary', 'dangerColor', 'onPrimary'];
  document.querySelectorAll('.custom-color-control > span').forEach((element, index) => {
    const key = customColorLabels[index];
    if (key) element.textContent = t(key);
  });
  setText('.todo-sidebar .sidebar-title', t('todoList'));
  setText('.bookmarks-sidebar .sidebar-title', t('bookmarks'));
  const bookmarksToggle = document.querySelector('[data-sidebar="bookmarks"]');
  if (bookmarksToggle) bookmarksToggle.setAttribute('aria-label', nextLanguage === 'en' ? 'Collapse bookmarks' : '收起书签');
  const todoToggle = document.querySelector('[data-sidebar="todo"]');
  if (todoToggle) todoToggle.setAttribute('aria-label', nextLanguage === 'en' ? 'Expand todo list' : '展开待办清单');
  setText('.todo-add-trigger span:first-child', t('addTask'));
  setText('#todoAddTitle', t('addTask'));
  setText('#todoAddForm .todo-edit-field:first-of-type > span', t('name'));
  setText('#todoAddForm .todo-edit-field:nth-of-type(2) > span', t('priority'));
  setText('#todoAddForm .todo-edit-field:nth-of-type(3) > span', t('dueDate'));
  setText('#todoAddForm .todo-links-editor-heading > span', t('links'));
  setText('[data-action="cancel-add"]', t('cancel'));
  setText('#todoAddForm button[type="submit"]', t('add'));
  const todoAddInput = document.getElementById('todoAddInput');
  if (todoAddInput) todoAddInput.placeholder = t('todoPlaceholder');
  const dueDateInput = document.getElementById('todoAddDueDate');
  if (dueDateInput) {
    dueDateInput.title = t('dueDate');
    dueDateInput.setAttribute('aria-label', t('dueDate'));
  }
  document.querySelectorAll('.todo-link-label').forEach(input => { input.placeholder = nextLanguage === 'en' ? 'Label' : '名称'; });
  document.querySelectorAll('.todo-link-url').forEach(input => { input.setAttribute('aria-label', nextLanguage === 'en' ? 'Link URL' : '链接地址'); });
  document.querySelectorAll('.todo-link-remove-btn').forEach(button => {
    button.title = nextLanguage === 'en' ? 'Remove link' : '删除链接';
    button.setAttribute('aria-label', nextLanguage === 'en' ? 'Remove link' : '删除链接');
  });
  document.querySelectorAll('.todo-links-editor-heading > span').forEach(element => { element.textContent = t('links'); });
  document.querySelectorAll('[data-action="add-edit-link"], [data-action="add-todo-link"]').forEach(button => { button.textContent = `+ ${t('addLink')}`; });
  setText('.todo-section.active-section .todo-section-title', t('toDo'));
  setText('.todo-section.completed-section .todo-section-title', t('completed'));
  document.querySelectorAll('[data-action="close-tabout-dupes"] .action-label').forEach(element => { element.textContent = t('closeExtras'); });
  const appearanceToggle = document.getElementById('appearanceToggle');
  if (appearanceToggle) {
    appearanceToggle.title = t('appearance');
    appearanceToggle.setAttribute('aria-label', nextLanguage === 'en' ? 'Open appearance settings' : '打开外观设置');
  }
  const searchToggle = document.getElementById('searchToggle');
  if (searchToggle) {
    searchToggle.title = nextLanguage === 'en' ? 'Search tabs and bookmarks' : '搜索标签页和书签';
    searchToggle.setAttribute('aria-label', nextLanguage === 'en' ? 'Search open tabs and bookmarks' : '搜索标签页和书签');
  }
  const searchClear = document.getElementById('searchClear');
  if (searchClear) searchClear.setAttribute('aria-label', nextLanguage === 'en' ? 'Clear search' : '清除搜索');
  const appearancePanel = document.getElementById('appearancePanel');
  if (appearancePanel) appearancePanel.setAttribute('aria-label', nextLanguage === 'en' ? 'Appearance settings' : '外观设置');
  const paletteNames = nextLanguage === 'en'
    ? { forest: 'Forest', slate: 'Slate', dusk: 'Dusk', ocean: 'Ocean', plum: 'Plum', graphite: 'Graphite', mint: 'Mint', custom: 'Custom' }
    : { forest: '森林', slate: '石板', dusk: '暮色', ocean: '海洋', plum: '梅紫', graphite: '石墨', mint: '薄荷', custom: '自定义' };
  document.querySelectorAll('.palette-swatch').forEach(button => {
    const name = paletteNames[button.dataset.palette] || button.dataset.palette;
    button.title = name;
    button.setAttribute('aria-label', `${name}${nextLanguage === 'en' ? ' palette' : '配色'}`);
  });
  setText('#todoEditTitle', t('editTodo'));
  setText('#todoEditForm .todo-edit-field:first-of-type > span', t('name'));
  setText('#todoEditForm .todo-edit-field:nth-of-type(2) > span', t('priority'));
  setText('#todoEditForm .todo-edit-field:nth-of-type(3) > span', t('dueDate'));
  setText('[data-action="cancel-edit"]', t('cancel'));
  setText('#todoEditForm button[type="submit"]', t('save'));
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t('searchPlaceholder');
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) languageSelect.value = nextLanguage;
}
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
      <div class="empty-title">${t('emptyTitle')}</div>
      <div class="empty-subtitle">${t('emptySubtitle')}</div>
    </div>
  `;

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
  return new Date().toLocaleDateString(currentAppearance.language === 'en' ? 'en-US' : 'zh-CN', {
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
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="${t('closeThisTab')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="page-chips-overflow" style="display:none">${hiddenChips}</div>
    <div class="page-chip page-chip-overflow clickable" data-action="expand-chips">
      <span class="chip-text">${t('more', hiddenTabs.length)}</span>
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

  const tabWord = currentAppearance.language === 'en' ? `tab${tabCount !== 1 ? 's' : ''}` : '个标签页';
  const tabBadge = `<span class="card-tab-count" aria-label="${tabCount} ${tabWord}">${tabCount}</span>`;

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
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="${currentAppearance.language === 'en' ? 'Close this tab' : '关闭此标签页'}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('') + (extraCount > 0 ? buildOverflowChips(uniqueTabs.slice(8), urlCounts) : '');

  const cardTools = `
    <div class="card-tools" aria-label="${currentAppearance.language === 'en' ? 'Card actions' : '卡片操作'}">
      <button class="card-action card-action-close" data-action="close-domain-tabs" data-domain-id="${stableId}" aria-label="${currentAppearance.language === 'en' ? `Close all ${tabCount} tabs` : `关闭全部 ${tabCount} 个标签页`}" title="${currentAppearance.language === 'en' ? `Close all ${tabCount} tabs` : `关闭全部 ${tabCount} 个标签页`}">
        ${ICONS.close}
      </button>
      ${hasDupes ? `
        <button class="card-action card-action-duplicate" data-action="dedup-keep-one" data-dupe-urls="${dupeUrlsEncoded}" aria-label="${currentAppearance.language === 'en' ? `Close ${totalExtras} duplicate tabs, keep one` : `关闭 ${totalExtras} 个重复标签页，保留一个`}" title="${currentAppearance.language === 'en' ? `Close ${totalExtras} duplicate tabs, keep one` : `关闭 ${totalExtras} 个重复标签页，保留一个`}">
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
            <span class="mission-name">${isLanding ? (currentAppearance.language === 'en' ? 'Homepages' : '首页') : (group.label || friendlyDomain(group.domain))}</span>
          </div>
          ${cardTools}
        </div>
        <div class="mission-pages">${pageChips}</div>
      </div>
      <div class="mission-meta">
        <div class="mission-page-count">${tabCount}</div>
        <div class="mission-page-label">${currentAppearance.language === 'en' ? 'tabs' : '标签页'}</div>
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

    sidebarContent.innerHTML = validGroups.map((group, index) => {
      const hideHeader = validGroups.length === 1 && group.isRoot;
      return renderBookmarkGroup(group, { depth: 0, path: `${index}`, hideHeader });
    }).join('');

    setupGroupToggleHandlers();
    setupBookmarkFolderDragHandlers();
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

function renderBookmarkGroup(group, { depth, path, hideHeader = false }) {
  const count = getBookmarkCount(group);
  if (count === 0 && !group.id) return '';

  const isOpen = hideHeader;
  const groupName = group.name || (currentAppearance.language === 'en' ? 'Untitled folder' : '未命名文件夹');
  const safeGroupName = escapeHtml(groupName);
  const safeFolderId = escapeAttr(group.id || '');
  const safeParentId = escapeAttr(group.parentId || '');
  const canReorder = !group.isRoot && !hideHeader;
  const dragHandleHtml = canReorder ? `
      <button class="drawer-group-drag-handle" type="button" draggable="true" aria-label="${currentAppearance.language === 'en' ? `Drag to reorder ${escapeAttr(groupName)}` : `拖动排序${escapeAttr(groupName)}`}" title="${currentAppearance.language === 'en' ? 'Drag to reorder' : '拖动排序'}">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="6" r="1.5" /><circle cx="16" cy="6" r="1.5" />
          <circle cx="8" cy="12" r="1.5" /><circle cx="16" cy="12" r="1.5" />
          <circle cx="8" cy="18" r="1.5" /><circle cx="16" cy="18" r="1.5" />
        </svg>
      </button>` : '';

  const headerHtml = hideHeader ? '' : `
    <div class="drawer-group-header bookmark-drop-target" data-bookmark-folder-id="${safeFolderId}" data-bookmark-parent-id="${safeParentId}" aria-expanded="${isOpen ? 'true' : 'false'}">
      <span class="drawer-group-name">${safeGroupName}</span>
      <span class="drawer-group-count">${count}</span>
      <button class="drawer-group-toggle" type="button" aria-label="${currentAppearance.language === 'en' ? `Toggle ${escapeAttr(groupName)}` : `展开或收起${escapeAttr(groupName)}`}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      ${dragHandleHtml}
    </div>`;

  const bookmarksHtml = renderBookmarkItems(group.bookmarks || []);
  const childrenHtml = (group.children || [])
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

    const title = bookmark.title || bookmark.url || (currentAppearance.language === 'en' ? 'Untitled' : '未命名');
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
          parentId: folderNode.parentId,
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
  const openTabsSectionActions = document.getElementById('openTabsSectionActions');

  if (domainGroups.length > 0 && openTabsSection) {
    const tabOutCount = openTabs.filter(tab => tab.isTabOut).length;
    const actionButtons = [];
    if (tabOutCount > 1) {
      actionButtons.push(`<button class="action-btn close-tabs close-tabout-btn" data-action="close-tabout-dupes" aria-label="${t('closeExtras')}" title="${t('closeExtras')}">${ICONS.duplicate}<span class="action-label">${t('closeExtras')}</span></button>`);
    }
    if (realTabs.length > 0) {
      actionButtons.push(`<button class="action-btn close-tabs" data-action="close-all-open-tabs" aria-label="${t('closeAll')}" title="${t('closeAll')}">${ICONS.close}<span class="action-label">${t('closeAll')}</span></button>`);
    }
    if (openTabsSectionActions) openTabsSectionActions.innerHTML = actionButtons.join('');
    openTabsMissionsEl.innerHTML = domainGroups.map(g => renderDomainCard(g)).join('');
    openTabsSection.style.display = 'block';
  } else if (openTabsSection) {
    if (openTabsSectionActions) openTabsSectionActions.replaceChildren();
    openTabsSection.style.display = 'none';
  }

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
  if (e.target.id === 'todoAddModal') {
    closeAddTodoModal();
    return;
  }
  if (e.target.id === 'todoEditModal') {
    closeEditTodoModal();
    return;
  }

  const todoLink = e.target.closest('.todo-link');
  if (todoLink) {
    e.preventDefault();
    const url = normalizeHttpUrl(todoLink.getAttribute('href'));
    if (!url) {
      showToast(t('linkInvalid'));
      return;
    }
    try {
      await chrome.tabs.create({ url });
    } catch (err) {
      showToast(t('linkOpenFailed'));
    }
    return;
  }

  // Walk up the DOM to find the nearest element with data-action
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  // ---- Todo Actions ----
  if (action === 'open-add-todo') {
    showAddTodoModal();
    return;
  }

  if (action === 'toggle-todo-priority') {
    const priority = normalizeTodoPriority(actionEl.dataset.priority);
    if (openTodoPriorities.has(priority)) {
      openTodoPriorities.delete(priority);
    } else {
      openTodoPriorities.add(priority);
    }
    await renderTodoSidebar();
    return;
  }

  if (action === 'add-edit-link' || action === 'add-todo-link') {
    const container = action === 'add-edit-link'
      ? document.getElementById('todoEditLinks')
      : document.getElementById('todoAddLinks');
    const row = appendTodoLinkRow(container);
    row?.querySelector('.todo-link-url')?.focus();
    return;
  }

  if (action === 'remove-link-row') {
    const row = actionEl.closest('.todo-link-row');
    const container = row?.parentElement;
    row?.remove();
    if (container && !container.querySelector('.todo-link-row')) appendTodoLinkRow(container);
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

  if (action === 'cancel-add') {
    closeAddTodoModal();
    return;
  }

  // ---- Close duplicate Tab Out tabs ----
  if (action === 'close-tabout-dupes') {
    await closeTabOutDupes();
    playCloseSound();
    await renderDashboard();
    showToast(currentAppearance.language === 'en' ? 'Closed extra Tab Out tabs' : '已关闭多余标签页');
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

  // ---- Open a bookmark in the current tab ----
  if (action === 'open-bookmark') {
    const url = actionEl.dataset.bookmarkUrl;
    if (!url) return;

    // Record the open time for sorting
    const openTimes = getBookmarkOpenTimes();
    openTimes[url] = Date.now();
    localStorage.setItem('bookmarkOpenTimes', JSON.stringify(openTimes));

    await chrome.tabs.update({ url });
    showToast(t('bookmarkOpened'));
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
    showToast(t('tabClosed'));
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

    showToast(t('duplicatesClosed'));
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

    showToast(t('allTabsClosed'));
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

/* ----------------------------------------------------------------
   TODO LIST FUNCTIONS
   ---------------------------------------------------------------- */

let todos = [];

const TODO_PRIORITY_META = {
  1: { key: 'urgent', colorClass: 'priority-1' },
  2: { key: 'high', colorClass: 'priority-2' },
  3: { key: 'normal', colorClass: 'priority-3' },
  4: { key: 'low', colorClass: 'priority-4' },
  5: { key: 'lowest', colorClass: 'priority-5' }
};

let openTodoPriorities = new Set([3]);
let todoPriorityAccordionInitialized = false;

function normalizeTodoPriority(value) {
  const priority = Number(value);
  return Number.isInteger(priority) && priority >= 1 && priority <= 5 ? priority : 3;
}

function getTodoPriorityLabel(priority) {
  const normalizedPriority = normalizeTodoPriority(priority);
  return `P${normalizedPriority} · ${t(TODO_PRIORITY_META[normalizedPriority].key)}`;
}

function getTodoPriorityOptionsHtml(selectedPriority = 3) {
  const selected = normalizeTodoPriority(selectedPriority);
  return Object.entries(TODO_PRIORITY_META)
    .map(([priority, meta]) => `<option value="${priority}"${Number(priority) === selected ? ' selected' : ''}>${getTodoPriorityLabel(priority)}</option>`)
    .join('');
}

function showAddTodoModal() {
  let modal = document.getElementById('todoAddModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'todoAddModal';
    modal.className = 'todo-edit-modal todo-add-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'todoAddTitle');
    modal.innerHTML = `
      <div class="todo-edit-content">
        <div class="todo-edit-title" id="todoAddTitle">${t('addTask')}</div>
        <form class="todo-edit-form" id="todoAddForm">
          <label class="todo-edit-field">
            <span>${t('name')}</span>
            <input type="text" id="todoAddInput" class="todo-edit-input" placeholder="${t('todoPlaceholder')}" autocomplete="off">
          </label>
          <label class="todo-edit-field">
            <span>${t('priority')}</span>
            <select id="todoAddPriority" class="todo-edit-priority">
              ${getTodoPriorityOptionsHtml()}
            </select>
          </label>
          <label class="todo-edit-field">
            <span>${t('dueDate')}</span>
            <input type="date" id="todoAddDueDate" class="todo-edit-due-date" aria-label="${t('dueDate')}">
          </label>
          <div class="todo-links-editor todo-edit-links-editor">
            <div class="todo-links-editor-heading">
              <span>${t('links')}</span>
              <button type="button" class="todo-link-add-btn" data-action="add-todo-link">+ ${t('addLink')}</button>
            </div>
            <div class="todo-link-fields" id="todoAddLinks"></div>
          </div>
          <div class="todo-edit-buttons">
            <button type="button" class="todo-edit-btn cancel" data-action="cancel-add">${t('cancel')}</button>
            <button type="submit" class="todo-edit-btn primary">${t('add')}</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('todoAddInput').value = '';
  document.getElementById('todoAddPriority').value = '3';
  document.getElementById('todoAddDueDate').value = '';
  resetLinkEditor(document.getElementById('todoAddLinks'));
  modal.classList.add('open');
  document.getElementById('todoAddInput').focus();
}

function closeAddTodoModal() {
  document.getElementById('todoAddModal')?.classList.remove('open');
}

function normalizeHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch (err) {
    return null;
  }
}

function normalizeTodoLink(link) {
  const source = typeof link === 'string' ? { url: link } : (link || {});
  const url = normalizeHttpUrl(source.url || source.href);
  if (!url) return null;

  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch (err) {
    host = url;
  }

  const label = String(source.label || source.title || '').trim() || host;
  return { label, url };
}

function sanitizeTodoLinks(links) {
  const seen = new Set();
  return (Array.isArray(links) ? links : [])
    .map(normalizeTodoLink)
    .filter(link => {
      if (!link || seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    });
}

function normalizeTodo(todo) {
  if (!todo || typeof todo !== 'object') return null;
  const text = String(todo.text || todo.title || '').trim();
  if (!text) return null;

  const links = sanitizeTodoLinks(todo.links);

  return {
    ...todo,
    id: String(todo.id || generateTodoId()),
    text,
    dueDate: todo.dueDate || null,
    links,
    priority: normalizeTodoPriority(todo.priority),
    completed: Boolean(todo.completed),
    completedAt: todo.completedAt || null,
    createdAt: todo.createdAt || new Date().toISOString()
  };
}

async function loadTodos() {
  try {
    const result = await chrome.storage.local.get('tabOutTodos');
    const savedTodos = Array.isArray(result.tabOutTodos) ? result.tabOutTodos : [];
    todos = savedTodos.map(normalizeTodo).filter(Boolean);
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

function formatDate(dateStr, hideOverdue = false) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todoDate = new Date(date);
  todoDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((todoDate - today) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    if (hideOverdue) return null;
    return { text: t('overdue', Math.abs(diffDays)), class: 'deadline-red' };
  }
  if (diffDays <= 1) return { text: diffDays === 0 ? t('today') : t('tomorrow'), class: 'deadline-red' };
  if (diffDays <= 3) return { text: t('daysAfter', diffDays), class: 'deadline-yellow' };
  if (diffDays <= 7) return { text: t('daysAfter', diffDays), class: 'deadline-green' };

  const options = { month: 'numeric', day: 'numeric' };
  return { text: date.toLocaleDateString(currentAppearance.language === 'en' ? 'en-US' : 'zh-CN', options), class: 'deadline-blue' };
}

function formatCompletedDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString(currentAppearance.language === 'en' ? 'en-US' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getTodoLinkLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (err) {
    return url;
  }
}

function createTodoLinkRow(link = {}) {
  const row = document.createElement('div');
  row.className = 'todo-link-row';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'todo-link-label';
  labelInput.placeholder = currentAppearance.language === 'en' ? 'Label' : '名称';
  labelInput.setAttribute('aria-label', currentAppearance.language === 'en' ? 'Link label' : '链接名称');
  labelInput.value = link.label || '';

  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.className = 'todo-link-url';
  urlInput.placeholder = 'https://example.com';
  urlInput.inputMode = 'url';
  urlInput.autocomplete = 'url';
  urlInput.setAttribute('aria-label', currentAppearance.language === 'en' ? 'Link URL' : '链接地址');
  urlInput.value = link.url || '';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'todo-link-remove-btn';
  removeButton.dataset.action = 'remove-link-row';
  removeButton.title = currentAppearance.language === 'en' ? 'Remove link' : '删除链接';
  removeButton.setAttribute('aria-label', currentAppearance.language === 'en' ? 'Remove link' : '删除链接');
  removeButton.textContent = '×';

  row.append(labelInput, urlInput, removeButton);
  return row;
}

function appendTodoLinkRow(container, link = {}) {
  if (!container) return null;
  const row = createTodoLinkRow(link);
  container.appendChild(row);
  return row;
}

function resetLinkEditor(container) {
  if (!container) return;
  container.replaceChildren(createTodoLinkRow());
}

function collectTodoLinks(container) {
  const links = [];
  let invalid = false;
  if (!container) return { links, invalid };

  container.querySelectorAll('.todo-link-row').forEach(row => {
    const labelInput = row.querySelector('.todo-link-label');
    const urlInput = row.querySelector('.todo-link-url');
    const label = labelInput?.value.trim() || '';
    const rawUrl = urlInput?.value.trim() || '';

    labelInput?.removeAttribute('aria-invalid');
    urlInput?.removeAttribute('aria-invalid');
    if (!label && !rawUrl) return;

    const url = normalizeHttpUrl(rawUrl);
    if (!url) {
      invalid = true;
      urlInput?.setAttribute('aria-invalid', 'true');
      return;
    }

    links.push({
      label: label || getTodoLinkLabel(url),
      url
    });
  });

  return { links, invalid };
}

function renderTodoItem(todo) {
  const item = document.createElement('article');
  item.className = `todo-item${todo.completed ? ' completed' : ''}`;
  item.dataset.todoId = todo.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.checked = todo.completed;
  checkbox.dataset.action = 'toggle-todo';
  checkbox.dataset.todoId = todo.id;
  checkbox.setAttribute('aria-label', todo.completed ? t('reactivateTodo', todo.text) : t('completeTodo', todo.text));

  const content = document.createElement('div');
  content.className = 'todo-content';

  const text = document.createElement('span');
  text.className = 'todo-text';
  text.textContent = todo.text;
  content.appendChild(text);

  const dueDateInfo = formatDate(todo.dueDate, todo.completed);
  const completedDate = formatCompletedDate(todo.completedAt);
  let dateMeta = null;
  if (dueDateInfo || completedDate) {
    const meta = document.createElement('div');
    meta.className = 'todo-meta';
    if (dueDateInfo) {
      const badge = document.createElement('span');
      badge.className = `todo-due-date-badge ${dueDateInfo.class}`.trim();
      badge.textContent = dueDateInfo.text;
      meta.appendChild(badge);
    }
    if (completedDate) {
      const completed = document.createElement('span');
      completed.className = 'todo-completed-at';
      completed.textContent = t('completedAt', completedDate);
      meta.appendChild(completed);
    }
    dateMeta = meta;
  }

  if (todo.links.length > 0) {
    const links = document.createElement('div');
    links.className = 'todo-links';
    links.setAttribute('aria-label', t('relatedLinks'));
    todo.links.forEach(link => {
      const anchor = document.createElement('a');
      anchor.className = 'todo-link';
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.title = link.url;
      anchor.textContent = link.label || getTodoLinkLabel(link.url);
      const icon = document.createElement('span');
      icon.className = 'todo-link-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '↗';
      anchor.appendChild(icon);
      links.appendChild(anchor);
    });
    content.appendChild(links);
  }

  const actions = document.createElement('div');
  actions.className = 'todo-actions';

  const editButton = document.createElement('button');
  editButton.className = 'todo-action-btn todo-edit-btn';
  editButton.dataset.action = 'edit-todo';
  editButton.dataset.todoId = todo.id;
  editButton.title = '编辑';
  editButton.setAttribute('aria-label', `编辑${todo.text}`);
  editButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>';

  const deleteButton = document.createElement('button');
  deleteButton.className = 'todo-action-btn todo-delete-btn';
  deleteButton.dataset.action = 'delete-todo';
  deleteButton.dataset.todoId = todo.id;
  deleteButton.title = '删除';
  deleteButton.setAttribute('aria-label', `删除${todo.text}`);
  deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';

  const actionButtons = document.createElement('div');
  actionButtons.className = 'todo-action-buttons';
  actionButtons.append(editButton, deleteButton);
  actions.appendChild(actionButtons);
  if (dateMeta) actions.appendChild(dateMeta);
  item.append(checkbox, content, actions);
  return item;
}

function compareTodoByTime(a, b) {
  const dueA = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
  const dueB = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
  const safeDueA = Number.isFinite(dueA) ? dueA : Number.POSITIVE_INFINITY;
  const safeDueB = Number.isFinite(dueB) ? dueB : Number.POSITIVE_INFINITY;
  if (safeDueA !== safeDueB) return safeDueA - safeDueB;

  const createdA = Date.parse(a.createdAt || '') || 0;
  const createdB = Date.parse(b.createdAt || '') || 0;
  return createdB - createdA;
}

function getActiveTodoGroups() {
  const groups = new Map();
  todos.filter(todo => !todo.completed).forEach(todo => {
    const priority = normalizeTodoPriority(todo.priority);
    if (!groups.has(priority)) groups.set(priority, []);
    groups.get(priority).push(todo);
  });

  groups.forEach(group => group.sort(compareTodoByTime));
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

function renderTodoPriorityGroup(priority, groupTodos) {
  const group = document.createElement('div');
  const meta = TODO_PRIORITY_META[priority];
  const isOpen = openTodoPriorities.has(priority);
  const listId = `todoPriorityList${priority}`;
  group.className = `drawer-group todo-priority-group ${meta.colorClass}`;

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'drawer-group-header todo-priority-header';
  header.dataset.action = 'toggle-todo-priority';
  header.dataset.priority = String(priority);
  header.setAttribute('aria-expanded', String(isOpen));
  header.setAttribute('aria-controls', listId);

  const label = document.createElement('span');
  label.className = 'drawer-group-name todo-priority-group-label';
  label.textContent = getTodoPriorityLabel(priority);

  const count = document.createElement('span');
  count.className = 'drawer-group-count todo-priority-group-count';
  count.textContent = groupTodos.length;

  const chevron = document.createElement('span');
  chevron.className = `drawer-group-toggle todo-priority-toggle${isOpen ? ' open' : ''}`;
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>';
  header.append(label, count, chevron);

  const list = document.createElement('div');
  list.className = 'drawer-group-content todo-priority-list';
  list.id = listId;
  list.hidden = !isOpen;
  groupTodos.forEach(todo => list.appendChild(renderTodoItem(todo)));

  group.append(header, list);
  return group;
}

async function renderTodoSidebar() {
  await loadTodos();

  const activeGroups = getActiveTodoGroups();
  const activeTodos = activeGroups.flatMap(([, group]) => group);
  if (!todoPriorityAccordionInitialized && activeGroups.length > 0) {
    openTodoPriorities.add(activeGroups[0][0]);
    todoPriorityAccordionInitialized = true;
  }
  
  // 已完成的任务按完成时间排序（最新完成的在前）
  const completedTodos = todos.filter(t => t.completed).sort((a, b) => {
    const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return timeB - timeA;
  });
  
  const activeTodoList = document.getElementById('activeTodoList');
  const completedTodoList = document.getElementById('completedTodoList');
  const completedTodoCount = document.getElementById('completedTodoCount');
  const todoStats = document.getElementById('todoStats');
  
  const activeCount = activeTodos.length;
  const completedCount = completedTodos.length;
  
  // Render active todos grouped by priority.
  if (activeCount === 0) {
    activeTodoList.replaceChildren();
  } else {
    const fragment = document.createDocumentFragment();
    activeGroups.forEach(([priority, groupTodos]) => {
      fragment.appendChild(renderTodoPriorityGroup(priority, groupTodos));
    });
    activeTodoList.replaceChildren(fragment);
  }
  
  // Render completed todos
  if (completedCount === 0) {
    completedTodoList.replaceChildren();
  } else {
    const fragment = document.createDocumentFragment();
    completedTodos.forEach(todo => fragment.appendChild(renderTodoItem(todo)));
    completedTodoList.replaceChildren(fragment);
  }
  
  // Update counts
  if (completedTodoCount) completedTodoCount.textContent = completedCount;
  
  if (todoStats) {
    const activeCountEl = document.createElement('span');
    activeCountEl.className = 'todo-active-count';
    activeCountEl.textContent = activeCount;
    todoStats.replaceChildren(activeCountEl, document.createTextNode(` ${t('activeSuffix')}`));
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
        <div class="todo-edit-title" id="todoEditTitle">${t('editTodo')}</div>
        <form class="todo-edit-form" id="todoEditForm">
          <input type="hidden" id="todoEditId">
          <label class="todo-edit-field">
            <span>${t('name')}</span>
            <input type="text" id="todoEditText" class="todo-edit-input" placeholder="${t('todoPlaceholder')}" autocomplete="off">
          </label>
          <label class="todo-edit-field">
            <span>${t('priority')}</span>
            <select id="todoEditPriority" class="todo-edit-priority">
              ${getTodoPriorityOptionsHtml(todo.priority)}
            </select>
          </label>
          <label class="todo-edit-field">
            <span>${t('dueDate')}</span>
            <input type="date" id="todoEditDueDate" class="todo-edit-due-date">
          </label>
          <div class="todo-links-editor todo-edit-links-editor">
            <div class="todo-links-editor-heading">
              <span>${t('links')}</span>
              <button type="button" class="todo-link-add-btn" data-action="add-edit-link">+ ${t('addLink')}</button>
            </div>
            <div class="todo-link-fields" id="todoEditLinks"></div>
          </div>
          <div class="todo-edit-buttons">
            <button type="button" class="todo-edit-btn cancel" data-action="cancel-edit">${t('cancel')}</button>
            <button type="submit" class="todo-edit-btn primary">${t('save')}</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('todoEditId').value = todo.id;
  document.getElementById('todoEditText').value = todo.text;
  document.getElementById('todoEditPriority').value = String(normalizeTodoPriority(todo.priority));
  document.getElementById('todoEditDueDate').value = todo.dueDate || '';

  const linksContainer = document.getElementById('todoEditLinks');
  linksContainer.replaceChildren();
  todo.links.forEach(link => appendTodoLinkRow(linksContainer, link));
  if (todo.links.length === 0) appendTodoLinkRow(linksContainer);
  
  modal.classList.add('open');
  document.getElementById('todoEditText').focus();
}

function closeEditTodoModal() {
  const modal = document.getElementById('todoEditModal');
  if (modal) {
    modal.classList.remove('open');
  }
}

async function addTodo(text, dueDate, links = [], priority = 3) {
  if (!text.trim()) {
    showToast(t('enterName'));
    return false;
  }
  
  const newTodo = {
    id: generateTodoId(),
    text: text.trim(),
    dueDate: dueDate || null,
    links: sanitizeTodoLinks(links),
    priority: normalizeTodoPriority(priority),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString()
  };
  
  todos.unshift(newTodo);
  await saveTodos();
  await renderTodoSidebar();
  
    showToast('已添加待办');
  return true;
}

async function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  
  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? new Date().toISOString() : null;
  
  await saveTodos();
  await renderTodoSidebar();
  
  showToast(todo.completed ? '已完成待办' : '已恢复待办');
}

async function updateTodo(id, text, dueDate, links = [], priority = 3) {
  if (!text.trim()) {
    showToast(t('enterName'));
    return false;
  }
  
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  
  todo.text = text.trim();
  todo.dueDate = dueDate || null;
  todo.links = sanitizeTodoLinks(links);
  todo.priority = normalizeTodoPriority(priority);
  
  await saveTodos();
  await renderTodoSidebar();
  
  showToast('已更新待办');
  return true;
}

async function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  await saveTodos();
  await renderTodoSidebar();
  
  showToast('已删除待办');
}

// ---- Todo edit form submit ----
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'todoAddForm') {
    e.preventDefault();
    const text = document.getElementById('todoAddInput').value;
    const priority = document.getElementById('todoAddPriority').value;
    const dueDate = document.getElementById('todoAddDueDate').value;
    const linksResult = collectTodoLinks(document.getElementById('todoAddLinks'));
    if (linksResult.invalid) {
      showToast(t('linkInvalid'));
      return;
    }

    const added = await addTodo(text, dueDate, linksResult.links, priority);
    if (added) closeAddTodoModal();
    return;
  }

  if (e.target.id === 'todoEditForm') {
    e.preventDefault();
    const id = document.getElementById('todoEditId').value;
    const text = document.getElementById('todoEditText').value;
    const priority = document.getElementById('todoEditPriority').value;
    const dueDate = document.getElementById('todoEditDueDate').value;
    const linksResult = collectTodoLinks(document.getElementById('todoEditLinks'));
    if (linksResult.invalid) {
      showToast(t('linkInvalid'));
      return;
    }

    const updated = await updateTodo(id, text, dueDate, linksResult.links, priority);
    if (updated) closeEditTodoModal();
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
      closeAddTodoModal();
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
      const isFolderDrag = e.dataTransfer?.types.includes('application/x-tab-out-folder');
      const isTabDrag = e.dataTransfer?.types.includes('application/x-tab-out-tab');

      if (isFolderDrag) {
        if (!target.classList.contains('drawer-group-header') || !target.dataset.bookmarkParentId) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const dropAfter = e.clientY > target.getBoundingClientRect().top + target.offsetHeight / 2;
        clearBookmarkFolderDropPreview();
        target.classList.add(dropAfter ? 'folder-drop-after' : 'folder-drop-before');
        return;
      }

      if (!isTabDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      target.classList.add('drop-ready');
    });

    target.addEventListener('dragleave', (e) => {
      if (!target.contains(e.relatedTarget)) {
        target.classList.remove('drop-ready');
        target.classList.remove('folder-drop-before', 'folder-drop-after');
      }
    });

    target.addEventListener('drop', async (e) => {
      const folderDragId = e.dataTransfer?.getData('application/x-tab-out-folder');
      if (folderDragId) {
        if (!target.classList.contains('drawer-group-header') || !target.dataset.bookmarkParentId) return;
        e.preventDefault();
        e.stopPropagation();

        try {
          const targetId = target.dataset.bookmarkFolderId;
          const parentId = target.dataset.bookmarkParentId;
          const dropAfter = target.classList.contains('folder-drop-after');
          clearBookmarkFolderDropPreview();
          await reorderBookmarkFolder(folderDragId, targetId, parentId, dropAfter);
          await renderBookmarksSidebar();
        } catch (err) {
          console.error('[tab-out] Failed to reorder bookmark folder:', err);
          showToast(t('folderReorderFailed'));
        }
        return;
      }

      e.preventDefault();
      target.classList.remove('drop-ready');
      const folderId = target.dataset.bookmarkFolderId;
      const serializedTab = e.dataTransfer?.getData('application/x-tab-out-tab');
      if (!folderId || !serializedTab) return;

      try {
        const tab = JSON.parse(serializedTab);
        await saveTabToBookmarkFolder(folderId, tab);
        await renderBookmarksSidebar();
        showToast(t('bookmarkSaved'));
      } catch (err) {
        console.error('[tab-out] Failed to save dragged tab:', err);
        showToast(t('bookmarkSaveFailed'));
      }
    });
  });
}

function clearBookmarkFolderDropPreview() {
  document.querySelectorAll('.drawer-group-header.folder-drop-before, .drawer-group-header.folder-drop-after').forEach(target => {
    target.classList.remove('folder-drop-before', 'folder-drop-after');
  });
}

async function reorderBookmarkFolder(folderId, targetId, parentId, dropAfter) {
  if (!folderId || !targetId || folderId === targetId || !parentId) return;

  const children = await new Promise((resolve, reject) => {
    chrome.bookmarks.getChildren(parentId, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(items);
    });
  });

  const source = children.find(item => item.id === folderId);
  const target = children.find(item => item.id === targetId);
  if (!source || !target || source.url || target.url) return;

  const remaining = children.filter(item => item.id !== folderId);
  const targetIndex = remaining.findIndex(item => item.id === targetId);
  if (targetIndex < 0) return;

  const index = targetIndex + (dropAfter ? 1 : 0);
  const nextOrder = remaining.map(item => item.id);
  nextOrder.splice(index, 0, folderId);
  if (children.every((item, currentIndex) => item.id === nextOrder[currentIndex])) return;

  const destinationIndex = source.index < index ? index + 1 : index;

  await new Promise((resolve, reject) => {
    chrome.bookmarks.move(folderId, { parentId, index: destinationIndex }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function setupBookmarkFolderDragHandlers() {
  document.querySelectorAll('.drawer-group-drag-handle[draggable="true"]').forEach(handle => {
    handle.addEventListener('pointerdown', (e) => e.stopPropagation());
    handle.addEventListener('click', (e) => e.stopPropagation());

    handle.addEventListener('dragstart', (e) => {
      const header = handle.closest('.drawer-group-header');
      const folderId = header?.dataset.bookmarkFolderId;
      if (!folderId || !e.dataTransfer) return;

      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-tab-out-folder', folderId);
      handle.classList.add('dragging');
    });

    handle.addEventListener('dragend', () => {
      handle.classList.remove('dragging');
      clearBookmarkFolderDropPreview();
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
 * Sets up the tab and bookmark search functionality.
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
 * Performs real-time search on open tabs and bookmarks.
 */
async function performSearch(query) {
  const searchResults = document.getElementById('searchResults');
  
  if (!query || !searchResults) {
    searchResults.innerHTML = '';
    searchResults.classList.remove('open');
    document.getElementById('searchInput')?.setAttribute('aria-expanded', 'false');
    return;
  }

  const [tabs, bookmarkGroups] = await Promise.all([
    chrome.tabs.query({}),
    getAllBookmarks()
  ]);

  const currentQuery = document.getElementById('searchInput')?.value.trim().toLowerCase();
  if (currentQuery !== query) return;
  
  // Filter tabs (exclude Chrome internal pages)
  const filteredTabs = tabs.filter(tab => 
    tab.url && 
    !tab.url.startsWith('chrome://') && 
    !tab.url.startsWith('about:')
  );

  // Filter by title or URL containing the query
  const matchingTabs = filteredTabs.filter(tab => {
    const title = (tab.title || '').toLowerCase();
    const url = (tab.url || '').toLowerCase();
    return title.includes(query) || url.includes(query);
  });

  const matchingBookmarks = flattenBookmarks(bookmarkGroups).filter(bookmark => {
    const title = (bookmark.title || '').toLowerCase();
    const url = (bookmark.url || '').toLowerCase();
    return title.includes(query) || url.includes(query);
  });

  const results = [
    ...matchingTabs.map(tab => ({ type: 'tab', ...tab })),
    ...matchingBookmarks.map(bookmark => ({ type: 'bookmark', ...bookmark }))
  ];

  if (results.length === 0) {
    searchResults.innerHTML = `
      <div class="search-no-results">
        ${escapeHtml(t('noSearchResults', query))}
      </div>
    `;
    searchResults.classList.add('open');
    document.getElementById('searchInput')?.setAttribute('aria-expanded', 'true');
    return;
  }

  // Render results with highlighted matches
  searchResults.innerHTML = results.map((result, index) => {
    const isActive = index === 0;
    let domain = '';
    let faviconUrl = '';
    
    try {
      const parsed = new URL(result.url);
      domain = parsed.hostname.replace(/^www\./, '');
      faviconUrl = getFaviconUrl(result.url);
    } catch (e) {
      domain = result.url;
    }

    const highlightedTitle = highlightMatch(result.title || result.url || 'Untitled', query);
    const resultLabel = result.type === 'bookmark' ? 'Bookmark' : 'Tab';
    const highlightedDomain = highlightMatch(`${resultLabel} · ${domain}`, query);
    const resultData = result.type === 'bookmark'
      ? `data-bookmark-url="${escapeAttr(result.url || '')}"`
      : `data-tab-id="${result.id}"`;

    return `
      <div 
        class="search-result-item ${isActive ? 'active' : ''}" 
        role="option"
        aria-selected="${isActive ? 'true' : 'false'}"
        data-result-type="${result.type}"
        ${resultData}
        title="${escapeAttr(result.title || result.url || '')}"
      >
        ${faviconUrl ? `<img class="search-result-favicon" src="${escapeAttr(faviconUrl)}" alt="" data-favicon data-domain="${escapeAttr(domain)}">` : ''}
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

function flattenBookmarks(groups) {
  const bookmarks = [];

  function visit(group) {
    for (const bookmark of group.bookmarks || []) {
      if (bookmark?.url) bookmarks.push(bookmark);
    }
    for (const child of group.children || []) visit(child);
  }

  for (const group of groups || []) visit(group);
  return bookmarks;
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
 * Activates the selected tab or opens the selected bookmark.
 */
async function activateSearchResult(item) {
  if (item.dataset.resultType === 'bookmark') {
    const url = item.dataset.bookmarkUrl;
    if (!url) return;

    try {
      const openTimes = getBookmarkOpenTimes();
      openTimes[url] = Date.now();
      localStorage.setItem('bookmarkOpenTimes', JSON.stringify(openTimes));
      await chrome.tabs.update({ url });
      closeSearch();
    } catch (err) {
      console.error('[tab-out] Failed to open bookmark search result:', err);
    }
    return;
  }

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

  if (currentAppearance.palette === 'rosewood') {
    currentAppearance.palette = 'custom';
    currentAppearance.customColors = normalizeCustomColors(currentAppearance.customColors, PALETTES.rosewood);
  }

  const palette = currentAppearance.palette === 'custom'
    ? createCustomPalette(currentAppearance.customColors)
    : PALETTES[currentAppearance.palette] || PALETTES.forest;
  for (const [name, value] of Object.entries(palette)) {
    document.documentElement.style.setProperty(name, value);
  }

  document.documentElement.style.setProperty('--bg-mask-opacity', String(currentAppearance.mask / 100));
  setEffectsEnabled(currentAppearance.effectsEnabled);
  applyLanguage(currentAppearance.language);
  refreshAutoContrast();

  syncAppearanceControls();
}

function syncAppearanceControls() {
  const maskRange = document.getElementById('backgroundMaskRange');
  const maskValue = document.getElementById('backgroundMaskValue');
  const effectsToggle = document.getElementById('effectsToggle');
  const languageSelect = document.getElementById('languageSelect');
  const customColorsPanel = document.getElementById('customColorsPanel');

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

  if (customColorsPanel) {
    customColorsPanel.hidden = currentAppearance.palette !== 'custom';
  }
  if (languageSelect) languageSelect.value = currentAppearance.language === 'en' ? 'en' : 'zh';

  const customColors = normalizeCustomColors(currentAppearance.customColors);
  document.querySelectorAll('[data-color-var]').forEach(input => {
    const name = input.dataset.colorVar;
    if (!name || !customColors[name]) return;
    input.value = customColors[name];
    const output = document.querySelector(`[data-color-value="${name}"]`);
    if (output) output.textContent = customColors[name].toUpperCase();
  });

  const customSwatch = document.querySelector('.palette-swatch[data-palette="custom"]');
  if (customSwatch) {
    customSwatch.style.setProperty('--custom-paper', customColors['--paper']);
    customSwatch.style.setProperty('--custom-primary', customColors['--accent-amber']);
    customSwatch.style.setProperty('--custom-secondary', customColors['--accent-sage']);
  }
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
  const languageSelect = document.getElementById('languageSelect');
  const customColorsPanel = document.getElementById('customColorsPanel');

  if (!panel || !toggle || !chooseBtn || !clearBtn || !input || !maskRange || !paletteRow || !effectsToggle || !languageSelect || !customColorsPanel) return;

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
      showToast(t('imageTooLarge'));
      input.value = '';
      return;
    }

    try {
      await saveBackgroundFile(file);
      applyBackgroundUrl(URL.createObjectURL(file));
      await saveAppearance({ hasBackgroundImage: true });
      showToast(t('backgroundUpdated'));
    } catch {
      showToast(t('backgroundUpdateFailed'));
    }

    input.value = '';
  });

  clearBtn.addEventListener('click', async () => {
    await clearBackgroundFile();
    applyBackgroundUrl('');
    await saveAppearance({ hasBackgroundImage: false });
    showToast(t('backgroundCleared'));
  });

  maskRange.addEventListener('input', async (e) => {
    await saveAppearance({ mask: Number(e.target.value) });
  });

  effectsToggle.addEventListener('change', async (e) => {
    await saveAppearance({ effectsEnabled: e.target.checked });
  });

  languageSelect.addEventListener('change', async (e) => {
    const language = e.target.value === 'en' ? 'en' : 'zh';
    await saveAppearance({ language });
    await renderDashboard();
  });

  paletteRow.addEventListener('click', async (e) => {
    const button = e.target.closest('.palette-swatch');
    if (!button) return;
    const paletteName = button.dataset.palette || 'forest';

    if (paletteName === 'custom') {
      const fallbackPalette = PALETTES[currentAppearance.palette] || PALETTES.forest;
      const customColors = normalizeCustomColors(currentAppearance.customColors, fallbackPalette);
      await saveAppearance({ palette: 'custom', customColors });
      return;
    }

    await saveAppearance({ palette: paletteName });
  });

  customColorsPanel.addEventListener('change', async (e) => {
    const colorInput = e.target.closest('input[type="color"][data-color-var]');
    if (!colorInput) return;

    const customColors = normalizeCustomColors(currentAppearance.customColors);
    customColors[colorInput.dataset.colorVar] = colorInput.value.toLowerCase();
    await saveAppearance({ palette: 'custom', customColors });
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
