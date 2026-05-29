# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Watch and rebuild Tailwind CSS during development
npm run dev

# Build minified CSS for production
npm run build

# Serve locally (required for ES6 modules — cannot open index.html directly)
python -m http.server 8000
```

After editing any HTML, JS, or Tailwind classes, run `npm run build` to regenerate `css/output.css`. The compiled CSS is committed to the repo so it deploys as a static file.

## Architecture

This is a **100% client-side, zero-backend** static site. No build step beyond Tailwind CSS compilation.

### Processing pipeline

```
app.js (UI / DOM)
  → engine.js (controller: asset loading + detection + orchestration)
      → alphaMap.js (derives per-pixel α values from reference PNGs)
      → blendModes.js (applies inverse alpha-compositing formula)
```

1. **`loadAssets()`** (`engine.js`) — on page load, fetches `assets/bg_48.png`, `assets/bg_96.png`, and `assets/bg_128.png` into offscreen canvases, then calls `calculateAlphaMap()` on each to produce `Float32Array` alpha maps.

2. **`processImage()`** (`engine.js`) — for each uploaded image, calls `detectWatermark()` which tries every combination of watermark size (48 or 96 px), margin distance (9 candidate values), and alpha map (3 variants) using Pearson correlation against the alpha map shape. The highest-scoring candidate wins if it exceeds a 0.3 threshold.

3. **`reverseAlphaBlend()`** (`blendModes.js`) — applies the inverse compositing formula to only the detected watermark region:
   ```
   original_px = (final_px − α × 255) / (1 − α)
   ```

### Reference assets

- `assets/bg_48.png` — 48×48 px white sparkle on black; encodes the alpha map for small watermarks
- `assets/bg_96.png` — 96×96 px equivalent for large watermarks (pre-May 2025 shape)
- `assets/bg_128.png` — 96×96 px equivalent for large watermarks (May 2025+ shape)

The alpha map derivation is `α = max(R, G, B) / 255` per pixel.

### Watermark detection history

Google has changed the sparkle position multiple times. `engine.js` handles this by trying all known margins (`WM_MARGINS = [24, 32, 48, 64, 96, 128, 144, 192, 288]`) and all three alpha map variants for every image. See `js/PATCH_NOTES.md` for the full history of position changes.

### Tailwind setup

Dark mode is class-based (`darkMode: "class"`). Custom tokens used throughout:
- `brand-primary` (#6366f1), `brand-secondary`, `brand-accent`
- `theme-light`, `theme-dark`, `theme-cardDark`

`css/input.css` is the Tailwind source; `css/output.css` is the compiled output that is served.
