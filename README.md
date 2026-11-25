# MCP Expansions — Twelve Physical Instruments

A quiet vertical snap-scrolling feed of **12 photorealistic physical instruments** celebrating **MCP's 2nd Birthday** (Nov 25, 2024 — Nov 25, 2026), pairing studio product photography lighting and custom Blender-modeled Draco GLB hardware with 64 hand-crafted **M · C · P** phrases.

## The Twelve Instruments

| # | ID | Instrument | Interaction |
|---|---|---|---|
| 01 | `newton-protocol` | **Newton Protocol** | Drag the `M` sphere or press `Space` to clack out a new M · C · P phrase |
| 02 | `the-contract` | **The Contract** | Plug in the USB-C cable (`5V → 9V → 15V → 20V`) to negotiate and lock a phrase |
| 03 | `cipher-machine` | **Cipher Machine** | Turn the brass hand crank or press `Space` to stamp a fresh paper tape |
| 04 | `jacket-legend` | **Jacket Legend** | Pull the braided USB-C cable taut to read the silk-screened `AWM 2725` legend |
| 05 | `discover-identity` | **Discover Identity** | Seat the VCONN cable to wake the `SOP / SOP' / SOP''` e-marker chips |
| 06 | `flip-contract` | **Flip Contract** | Flip the USB-C plug 180° (`CC1` ↔ `CC2`) to negotiate a new orientation contract |
| 07 | `specimen-drawer` | **Specimen Drawer** | Pick any of the 5 coiled specimen cables in the anodized studio tray |
| 08 | `destination-blind` | **Destination Blind** | Click the Solari split-flap board or press `Space` to roll all three rows |
| 09 | `letterpress-lockup` | **Letterpress Lockup** | Pull a fresh debossed archival proof sheet from the brass-quoined iron chase |
| 10 | `dymo-embosser` | **Dymo Embosser** | Squeeze the trigger wheel to emboss raised white vinyl M · C · P label strips |
| 11 | `combination-lock` | **Combination Lock** | Spin the three coaxial word tumblers to dial a new phrase and pop the chrome shackle |
| 12 | `mechanical-typewriter` | **Mechanical Typewriter** | Strike the `M`, `C`, `P` keys to clack a fresh phrase onto archival cotton bond paper |

## Controls & Permalinks

- **Navigate feed**: Mouse wheel, trackpad swipe, touch swipe, `↑` / `↓`, or `j` / `k`
- **Operate instrument**: Direct click/drag on the hardware or `Space`
- **Index drawer**: `/` to search and filter all 64 entries in `phrases.json` (`Birthday`, `Protocol`, `Dev`, `Absurd`)
- **Theme**: `T` toggles light and dark studio sweeps
- **Deep links**:
  - `?i=<instrument-id>` — jump directly to any instrument (e.g. `?i=combination-lock`)
  - `?p=<phrase-slug>` — load any curated phrase (e.g. `?p=more-cake-please`)
  - `?w=M,C,P` — custom three-word remix (e.g. `?w=Modern,Coffee,Protocol`)
- **Accessibility**: `prefers-reduced-motion: reduce` and no-WebGL environments render crisp typographic SVG still plates that preserve all permalinks and keyboard navigation.

## Architecture & Static Hosting

- **Zero build step** — pure ES modules with vendored Three.js + Draco WASM decoder (`vendor/three/`), deployable on any static host.
- **Lazy-loaded hardware** — a single shared WebGL2 renderer mounts only adjacent slides and disposes off-screen geometry, keeping first-paint payload under 5 MB.
- **Blender sources committed** — every instrument's `.blend` file and procedural Python builder live in `blender/` and `blender/scripts/`, exported as Draco-compressed `.glb` assets in `assets/models/`.

### Local Preview

```bash
npx serve .
```

### Proof Artifacts

- `proof/final/contact-sheet.png` — 4×3 contact sheet of 1080×1080 stills for all 12 instruments at rest on `"More Cake, Please"`
- `proof/final/stills/` — individual 1080×1080 studio renders (`01-newton-protocol.png` … `12-mechanical-typewriter.png`)
- `proof/final/full-feed-demo.mp4` — full-feed swipe recording scrolling through all 12 instruments and operating hardware live

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
