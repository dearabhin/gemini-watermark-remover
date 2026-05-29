/**
 * app.js — UI controller for Gemini Watermark Remover
 *
 * Wires drag-and-drop / file-picker UI to the watermark removal engine.
 * Supports multi-image processing with individual + batch ZIP download.
 *
 * Updated for new Gemini watermark position (May 2025+).
 */

import { loadAssets, processImage } from './engine.js';

// ─────────────────────────────────────────────
// DOM references
// ─────────────────────────────────────────────

const uploadArea        = document.getElementById('uploadArea');
const fileInput         = document.getElementById('fileInput');
const previewSection    = document.getElementById('previewSection');
const previewContainer  = document.getElementById('previewContainer');
const downloadBtn       = document.getElementById('downloadBtn');
const downloadAllBtn    = document.getElementById('downloadAllBtn');
const resetBtn          = document.getElementById('resetBtn');
const loadingOverlay    = document.getElementById('loadingOverlay');

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

let processedFiles = []; // { url, originalSrc, width, height, fileName }

// ─────────────────────────────────────────────
// Bootstrap — load assets then wire UI
// ─────────────────────────────────────────────

(async () => {
  try {
    await loadAssets('./assets');
    console.log('[App] Assets loaded successfully.');
    initUI();
  } catch (err) {
    console.error('[App] Failed to load assets:', err);
    alert('Failed to load watermark reference data. Please refresh the page.');
  }
})();

// ─────────────────────────────────────────────
// UI wiring
// ─────────────────────────────────────────────

function initUI() {
  if (!uploadArea || !fileInput) {
    console.error('[App] Required DOM elements (uploadArea / fileInput) not found.');
    return;
  }

  // Click upload area to trigger file picker
  uploadArea.addEventListener('click', () => fileInput.click());

  // Keyboard accessibility
  uploadArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // File picker change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFiles(e.target.files);
    fileInput.value = ''; // allow re-selecting the same file
  });

  // Drag-and-drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('border-brand-primary', 'bg-indigo-50/50');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('border-brand-primary', 'bg-indigo-50/50');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('border-brand-primary', 'bg-indigo-50/50');
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', resetUI);
  }

  // Download All ZIP button
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', downloadAllAsZip);
  }
}

// ─────────────────────────────────────────────
// File processing
// ─────────────────────────────────────────────

async function handleFiles(files) {
  const validFiles = Array.from(files).filter(f => f.type.match('image.*'));
  if (validFiles.length === 0) return;

  // Show loading overlay
  showLoading(true);

  // Hide upload area, show preview section
  uploadArea.classList.add('hidden');
  previewSection.classList.remove('hidden');
  previewContainer.innerHTML = '';
  processedFiles = [];

  // Create placeholder cards
  validFiles.forEach((file, i) => {
    previewContainer.appendChild(createLoadingCard(i, file.name));
  });

  // Process each file
  for (let i = 0; i < validFiles.length; i++) {
    try {
      const image = await loadImageFile(validFiles[i]);
      const canvas = processImage(image);

      const url = canvas.toDataURL('image/png');
      const originalSrc = URL.createObjectURL(validFiles[i]);
      const fileData = {
        url,
        originalSrc,
        width: image.width,
        height: image.height,
        fileName: cleanFilename(validFiles[i].name),
      };

      processedFiles.push(fileData);
      updateCardWithResult(i, fileData);
    } catch (err) {
      console.error(`[App] Error processing ${validFiles[i].name}:`, err);
      updateCardWithError(i, validFiles[i].name, err.message);
    }
  }

  // Show action buttons
  if (processedFiles.length === 1) {
    downloadBtn.classList.remove('hidden');
    downloadBtn.onclick = () => {
      triggerDownload(processedFiles[0].url, processedFiles[0].fileName);
    };
  }

  if (processedFiles.length > 1) {
    downloadAllBtn.classList.remove('hidden');
  }

  showLoading(false);
}

// ─────────────────────────────────────────────
// Card templates
// ─────────────────────────────────────────────

/** Transparency checker pattern as inline SVG (for image backgrounds) */
const BG_PATTERN_LIGHT = "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2Y5ZmRmZCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjJmMmYyIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMmYyZjIiLz48L3N2Zz4=')]";
const BG_PATTERN_DARK = "dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjMjYyOTMwIi8+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWQxZjI0Ii8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxZDFmMjQiLz48L3N2Zz4=')]";
const BG_PATTERN = `${BG_PATTERN_LIGHT} ${BG_PATTERN_DARK}`;

