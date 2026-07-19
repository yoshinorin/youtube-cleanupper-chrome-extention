// Shared helpers used by both content.js (content script) and options.js (options page).

const NG_WORD_TARGETS = ['title', 'channel', 'both'];

function normalizeSettings(raw) {
  const settings = { ngWords: [], blockedChannels: [] };

  if (raw && Array.isArray(raw.ngWords)) {
    settings.ngWords = raw.ngWords
      .filter((entry) => entry && typeof entry.word === 'string' && entry.word.trim() !== '')
      .map((entry) => ({
        word: entry.word.trim().toLowerCase(),
        target: NG_WORD_TARGETS.includes(entry.target) ? entry.target : 'both',
      }));
  }

  if (raw && Array.isArray(raw.blockedChannels)) {
    settings.blockedChannels = raw.blockedChannels
      .filter(
        (entry) => entry && (typeof entry.name === 'string' || typeof entry.handle === 'string'),
      )
      .map((entry) => ({
        name: typeof entry.name === 'string' ? entry.name.trim() : '',
        handle: typeof entry.handle === 'string' ? entry.handle.trim() : '',
      }))
      .filter((entry) => entry.name !== '' || entry.handle !== '');
  }

  return settings;
}

function matchesNgWords(title, channelName, ngWords) {
  const normalizedTitle = (title || '').toLowerCase();
  const normalizedChannel = (channelName || '').toLowerCase();
  return ngWords.some(({ word, target }) => {
    if (target === 'title') return normalizedTitle.includes(word);
    if (target === 'channel') return normalizedChannel.includes(word);
    return normalizedTitle.includes(word) || normalizedChannel.includes(word);
  });
}

function isChannelBlocked(channelName, handle, blockedChannels) {
  return blockedChannels.some((entry) => {
    if (entry.handle) return !!handle && entry.handle === handle;
    return !!entry.name && !!channelName && entry.name === channelName;
  });
}
