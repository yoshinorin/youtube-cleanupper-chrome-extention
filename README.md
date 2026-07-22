# YouTube Cleanupper

A Chrome extension (Manifest V3) that cleans up the YouTube browsing experience.

No build tools or external runtime dependencies — plain JS/CSS/HTML.

## Features

- Hide Shorts in search results
- Hide Mix (auto-generated radio playlist) entries in search results
- Hide videos in search results / related videos whose title and/or channel name contains an NG word (match target: title, channel, or both)
- Block a channel via the right-click context menu on the home page or related videos; blocked channels are hidden from search results and related videos
- Hide the comments section on watch pages
- Hide the "All" and "Recommended" chips in the related videos chip bar, and default the selected chip to "Related" (falls back to the first remaining chip if "Related" isn't present)
- Automatically close the live chat panel on live / live-replay watch pages, using YouTube's own close button (so it can still be reopened manually)
- Settings are stored as JSON, editable directly in the options page, and exportable/importable as a `.json` file

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

## Known limitations

- YouTube's DOM structure changes frequently; selectors (especially around `yt-lockup-view-model` / `grid-shelf-view-model` and the related-video chips) may break and need updating
- Related-video chips are matched by their text label (Japanese/English), not position; if YouTube uses a different wording, the "All"/"Recommended" chips won't be recognized
- Some layouts (e.g. `ytd-compact-video-renderer`, lockup items) may not expose a channel link, so the channel handle can't always be extracted; falls back to exact name matching
- The live chat close button is looked up by a CSS selector (`#close-button` inside the chat iframe); if YouTube changes that structure, auto-closing may stop working
- Mix entries are hidden via the `ytd-radio-renderer` selector; if YouTube renames this element, Mix entries will reappear in search results

## Development

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for project structure, linting/testing, and icon generation.