function createLoadingCard(index, fileName) {
  const card = document.createElement('div');
  card.id = `preview-card-${index}`;
  card.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
  card.innerHTML = `
    <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
      <div class="bg-gray-50 dark:bg-gray-800/80 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">${fileName}</h3>
      </div>
      <div class="p-3 ${BG_PATTERN} flex items-center justify-center h-64">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    </div>
    <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-md overflow-hidden border border-brand-primary/30">
      <div class="bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 border-b border-brand-primary/20 font-bold text-xs text-brand-primary">
        Processing…
      </div>
      <div class="p-3 ${BG_PATTERN} flex items-center justify-center h-64">
        <p class="text-sm font-semibold text-brand-primary">Removing watermark…</p>
      </div>
    </div>`;
  return card;
}

function updateCardWithResult(index, fileData) {
  const card = document.getElementById(`preview-card-${index}`);
  if (!card) return;

  card.innerHTML = `
    <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
      <div class="bg-gray-50 dark:bg-gray-800/80 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 class="font-bold text-slate-700 dark:text-slate-200 text-xs">Original</h3>
        <div class="text-[10px] font-mono text-slate-500">${fileData.width} × ${fileData.height} px</div>
      </div>
      <div class="p-3 ${BG_PATTERN} flex justify-center h-64">
        <img src="${fileData.originalSrc}" class="max-h-full object-contain rounded shadow-sm mx-auto" alt="Original image" />
      </div>
    </div>
    <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-md overflow-hidden border border-green-500/40 ring-2 ring-green-500/20">
      <div class="bg-green-50 dark:bg-green-900/20 px-3 py-2 border-b border-green-500/30 flex items-center gap-1">
        <iconify-icon icon="ph:check-circle-fill" width="16" class="text-green-600 dark:text-green-400"></iconify-icon>
        <span class="font-bold text-green-600 dark:text-green-400 text-xs">Cleaned</span>
      </div>
      <div class="p-3 ${BG_PATTERN} flex justify-center h-64">
        <img src="${fileData.url}" class="max-h-full object-contain rounded shadow-sm mx-auto" alt="Cleaned image" />
      </div>
      <div class="p-3 border-t border-green-500/20">
        <button class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all active:scale-95" data-index="${index}">
          <iconify-icon icon="ph:download-simple-bold" width="16"></iconify-icon> Download
        </button>
      </div>
    </div>`;

  // Wire per-image download button
  card.querySelector('button[data-index]').addEventListener('click', () => {
    triggerDownload(fileData.url, fileData.fileName);
  });
}

function updateCardWithError(index, fileName, errorMessage) {
  const card = document.getElementById(`preview-card-${index}`);
  if (!card) return;

  card.innerHTML = `
    <div class="md:col-span-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4">
      <p class="text-sm font-bold text-red-700 dark:text-red-400 mb-1">Failed: ${fileName}</p>
      <p class="text-xs text-red-600 dark:text-red-300">${errorMessage}</p>
    </div>`;
}

// ─────────────────────────────────────────────
// ZIP download
// ─────────────────────────────────────────────

async function downloadAllAsZip() {
  if (processedFiles.length === 0) return;

  showLoading(true);

  try {
    // Dynamic import — JSZip loaded only when needed
    const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js')).default
      || window.JSZip
      || (await import('https://esm.sh/jszip@3')).default;

    const zip = new JSZip();

    for (const file of processedFiles) {
      const response = await fetch(file.url);
      const blob = await response.blob();
      zip.file(file.fileName, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(URL.createObjectURL(zipBlob), 'gemini-cleaned-images.zip');
  } catch (err) {
    console.error('[App] ZIP download failed:', err);
    alert('ZIP download failed. Try downloading images individually.');
  }

  showLoading(false);
}

// ─────────────────────────────────────────────
// Reset
// ─────────────────────────────────────────────

function resetUI() {
  // Revoke object URLs to free memory
  processedFiles.forEach(f => {
    if (f.originalSrc.startsWith('blob:')) URL.revokeObjectURL(f.originalSrc);
  });
  processedFiles = [];

  // Reset visibility
  previewSection.classList.add('hidden');
  uploadArea.classList.remove('hidden');
  previewContainer.innerHTML = '';
  downloadBtn.classList.add('hidden');
  downloadAllBtn.classList.add('hidden');
  downloadBtn.onclick = null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Cannot load ${file.name}`)); };
    img.src = url;
  });
}

function triggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

function cleanFilename(original) {
  const base = original.replace(/\.[^.]+$/, '');
  return `${base}_no_watermark.png`;
}

function showLoading(show) {
  if (!loadingOverlay) return;
  loadingOverlay.style.display = show ? 'flex' : 'none';
}
