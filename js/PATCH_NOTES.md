# Gemini Watermark Remover — Update Patch Notes

## What Changed in Google Gemini (May 2025)

Google moved the sparkle watermark **upward and inward** from its original
bottom-right corner position.

| | Right margin | Bottom margin |
|---|---|---|
| **OLD** (pre-May 2025) | 32 px | 32 px |
| **NEW** (May 2025+) | 3 × wmSize | 3 × wmSize |
| For 96 px watermark | 288 px | 288 px |
| For 48 px watermark | 144 px | 144 px |

---

## Files Changed

Only **`js/engine.js`** required code changes.  
`js/alphaMap.js` and `js/blendModes.js` are functionally unchanged (just
cleaned up comments).

### Key changes in `engine.js`

```js
// OLD — hard-coded 32 px margin
const WATERMARK_MARGIN = 32;
const startX = imageWidth  - wmSize - WATERMARK_MARGIN;
const startY = imageHeight - wmSize - WATERMARK_MARGIN;

// NEW — two margin constants + auto-detection
const WM_MARGIN_OLD         = 32;
const WM_MARGIN_NEW_LARGE   = 288;   // 3 × 96
const WM_MARGIN_NEW_SMALL   = 144;   // 3 × 48

// Auto-detects which position has the stronger watermark signal:
const position = detectWatermarkPosition(imageData, wmSize, alphaMap);
```

The new `detectWatermarkPosition()` function scores **both** candidate
positions using the alpha map as a brightness-correlation template, then
picks whichever score is higher. This means the tool works on **both old
and new Gemini images** without any manual toggle.

---

## How to Apply

1. Replace `js/engine.js` with the new file from this patch.
2. (Optional) Replace `js/alphaMap.js` and `js/blendModes.js` for cleaner
   code — logic is identical.
3. No changes needed to `index.html`, `js/app.js`, or the `assets/` folder.
4. Reload your local server and test with a new Gemini image.

---

## Backward Compatibility

✅ Works on **old** Gemini images (pre-May 2025, 32 px margin)  
✅ Works on **new** Gemini images (May 2025+, 288/144 px margin)  
✅ Auto-detects position — no user action required  
✅ `assets/bg_48.png` and `assets/bg_96.png` are **unchanged**  

---

## Detection Method

The sparkle is a semi-transparent white overlay. Pixels beneath it are
always **brighter** than they would be naturally, in proportion to the
alpha value. `detectWatermarkPosition()` computes a weighted brightness
average using the alpha map as weights at each candidate location:

```
score = Σ(alpha_i × brightness_i) / Σ(alpha_i)
```

The candidate with the higher score wins.
