/**
 * alphaMap.js — Alpha Map Calculator
 *
 * Derives per-pixel transparency values from a reference background image
 * (bg_48.png or bg_96.png).
 *
 * These reference images were captured by rendering the Gemini sparkle
 * watermark over a BLACK (0) background. The brighter the pixel, the
 * higher the watermark's alpha (opacity) at that point.
 *
 * Since the sparkle is solid white (255) composited over black (0):
 *   final = α × 255 + (1 − α) × 0 = α × 255
 *   → α = final / 255
 *
 * We take the maximum across R, G, B channels for the strongest signal.
 *
 * @param {ImageData} bgCaptureImageData  Raw ImageData from the reference PNG
 * @returns {Float32Array}  Flat row-major array of α values in [0, 1]
 */
export function calculateAlphaMap(bgCaptureImageData) {
  const { data, width, height } = bgCaptureImageData;
  const alphaMap = new Float32Array(width * height);

  for (let i = 0; i < alphaMap.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    // Use the brightest channel for the cleanest signal
    // Reference is white sparkle on black → alpha = pixel / 255
    alphaMap[i] = Math.max(r, g, b) / 255.0;
  }

  return alphaMap;
}
