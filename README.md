# MCP Expansions — Twelve Physical Instruments

Twelve interactive square posters for MCP’s second birthday. Each instrument performs one of the 85 phrases in `phrases.json`. Scroll to the next poster or share a phrase and instrument together.

## The Twelve Instruments

| # | ID | Instrument | Interaction |
|---|---|---|---|
| 01 | `newton-protocol` | **Newton Protocol** | Tap the `M` sphere to replay, pull harder for a new phrase, or use `Space` |
| 02 | `the-contract` | **The Contract** | Plug in the USB-C cable (`5V → 9V → 15V → 20V`) to negotiate and lock a phrase |
| 03 | `cipher-machine` | **Cipher Machine** | Turn the brass rotors or press `Space` to stamp a fresh paper tape |
| 04 | `jacket-legend` | **Jacket Legend** | Pull the USB-C jacket taut to read its jacket legend and power ratings |
| 05 | `discover-identity` | **Discover Identity** | Seat the VCONN cable to wake the `SOP / SOP' / SOP''` e-marker chips |
| 06 | `flip-contract` | **Flip Contract** | Flip the USB-C plug 180° (`CC1` ↔ `CC2`) to negotiate a new orientation contract |
| 07 | `specimen-drawer` | **Specimen Drawer** | Select a specimen in the three-bay oak archive drawer |
| 08 | `destination-blind` | **Destination Blind** | Click the Solari split-flap board or press `Space` to roll all three rows |
| 09 | `letterpress-lockup` | **Letterpress Lockup** | Pull a fresh debossed archival proof sheet from the brass-quoined iron chase |
| 10 | `dymo-embosser` | **Dymo Embosser** | Squeeze the trigger wheel to emboss a phrase on one length of black vinyl |
| 11 | `combination-lock` | **Combination Lock** | Spin the three coaxial word tumblers to dial a new phrase and pop the chrome shackle |
| 12 | `mechanical-typewriter` | **Mechanical Typewriter** | Strike the `M`, `C`, `P` keys to clack a fresh phrase onto archival cotton bond paper |

## Controls & Permalinks

- **Navigate feed**: Mouse wheel, trackpad swipe, touch swipe, `↑` / `↓`, or `j` / `k`
- **Operate instrument**: Direct click/drag on the hardware or `Space`
- **Index drawer**: `/` to search and filter all 85 entries in `phrases.json` (`Birthday`, `Protocol`, `Dev`, `Absurd`, `Skeptic`)
- **Theme**: `T` toggles light and dark themes
- **Deep links**:
  - `?i=<instrument-id>` — jump directly to any instrument (e.g. `?i=combination-lock`)
  - `?p=<phrase-slug>` — load any curated phrase (e.g. `?p=more-cake-please`)
  - `?w=M,C,P` — custom three-word remix (e.g. `?w=Modern,Coffee,Protocol`)
- **Accessibility**: `prefers-reduced-motion: reduce` and no-WebGL environments render crisp typographic SVG still plates that preserve all permalinks and keyboard navigation.

## Architecture & Static Hosting

The site is a set of static ES modules. The current poster and its immediate neighbours load on approach. At rest the feed retains the last rendered frame. A photo plate supplies the working surface and hardware of each instrument. The renderer registers moving parts, light emitters and live type in the same coordinate space. Newton suspends the M sphere on a single wire and integrates the photographed steel along the pendulum’s path for shutter blur. Its impulse solver drives the word reveals and audible impacts.

The photographic plates in `assets/photographs/` were made with ImageGen. The Blender sources, compressed meshes, lighting probes and previous render plates are retained in `blender/` and `assets/`. The locally served fonts and their OFL licences are in `assets/fonts/`.

### Local Preview

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

### Browser verification

Run `npm test` to start a temporary loopback server and exercise the live mechanisms, snap navigation, phrase links and motion preference. The two capture scripts start their own loopback server. They use the project’s Playwright dependency, local Chrome, FFmpeg and ImageMagick.

```sh
node scripts/capture_phase1.mjs
node scripts/capture_final.mjs
```

### Proof Artifacts

- `proof/phase1/phase1-demo.mp4` records the cradle, touch swipe, meter negotiation and replug with instrument audio.
- `proof/phase1/` also contains both instruments at rest in both themes, alternate phrases and the reduced-motion plate.

- `proof/final/contact-sheet.png` — 4×3 contact sheet of 1080×1080 stills for all 12 instruments at rest on `"More Cake, Please"`
- `proof/final/stills/` — individual 1080×1080 browser captures (`01-newton-protocol.png` … `12-mechanical-typewriter.png`)
- `proof/final/full-feed-demo.mp4` — all twelve instruments operated in sequence. The capture checks multiple pixel transitions in each instrument’s hardware region in the encoded film.
- `proof/final/review/` contains the 540px still JPEGs. Each movie has a matching `*-filmstrip.jpg` and `*-frames-540.jpg`, sampled from its recorded timeline.

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
