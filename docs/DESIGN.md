# YouTube Cleanupper — Design Notes

Architecture and implementation notes for this extension. See [README.md](../README.md) for user-facing feature documentation and [DEVELOPMENT.md](./DEVELOPMENT.md) for contributor workflow.

## Confirmed spec decisions

1. NG word target `both` is **OR** (hidden if the word appears in either the title or the channel name)
2. Channel blocking uses Chrome's **context menu** (`contextMenus` API)
3. There are **no** per-feature on/off toggles (all features are always active; the only user settings are NG words and the blocked-channel list)
4. UI supports **Japanese / English** (`_locales` + `chrome.i18n`, `default_locale: en`)

## Architecture

Manifest V3. No build tools (plain JS/CSS/HTML). No external runtime dependencies.

```
src/
  manifest.json
  icons/icon16.png, icon32.png, icon48.png, icon128.png
  _locales/en/messages.json
  _locales/ja/messages.json
  background.js          # Service worker: context menu handling
  common.js               # Shared helpers (settings normalization, matching), used by content.js and options.js
  content.js              # Filtering logic, injected into youtube.com
  content.css             # Static hide rules
  options.html / options.js / options.css
scripts/
  generate-icons.ps1      # Regenerates the icons (Windows/GDI+, see DEVELOPMENT.md)
```

### manifest.json

- `permissions`: `storage`, `contextMenus`
- `host_permissions`: `*://www.youtube.com/*`
- `content_scripts`: injects `common.js` + `content.js` + `content.css` at `document_idle`, with **`all_frames: true`** (needed so the script also runs inside the live chat iframe — see "Live chat auto-close" below)
- `options_page` set; `action` has no popup (clicking the toolbar icon opens the options page directly)
- `icons` / `action.default_icon` point at `icons/icon{16,32,48,128}.png`

## Settings schema

Stored under the `settings` key in `chrome.storage.local`:

```json
{
  "ngWords": [
    { "word": "example", "target": "title | channel | both" }
  ],
  "blockedChannels": [
    { "name": "Channel Name", "handle": "@handle or UCxxxx (empty string if unavailable)" }
  ]
}
```

- Always run `normalizeSettings()` on load to validate/repair the shape (drop invalid entries, fall back invalid `target` values to `both`). Used by both `content.js` and `options.js` via `common.js`.
- NG word matching: lower-cased substring match. `both` is OR.
- Blocked-channel matching: prefer an exact `handle` match when the entry has one; otherwise fall back to an exact `name` match.

## content.js design

- Loads settings from `storage.local` and stays in sync via `chrome.storage.onChanged`
- Fires `applyFilters()` from a `MutationObserver` (`document.documentElement`, subtree) and the `yt-navigate-finish` event, throttled to ~150ms
- Hiding is done by toggling the CSS class `ycu-hidden { display: none !important; }`. YouTube reuses DOM nodes, so **the class must always be removed once an item no longer matches** (implemented with `classList.toggle`, not just `add`)

### Filter target selectors

- Filter targets (search results and related videos only; the home page is out of scope per spec):
  `ytd-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model`
- Right-click extraction targets (includes the home page): the above + `ytd-rich-item-renderer, ytd-channel-renderer`
- Page detection: search = `location.pathname === '/results'`, watch = `/watch`

### Extracting video info

- Title: `#video-title`, falling back to `h3`
- Channel name: `ytd-channel-name`, falling back (new lockup layout) to the first `span` inside `yt-content-metadata-view-model`
- Handle: extracted from `ytd-channel-name a[href]` / `a[href*="/@"]` / `a[href*="/channel/"]` via the regex `\/(@[^/?]+)|\/channel\/(UC[\w-]+)`

### Hiding Shorts (search results only)

- CSS (`content.css`): hides `ytd-search ytd-reel-shelf-renderer` and `ytd-search grid-shelf-view-model` (the Shorts shelves)
- JS: on the search page, hides any video item containing `a[href^="/shorts/"]`

### Hiding Mix entries (search results only)

CSS only: `ytd-search ytd-radio-renderer { display: none !important; }`. Mix entries are YouTube's auto-generated radio playlists, not individual videos, so they're excluded outright rather than matched against NG words/blocked channels.

### Hiding comments

CSS only: `ytd-watch-flexy ytd-comments#comments { display: none !important; }`

### Related-video chips (hide "All"/"Recommended", default to "Related")

Chip position is **not** assumed to be stable, so chips are matched by their text label instead (case-insensitive, both locales):

