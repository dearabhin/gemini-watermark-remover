/**
 * engine.js — Gemini Watermark Remover: Main Controller
 *
 * Supports auto-detection of watermark position, size, AND shape across
 * all known Gemini watermark variants (v1 original, v2, v3).
 *
 * Detection uses correlation-based shape matching (not brightness scoring)
 * which works reliably on both light AND dark images.
 */

import { calculateAlphaMap } from './alphaMap.js';
import { reverseAlphaBlend }  from './blendModes.js';

// ─────────────────────────────────────────────
// Watermark geometry constants
// ─────────────────────────────────────────────

const WM_SIZE_SMALL = 48;
const WM_SIZE_LARGE = 96;

/**
 * Known watermark margin positions (distance from bottom-right corner).
 * Google has changed the position multiple times.
 * The auto-detector tries all combinations of size × margin × alpha map.
 */
const WM_MARGINS = [24, 32, 48, 64, 96, 128, 144, 192, 288];

const LOGO_PIXEL_VALUE = 255;

// ─────────────────────────────────────────────
// Asset loading
// ─────────────────────────────────────────────

let alphaMap48 = null;
let alphaMap96 = null;
let alphaMap128 = null;
let assetsLoaded = false;

/**
 * Loads all reference images and pre-computes alpha maps.
 */
export async function loadAssets(assetBasePath = './assets') {
  if (assetsLoaded) return;

  const [img48, img96, img128] = await Promise.all([
    loadImage(`${assetBasePath}/bg_48.png`),
    loadImage(`${assetBasePath}/bg_96.png`),
    loadImage(`${assetBasePath}/bg_128.png`),
  ]);

  const ctx48 = createOffscreenContext(WM_SIZE_SMALL, WM_SIZE_SMALL);
  ctx48.drawImage(img48, 0, 0);
  alphaMap48 = calculateAlphaMap(ctx48.getImageData(0, 0, WM_SIZE_SMALL, WM_SIZE_SMALL));

  const ctx96 = createOffscreenContext(WM_SIZE_LARGE, WM_SIZE_LARGE);
  ctx96.drawImage(img96, 0, 0);
  alphaMap96 = calculateAlphaMap(ctx96.getImageData(0, 0, WM_SIZE_LARGE, WM_SIZE_LARGE));

  const ctx128 = createOffscreenContext(WM_SIZE_LARGE, WM_SIZE_LARGE);
  ctx128.drawImage(img128, 0, 0);
  alphaMap128 = calculateAlphaMap(ctx128.getImageData(0, 0, WM_SIZE_LARGE, WM_SIZE_LARGE));

  assetsLoaded = true;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Removes the Gemini sparkle watermark from an image.
 *
 * Automatically detects:
 *  • watermark size (48 vs 96 px) — tries BOTH, picks best
 *  • position (all known margins)
 *  • which alpha map to use (bg_48, bg_96, bg_128)
 *
 * @param {HTMLImageElement|ImageBitmap} image
 * @returns {HTMLCanvasElement}
 */
export function processImage(image) {
  if (!assetsLoaded) {
    throw new Error('Assets not loaded. Call loadAssets() first.');
  }

  const { width, height } = image;
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);

  // Auto-detect position, size, AND alpha map
  const result = detectWatermark(imageData);

  if (result === null) {
    console.warn('[GeminiWM] Could not detect watermark; image returned as-is.');
    return canvas;
  }

  const { startX, startY, wmSize, alphaMap, label, score } = result;
  console.log(
    `[GeminiWM] Detected: ${label} at (${startX}, ${startY}), ` +
    `${wmSize}px sprite, score=${score.toFixed(4)}`
  );

  // Apply reverse-alpha-blend
  const cleaned = reverseAlphaBlend(imageData, alphaMap, startX, startY, wmSize, LOGO_PIXEL_VALUE);
  ctx.putImageData(cleaned, 0, 0);

  return canvas;
}

// ─────────────────────────────────────────────
// Correlation-based detection
// ─────────────────────────────────────────────

