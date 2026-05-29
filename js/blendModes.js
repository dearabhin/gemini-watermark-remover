/**
 * blendModes.js — Reverse Alpha Blend
 *
 * Implements the mathematical inverse of the alpha-compositing formula
 * Gemini uses to stamp the sparkle watermark onto an image.
 *
 * Forward (what Gemini does):
 *   final_px = α × logo_px + (1 − α) × original_px
 *
 * Inverse (what we do):
 *   original_px = (final_px − α × logo_px) / (1 − α)
 *
 * Where:
 *   • final_px   – the watermarked pixel value we read from the image
 *   • logo_px    – always 255 (the sparkle is solid white)
 *   • α          – transparency value from the pre-computed alpha map
 *   • original_px – the recovered pixel value we write back
 *
 * The result is clamped to [0, 255] to avoid overflow from JPEG compression
 * artefacts that can push pixel values slightly above or below what the
 * formula expects.
 *
 * @param {ImageData}    imageData   Full image pixel data (modified in-place copy)
 * @param {Float32Array} alphaMap    Flat row-major alpha values for the wmSize×wmSize sprite
 * @param {number}       startX      X coordinate (px) of the watermark's top-left corner
 * @param {number}       startY      Y coordinate (px) of the watermark's top-left corner
 * @param {number}       wmSize      Width/height of the watermark sprite (48 or 96)
 * @param {number}       logoValue   Pixel value of the watermark logo (255 for white)
 * @returns {ImageData}  A new ImageData object with the watermark pixels restored
 */
export function reverseAlphaBlend(imageData, alphaMap, startX, startY, wmSize, logoValue) {
  // Work on a copy so we never mutate the caller's data
  const output = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  const { data, width } = output;

  for (let row = 0; row < wmSize; row++) {
    for (let col = 0; col < wmSize; col++) {
      const alpha = alphaMap[row * wmSize + col];

      // Skip pixels where the sparkle is essentially invisible
      if (alpha < 0.01) continue;

      // If alpha ≈ 1 the original pixel is completely replaced by the logo;
      // we can only recover it by copying the nearest neighbours, but in
      // practice Gemini never uses α = 1 so we just leave those alone.
      if (alpha >= 0.999) continue;

      const pixelIndex = ((startY + row) * width + (startX + col)) * 4;

      // Restore each colour channel independently
      for (let channel = 0; channel < 3; channel++) {
        const finalValue    = data[pixelIndex + channel];
        const originalValue = (finalValue - alpha * logoValue) / (1 - alpha);
        data[pixelIndex + channel] = Math.round(Math.min(255, Math.max(0, originalValue)));
      }
      // Alpha channel of the output image is always fully opaque
      data[pixelIndex + 3] = 255;
    }
  }

  return output;
}