- `HIDDEN_CHIP_LABELS = ['すべて', 'all', 'おすすめ', 'recommended']` — any chip whose text matches one of these gets `ycu-hidden`
- `DEFAULT_CHIP_LABELS = ['関連動画', 'related']` — among the chips that remain visible, if one matches, it is clicked to become the default selection; otherwise the first remaining visible chip is clicked
- Selection runs once per video ID (from the URL's `v` parameter) so it doesn't override a user's manual chip selection, and retries on subsequent throttled ticks until the chips have rendered

### Live chat auto-close

The live chat panel on live / live-replay watch pages is rendered inside its **own iframe** (a separate document), not the main watch page document. To reach it:

- `manifest.json`'s content script entry sets `"all_frames": true`, so `common.js`/`content.js` are also injected into that iframe
- `content.js` branches on `window.top === window.self`:
  - Top frame: all of the regular filtering/blocking/chip logic described above
  - Chat iframe: watches for the native "close" button (`#close-button button`, aria-label "閉じる"/"Close") via a `MutationObserver` and clicks it once (`liveChatClosed` guard prevents re-clicking, so a user who manually reopens chat isn't fought)
- Because it's YouTube's own close control, the user can still reopen chat manually; this is a UX choice made deliberately over a hard CSS `display: none`

### Right-click block flow

1. `content.js` captures the `contextmenu` event (capture phase) in the **top frame only**, extracts channel info via `e.target.closest(<right-click extraction selector>)`, and holds it in a variable
2. `background.js`'s `contextMenus.onClicked` sends `chrome.tabs.sendMessage(tab.id, { type: 'ycu-block-channel' })` to the tab
3. On receiving that message, `content.js` adds the held channel info to `blockedChannels` (with a duplicate check) and calls `storage.local.set`, which triggers `onChanged` and an immediate re-filter

## background.js design

- `onInstalled` creates the context menu: id `ycu-block-channel`, `contexts: ['all']`, `documentUrlPatterns: ['*://www.youtube.com/*']`, title from `chrome.i18n.getMessage('contextMenuBlock')`
- `contextMenus.onClicked` sends a message to the originating tab
- `action.onClicked` calls `chrome.runtime.openOptionsPage()`

## Options page design

Sections:

1. **NG words**: word input + target `<select>` (title / channel / both) + add button; list with a remove button per row
2. **Blocked channels**: list (name + handle) with a remove button per row; entries are added via right-click or by editing the JSON directly
3. **Settings JSON**: a textarea showing the current settings; editing and clicking "Apply" parses → normalizes → saves. Invalid JSON shows an error message
4. **Export / Import**: Export downloads `youtube-cleanupper-settings.json` via a `Blob`. Import reads a `.json` file input → parse → normalize → save

- i18n: HTML elements carry `data-i18n` / `data-i18n-placeholder` attributes, filled in at startup via `chrome.i18n.getMessage`
- The lists re-render on `chrome.storage.onChanged` (so a channel blocked via right-click shows up immediately if the options page is already open), but the JSON textarea is not overwritten while it has focus

## i18n message keys

`extName, extDescription, contextMenuBlock, optionsTitle, ngWordsHeading, ngWordsHint, ngWordPlaceholder, targetTitle, targetChannel, targetBoth, add, remove, blockedHeading, blockedHint, emptyList, jsonHeading, jsonHint, apply, export, import, saved, invalidJson`

## Known risks / caveats

- YouTube's DOM structure (selectors) changes frequently. The `yt-lockup-view-model` / `grid-shelf-view-model` areas and chip markup are especially fragile. Selectors are kept together as constants near the top of `content.js`.
- Related-video chips are matched by text label rather than position, but the label text itself is still an assumption; if YouTube changes the wording (in either locale), the "All"/"Recommended" chips won't be recognized and won't be hidden.
- `ytd-compact-video-renderer` and lockup items sometimes don't expose the channel name as a link, so the handle can't be extracted; matching falls back to an exact channel-name match.
- The live chat "close" button is targeted via the CSS selector `#close-button button` inside the chat iframe. This was reverse-engineered from a single observed DOM snapshot, not from YouTube documentation — if that markup changes, auto-closing silently stops working (no error, chat just stays open).
- Mix entries are hidden via the `ytd-radio-renderer` selector, assumed from general knowledge of YouTube's DOM rather than a verified live snapshot; if YouTube renames this element, Mix entries will reappear.

## Status

- [x] Spec review, confirming spec decisions
- [x] `manifest.json`
- [x] `_locales` (en / ja)
- [x] `background.js`
- [x] `content.js` / `content.css`
- [x] `options.html` / `options.js` / `options.css`
- [x] Icons (`scripts/generate-icons.ps1`)
- [x] CI (`.github/workflows/ci.yml`)
- [x] Manual verification (load unpacked via `chrome://extensions`)
