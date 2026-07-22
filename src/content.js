// Selectors are kept together here because YouTube's DOM/class names change frequently.
const FILTER_ITEM_SELECTOR = 'ytd-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model';
const CONTEXT_MENU_ITEM_SELECTOR = `${FILTER_ITEM_SELECTOR}, ytd-rich-item-renderer, ytd-channel-renderer`;
const HIDDEN_CLASS = 'ycu-hidden';
const APPLY_FILTERS_THROTTLE_MS = 150;

// Related-videos chip labels. Position isn't guaranteed, so chips are matched by text.
const HIDDEN_CHIP_LABELS = ['すべて', 'all', 'おすすめ', 'recommended'];
const DEFAULT_CHIP_LABELS = ['関連動画', 'related'];

// The live chat panel is rendered inside its own iframe (a separate document),
// not the main watch page. Its "close" button has aria-label "閉じる" / "Close".
const LIVE_CHAT_CLOSE_BUTTON_SELECTOR = '#close-button button';

// The autoplay toggle on watch pages, `aria-pressed="true"` when autoplay is on.
const AUTOPLAY_TOGGLE_SELECTOR = 'ytd-autonav-toggle-button-renderer #toggle';

let settings = { ngWords: [], blockedChannels: [] };
let applyFiltersTimer = null;
let lastRelatedChipVideoId = null;
let liveChatClosed = false;
let autoplayHandled = false;
let pendingChannelInfo = null;

function isFilterablePage() {
  return location.pathname === '/results' || location.pathname === '/watch';
}

function getTitle(item) {
  const el = item.querySelector('#video-title') || item.querySelector('h3');
  return el ? el.textContent.trim() : '';
}

function getChannelName(item) {
  const el = item.querySelector('ytd-channel-name');
  if (el?.textContent.trim()) return el.textContent.trim();

  const metadataView = item.querySelector('yt-content-metadata-view-model');
  if (metadataView) {
    const span = metadataView.querySelector('span');
    if (span?.textContent.trim()) return span.textContent.trim();
  }

  return '';
}

function getChannelHandle(item) {
  const link =
    item.querySelector('ytd-channel-name a[href]') ||
    item.querySelector('a[href*="/@"]') ||
    item.querySelector('a[href*="/channel/"]');
  if (!link) return '';

  const href = link.getAttribute('href') || '';
  const match = href.match(/\/(@[^/?]+)|\/channel\/(UC[\w-]+)/);
  if (!match) return '';

  return match[1] || match[2] || '';
}

function isShortItem(item) {
  return !!item.querySelector('a[href^="/shorts/"]');
}

function applyFilters() {
  if (!isFilterablePage()) return;

  const items = document.querySelectorAll(FILTER_ITEM_SELECTOR);
  items.forEach((item) => {
    const title = getTitle(item);
    const channelName = getChannelName(item);
    const handle = getChannelHandle(item);

    let hidden =
      matchesNgWords(title, channelName, settings.ngWords) ||
      isChannelBlocked(channelName, handle, settings.blockedChannels);

    if (location.pathname === '/results' && isShortItem(item)) {
      hidden = true;
    }

    item.classList.toggle(HIDDEN_CLASS, hidden);
  });

  if (location.pathname === '/watch') {
    applyRelatedChips();
    disableAutoplayIfEnabled();
  }
}

function disableAutoplayIfEnabled() {
  if (autoplayHandled) return;

  const toggle = document.querySelector(AUTOPLAY_TOGGLE_SELECTOR);
  if (!toggle) return;

  autoplayHandled = true;
  if (toggle.getAttribute('aria-pressed') === 'true') {
    toggle.click();
  }
}

function getChipLabel(chip) {
  return chip.textContent.trim().toLowerCase();
}

function applyRelatedChips() {
  const chips = document.querySelectorAll('#related yt-chip-cloud-chip-renderer');
  if (chips.length === 0) return;

  const visibleChips = [];
  chips.forEach((chip) => {
    const hidden = HIDDEN_CHIP_LABELS.includes(getChipLabel(chip));
    chip.classList.toggle(HIDDEN_CLASS, hidden);
    if (!hidden) visibleChips.push(chip);
  });

  selectDefaultChip(visibleChips);
}

function selectDefaultChip(visibleChips) {
  const videoId = new URLSearchParams(location.search).get('v');
  if (!videoId || videoId === lastRelatedChipVideoId || visibleChips.length === 0) return;

  const relatedChip = visibleChips.find((chip) => DEFAULT_CHIP_LABELS.includes(getChipLabel(chip)));

  lastRelatedChipVideoId = videoId;
  (relatedChip || visibleChips[0]).click();
}

function collapseLiveChatIfInChatFrame() {
  if (liveChatClosed) return;

  const closeButton = document.querySelector(LIVE_CHAT_CLOSE_BUTTON_SELECTOR);
  if (!closeButton) return;

  liveChatClosed = true;
  closeButton.click();
}

function scheduleApplyFilters() {
  if (applyFiltersTimer) return;
  applyFiltersTimer = setTimeout(() => {
    applyFiltersTimer = null;
    applyFilters();
  }, APPLY_FILTERS_THROTTLE_MS);
}

function loadSettings() {
  chrome.storage.local.get('settings', (data) => {
    settings = normalizeSettings(data.settings);
    applyFilters();
  });
}

function addBlockedChannel(info) {
  chrome.storage.local.get('settings', (data) => {
    const current = normalizeSettings(data.settings);
    const alreadyBlocked = current.blockedChannels.some(
      (entry) =>
        (info.handle && entry.handle === info.handle) ||
        (!info.handle && info.name && entry.name === info.name),
    );
    if (alreadyBlocked) return;

    current.blockedChannels.push({ name: info.name, handle: info.handle });
    chrome.storage.local.set({ settings: current });
  });
}

if (window.top === window.self) {
  // Main watch/search page.
  document.addEventListener(
    'contextmenu',
    (event) => {
      const item = event.target.closest(CONTEXT_MENU_ITEM_SELECTOR);
      if (!item) {
        pendingChannelInfo = null;
        return;
      }

      const name = getChannelName(item);
      const handle = getChannelHandle(item);
      pendingChannelInfo = name || handle ? { name, handle } : null;
    },
    true,
  );

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'ycu-block-channel' && pendingChannelInfo) {
      addBlockedChannel(pendingChannelInfo);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      settings = normalizeSettings(changes.settings.newValue);
      applyFilters();
    }
  });

  new MutationObserver(scheduleApplyFilters).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  document.addEventListener('yt-navigate-finish', scheduleApplyFilters);

  loadSettings();
} else {
  // Live chat iframe: just close it once, then leave it alone.
  new MutationObserver(collapseLiveChatIfInChatFrame).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  collapseLiveChatIfInChatFrame();
}
