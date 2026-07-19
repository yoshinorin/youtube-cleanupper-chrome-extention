# YouTube Cleanupper

A Chrome extension (Manifest V3) that cleans up the YouTube browsing experience: hides Shorts from search results, filters videos by NG words, lets you block channels via right-click, hides the comments section, and defaults related videos to the "Related" tab.

No build tools or external runtime dependencies — plain JS/CSS/HTML.

## Features

- Hide Shorts in search results
- Hide videos in search results / related videos whose title and/or channel name contains an NG word (match target: title, channel, or both)
- Block a channel via the right-click context menu on the home page or related videos; blocked channels are hidden from search results and related videos
- Hide the comments section on watch pages
- Hide the "All" and "Recommended" chips in the related videos chip bar, and default the selected chip to "Related" (falls back to the first remaining chip if "Related" isn't present)
- Settings are stored as JSON, editable directly in the options page, and exportable/importable as a `.json` file

## Project structure

```
src/
  manifest.json          # Extension manifest
  _locales/en, _locales/ja   # i18n messages (English / Japanese UI)
  background.js          # Service worker: context menu handling
  common.js               # Shared helpers (settings normalization, matching) used by content.js and options.js
  content.js / content.css   # Filtering logic injected into youtube.com
  options.html / options.js / options.css   # Settings page
```

## Installation (load unpacked)

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `src` folder of this repository (the folder containing `manifest.json`)

After editing source files, click the reload icon on the extension card in `chrome://extensions` to apply changes.

## Settings

Settings are stored under the `settings` key in `chrome.storage.local`:

```json
{
  "ngWords": [
    { "word": "example", "target": "title" }
  ],
  "blockedChannels": [
    { "name": "Channel Name", "handle": "@handle" }
  ]
}
```

- `target` is one of `title`, `channel`, or `both` (OR match)
- NG word matching is case-insensitive substring matching
- Blocked channel matching prefers an exact `handle` match; falls back to an exact `name` match when no handle is available
- Settings can be edited directly as JSON in the options page, or exported/imported as a `.json` file

## Development

Requires Node.js. [Biome](https://biomejs.dev/) is used for linting and formatting.

```sh
npm install     # install Biome
npm run lint    # lint src/
npm run fmt     # format src/ in place
npm run check   # lint + format + apply safe fixes to src/
npm test        # run the unit tests (Node's built-in test runner, no extra dependencies)
```

## Testing

`test/common.test.js` unit-tests the pure logic in `src/common.js` (settings normalization, NG word matching, blocked-channel matching) using Node's built-in `node:test` runner — no test framework dependency is installed.

`content.js` and `options.js` are not covered by automated tests, since they depend on the live YouTube DOM and `chrome.*` APIs; verify those manually after loading the unpacked extension:

| Feature | How to check |
|---|---|
| Shorts hidden | Search on youtube.com — no Shorts shelf or individual Shorts items appear |
| NG words | Add an NG word in the options page — matching videos disappear from search results |
| Channel block | Right-click a channel name on the home page or in related videos, choose "Block this channel" — its videos disappear from search results / related videos |
| Comments hidden | Open any video — the comments section is not shown |
| Related tab default | Open any video — the "All" and "Recommended" chips are hidden and "Related" (or the first remaining chip) is selected by default |
| JSON editing | Edit the JSON in the options page and click "Apply" — invalid JSON shows an error |
| Export / Import | Export downloads a `.json` file; importing it restores the settings |

## Known limitations

- YouTube's DOM structure changes frequently; selectors (especially around `yt-lockup-view-model` / `grid-shelf-view-model` and the related-video chips) may break and need updating
- Related-video chips are matched by their text label (Japanese/English), not position; if YouTube uses a different wording, the "All"/"Recommended" chips won't be recognized
- Some layouts (e.g. `ytd-compact-video-renderer`, lockup items) may not expose a channel link, so the channel handle can't always be extracted; falls back to exact name matching
- No extension icon is defined yet; Chrome shows the default puzzle-piece icon
