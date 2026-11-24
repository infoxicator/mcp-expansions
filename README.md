# MCP Expansions

A minimalist three-word acronym generator celebrating **MCP's 2nd Birthday** (Nov 25, 2024 — Nov 25, 2026), inspired by the classic `npm-expansions` tradition.

## Features

- **64 hand-crafted M·C·P expansions** with deadpan footnotes (`phrases.json`)
- **Smooth auto-rotation** every 4.8 seconds with a subtle hairline progress bar (pauses on hover, drawer open, or `P`)
- **Click any word to remix** an individual M, C, or P slot on the fly
- **Shareable URLs** for both curated phrases (`?p=more-cake-please`) and custom remixes (`?w=Mischievous,Context,Pancakes`)
- **Searchable Index drawer** (`/`) with category filters (`Birthday`, `Protocol`, `Dev`, `Absurd`)
- **Keyboard-first controls** (`Space`, `←`, `→`, `P`, `C`, `L`, `T`, `/`) and light/dark archival themes
- **Zero build step** — open `index.html` directly or deploy the folder to any static host

## Local Preview

Open `index.html` directly in a browser, or run any static file server:

```bash
npx serve .
```

## Contributing a Phrase

Add a new entry to `phrases.json` following the M · C · P format:

```json
{
  "id": "more-cake-please",
  "words": ["More", "Cake,", "Please"],
  "note": "Official birthday transport specification for November 25.",
  "category": "birthday"
}
```