/**
 * Measures how well a patch correlates with the expected alpha map shape.
 *
 * Uses Pearson correlation between the pixel deviation from the local
 * median and the alpha map. This works on BOTH light and dark images
 * because it measures the SHAPE of the deviation, not absolute brightness.
 *
 * On light images: watermark pixels are slightly darker → negative deviation
 *   correlates with alpha (we use abs correlation)
 * On dark images: watermark pixels are brighter → positive deviation
 *   correlates with alpha
 *
 * @param {ImageData}    imageData
 * @param {number}       startX
 * @param {number}       startY
 * @param {number}       wmSize
 * @param {Float32Array} alphaMap
 * @returns {number}  Absolute correlation (0–1, higher = better match)
 */
function measureCorrelation(imageData, startX, startY, wmSize, alphaMap) {
  const { data, width, height } = imageData;

  if (startX < 0 || startY < 0 ||
      startX + wmSize > width || startY + wmSize > height) {
    return -1;
  }

  // Extract brightness values and alpha map values for non-trivial pixels
  const patchValues = [];
  const alphaValues = [];

  for (let row = 0; row < wmSize; row++) {
    for (let col = 0; col < wmSize; col++) {
      const alpha = alphaMap[row * wmSize + col];
      const ix = ((startY + row) * width + (startX + col)) * 4;
      const brightness = (data[ix] + data[ix + 1] + data[ix + 2]) / 3;
      patchValues.push(brightness);
      alphaValues.push(alpha);
    }
  }

  // Compute median of patch (robust estimate of local background)
  const sorted = [...patchValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Compute deviation from median
  const deviations = patchValues.map(v => v - median);

  // Pearson correlation between deviations and alpha map
  const n = deviations.length;
  let sumD = 0, sumA = 0, sumDD = 0, sumAA = 0, sumDA = 0;
  for (let i = 0; i < n; i++) {
    sumD += deviations[i];
    sumA += alphaValues[i];
    sumDD += deviations[i] * deviations[i];
    sumAA += alphaValues[i] * alphaValues[i];
    sumDA += deviations[i] * alphaValues[i];
  }

  const meanD = sumD / n;
  const meanA = sumA / n;
  const varD = sumDD / n - meanD * meanD;
  const varA = sumAA / n - meanA * meanA;

  if (varD < 0.001 || varA < 0.001) return 0;

  const cov = sumDA / n - meanD * meanA;
  const corr = cov / (Math.sqrt(varD) * Math.sqrt(varA));

  // Return absolute correlation — watermark can make pixels
  // brighter (dark bg) or darker (light bg)
  return Math.abs(corr);
}

/**
 * Tries all combinations of watermark size, margin, and alpha map.
 * Returns the candidate with the highest correlation score.
 *
 * @param {ImageData} imageData
 * @returns {{ startX, startY, wmSize, alphaMap, label, score } | null}
 */
function detectWatermark(imageData) {
  const { width, height } = imageData;

  // Build all candidate configurations: [wmSize, alphaMap, label]
  const configs = [
    [WM_SIZE_SMALL, alphaMap48,  'bg_48 (48px)'],
    [WM_SIZE_LARGE, alphaMap96,  'bg_96 (96px)'],
    [WM_SIZE_LARGE, alphaMap128, 'bg_128 (96px new)'],
  ];

  let best = null;
  let bestScore = 0.3; // Minimum correlation threshold

  for (const [wmSize, alphaMap, configLabel] of configs) {
    for (const margin of WM_MARGINS) {
      const startX = width  - wmSize - margin;
      const startY = height - wmSize - margin;

      if (startX < 0 || startY < 0) continue;

      const score = measureCorrelation(imageData, startX, startY, wmSize, alphaMap);

      if (score > bestScore) {
        bestScore = score;
        best = {
          startX,
          startY,
          wmSize,
          alphaMap,
          label: `${configLabel} margin=${margin}px`,
          score,
        };
      }
    }
  }

  // Log all attempts for debugging
  if (best) {
    console.log(`[GeminiWM] Best match: ${best.label} (score=${best.score.toFixed(4)})`);
  }

  return best;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load asset: ${src}`));
    img.src = src;
  });
}

function createOffscreenContext(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  return canvas.getContext('2d');
}
