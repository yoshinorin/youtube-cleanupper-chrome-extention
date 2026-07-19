const BLOCK_CHANNEL_MENU_ID = 'ycu-block-channel';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: BLOCK_CHANNEL_MENU_ID,
    title: chrome.i18n.getMessage('contextMenuBlock'),
    contexts: ['all'],
    documentUrlPatterns: ['*://www.youtube.com/*'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === BLOCK_CHANNEL_MENU_ID && tab && tab.id !== undefined) {
    chrome.tabs.sendMessage(tab.id, { type: 'ycu-block-channel' });
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
