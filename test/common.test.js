const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// src/common.js is written as a plain browser script (no module.exports), so it is
// loaded into a fresh vm context here instead of being modified for testability.
function loadCommon() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'common.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

const { normalizeSettings, matchesNgWords, isChannelBlocked } = loadCommon();

test('normalizeSettings', async (t) => {
  await t.test('returns empty arrays for missing input', () => {
    assert.deepEqual(normalizeSettings(undefined), { ngWords: [], blockedChannels: [] });
    assert.deepEqual(normalizeSettings(null), { ngWords: [], blockedChannels: [] });
    assert.deepEqual(normalizeSettings({}), { ngWords: [], blockedChannels: [] });
  });

  await t.test('lowercases and trims ngWords, keeps valid target', () => {
    const result = normalizeSettings({
      ngWords: [{ word: '  Example  ', target: 'title' }],
    });
    assert.deepEqual(result.ngWords, [{ word: 'example', target: 'title' }]);
  });

  await t.test('falls back to "both" for an invalid target', () => {
    const result = normalizeSettings({
      ngWords: [{ word: 'foo', target: 'invalid' }],
    });
    assert.equal(result.ngWords[0].target, 'both');
  });

  await t.test('drops ngWords entries with an empty or missing word', () => {
    const result = normalizeSettings({
      ngWords: [{ word: '' }, { word: '   ' }, { target: 'title' }, { word: 'ok', target: 'both' }],
    });
    assert.deepEqual(result.ngWords, [{ word: 'ok', target: 'both' }]);
  });

  await t.test('trims blockedChannels name/handle and drops empty entries', () => {
    const result = normalizeSettings({
      blockedChannels: [
        { name: '  Some Channel  ', handle: ' @handle ' },
        { name: '', handle: '' },
        { name: '   ' },
      ],
    });
    assert.deepEqual(result.blockedChannels, [{ name: 'Some Channel', handle: '@handle' }]);
  });

  await t.test('keeps a blockedChannels entry with only a handle', () => {
    const result = normalizeSettings({
      blockedChannels: [{ handle: '@handle-only' }],
    });
    assert.deepEqual(result.blockedChannels, [{ name: '', handle: '@handle-only' }]);
  });
});

test('matchesNgWords', async (t) => {
  await t.test('target "title" only checks the title', () => {
    const ngWords = [{ word: 'foo', target: 'title' }];
    assert.equal(matchesNgWords('a foo video', 'some channel', ngWords), true);
    assert.equal(matchesNgWords('a video', 'foo channel', ngWords), false);
  });

  await t.test('target "channel" only checks the channel name', () => {
    const ngWords = [{ word: 'foo', target: 'channel' }];
    assert.equal(matchesNgWords('foo video', 'some channel', ngWords), false);
    assert.equal(matchesNgWords('a video', 'foo channel', ngWords), true);
  });

  await t.test('target "both" matches title OR channel', () => {
    const ngWords = [{ word: 'foo', target: 'both' }];
    assert.equal(matchesNgWords('foo video', 'some channel', ngWords), true);
    assert.equal(matchesNgWords('a video', 'foo channel', ngWords), true);
    assert.equal(matchesNgWords('a video', 'some channel', ngWords), false);
  });

  await t.test('matching is case-insensitive', () => {
    const ngWords = [{ word: 'foo', target: 'both' }];
    assert.equal(matchesNgWords('A FOO Video', 'some channel', ngWords), true);
  });

  await t.test('returns false when there are no ngWords', () => {
    assert.equal(matchesNgWords('anything', 'anything', []), false);
  });
});

test('isChannelBlocked', async (t) => {
  await t.test('matches by exact handle when the entry has a handle', () => {
    const blockedChannels = [{ name: 'Name', handle: '@handle' }];
    assert.equal(isChannelBlocked('Different Name', '@handle', blockedChannels), true);
  });

  await t.test('does not fall back to name when the entry has a handle', () => {
    const blockedChannels = [{ name: 'Name', handle: '@handle' }];
    assert.equal(isChannelBlocked('Name', '@different-handle', blockedChannels), false);
  });

  await t.test('falls back to exact name match when the entry has no handle', () => {
    const blockedChannels = [{ name: 'Name', handle: '' }];
    assert.equal(isChannelBlocked('Name', '', blockedChannels), true);
    assert.equal(isChannelBlocked('Name', '@some-handle', blockedChannels), true);
  });

  await t.test('returns false when nothing matches', () => {
    const blockedChannels = [{ name: 'Name', handle: '@handle' }];
    assert.equal(isChannelBlocked('Other Name', '@other-handle', blockedChannels), false);
  });
});
