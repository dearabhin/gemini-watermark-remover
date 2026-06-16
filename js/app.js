// Engine is lazy-loaded only when the user uploads an image
let enginePromise = null;

function getEngine() {
    if (!enginePromise) {
        enginePromise = import('./engine.js').then(({ WatermarkEngine }) =>
            WatermarkEngine.create()
        );
    }
    return enginePromise;
}

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const previewSection = document.getElementById('previewSection');
    const previewContainer = document.getElementById('previewContainer');

    // Buttons
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const resetBtn = document.getElementById('resetBtn');
    const formatSelect = document.getElementById('formatSelect');
    const qualityControl = document.getElementById('qualityControl');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');

    let allProcessedFiles = [];
    const DEFAULT_QUALITY = 90;

    function updateQualityVisibility() {
        if (formatSelect.value === 'webp') {
            qualityControl.classList.remove('hidden');
        } else {
            qualityControl.classList.add('hidden');
        }
    }

    function getQuality() {
        return (qualitySlider ? parseInt(qualitySlider.value, 10) : DEFAULT_QUALITY) / 100;
    }

    if (qualitySlider && qualityValue) {
        qualitySlider.addEventListener('input', () => {
            qualityValue.textContent = qualitySlider.value + '%';
        });
    }

    formatSelect.addEventListener('change', updateQualityVisibility);
    updateQualityVisibility();

    // Convert a PNG blob to the requested download format.
    // Returns { blob, ext }. PNG is returned as-is; WebP is encoded lossy via canvas.
    async function convertToFormat(blob, format, quality = 0.92) {
        if (format !== 'webp') return { blob, ext: 'png' };

        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        return new Promise((resolve, reject) => {
            canvas.toBlob((webpBlob) => {
                // Some browsers (e.g. Safari) silently fall back to PNG when WebP encoding is unsupported.
                if (webpBlob && webpBlob.type === 'image/webp') {
                    resolve({ blob: webpBlob, ext: 'webp' });
                } else {
                    reject(new Error('Browser does not support WebP encoding.'));
                }
            }, 'image/webp', quality);
        });
    } 

    uploadArea.addEventListener('click', () => fileInput.click());

    // Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eName => {
        uploadArea.addEventListener(eName, (e) => { e.preventDefault(); e.stopPropagation(); });
    });

    uploadArea.addEventListener('dragover', () => uploadArea.classList.add('border-brand-primary', 'bg-blue-50'));
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('border-brand-primary', 'bg-blue-50'));
    uploadArea.addEventListener('drop', (e) => {
        uploadArea.classList.remove('border-brand-primary', 'bg-blue-50');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Reset logic with memory cleanup
    resetBtn.addEventListener('click', () => {
        allProcessedFiles.forEach(file => {
            if (file.url) URL.revokeObjectURL(file.url);
            if (file.originalSrc) URL.revokeObjectURL(file.originalSrc);
        });
        
        previewSection.classList.add('hidden');
        uploadArea.classList.remove('hidden');
        fileInput.value = '';
        previewContainer.innerHTML = '';
        downloadBtn.classList.add('hidden');
        downloadAllBtn.classList.add('hidden');
        allProcessedFiles = [];
    });

    downloadBtn.addEventListener('click', async () => {
        if (allProcessedFiles.length === 1) {
            const item = allProcessedFiles[0];
            try {
                const { blob, ext } = await convertToFormat(item.blob, formatSelect.value, getQuality());
                const name = item.name.replace(/\.[^/.]+$/, '') + '.' + ext;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (err) {
                console.error(err);
                alert('Could not convert to the selected format. Falling back to PNG.');
                const a = document.createElement('a');
                a.href = item.url;
                a.download = item.name;
                a.click();
            }
        }
    });

    // JSZip is dynamically imported only when user triggers bulk download
    downloadAllBtn.addEventListener('click', async () => {
        if (allProcessedFiles.length === 0) return;
        const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
        const zip = new JSZip();
        const format = formatSelect.value;
        await Promise.all(allProcessedFiles.map(async (item) => {
            try {
                const { blob, ext } = await convertToFormat(item.blob, format, getQuality());
                const name = item.name.replace(/\.[^/.]+$/, '') + '.' + ext;
                zip.file(name, blob);
            } catch (err) {
                console.error(err);
                zip.file(item.name, item.blob);
            }
        }));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cleaned_images_${Date.now()}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    function createLoadingCard(fileName, index) {
        const card = document.createElement('div');
        card.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white dark:bg-theme-cardDark rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 animate-fade-in';
        card.id = `preview-card-${index}`;
        
        // Use SVG background for transparency look during loading
        const bgPattern = "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2Y5ZmRmZCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjJmMmYyIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMmYyZjIiLz48L3N2Zz4=')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjMjYyOTMwIi8+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWQxZjI0Ii8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxZDFmMjQiLz48L3N2Zz4=')]";

        card.innerHTML = `
            <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                <div class="bg-gray-50 dark:bg-gray-800/80 px-3 py-2 border-b border-gray-200 dark:border-gray-700 truncate font-bold text-xs text-slate-700 dark:text-slate-200">${fileName}</div>
                <div class="p-3 ${bgPattern} flex items-center justify-center h-64"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div></div>
            </div>
            <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-md overflow-hidden border border-brand-primary/30">
                <div class="bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 border-b border-brand-primary/20 font-bold text-xs text-brand-primary">Processing...</div>
                <div class="p-3 ${bgPattern} flex items-center justify-center h-64"><p class="text-sm font-semibold text-brand-primary">Removing watermark...</p></div>
            </div>`;
        return card;
    }

    function updateCardWithResult(index, fileData, fileName) {
        const card = document.getElementById(`preview-card-${index}`);
        if (!card) return;

        // Restore SVG transparency background
        const bgPattern = "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2Y5ZmRmZCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjJmMmYyIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMmYyZjIiLz48L3N2Zz4=')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjMjYyOTMwIi8+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWQxZjI0Ii8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxZDFmMjQiLz48L3N2Zz4=')]";

        card.innerHTML = `
            <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                <div class="bg-gray-50 dark:bg-gray-800/80 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 class="font-bold text-slate-700 dark:text-slate-200 text-xs">Original</h3>
                    <div class="text-[10px] font-mono text-slate-500">${fileData.width} × ${fileData.height} px</div>
                </div>
                <div class="p-3 ${bgPattern} flex justify-center h-64"><img src="${fileData.originalSrc}" class="max-h-full object-contain rounded shadow-sm mx-auto" /></div>
            </div>
            <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-md overflow-hidden border border-green-500/40 ring-2 ring-green-500/20">
                <div class="bg-green-50 dark:bg-green-900/20 px-3 py-2 border-b border-green-500/30 flex items-center gap-1">
                    <iconify-icon icon="ph:check-circle-fill" width="16" class="text-green-600 dark:text-green-400"></iconify-icon>
                    <span class="font-bold text-green-600 dark:text-green-400 text-xs">Cleaned</span>
                </div>
                <div class="p-3 ${bgPattern} flex justify-center h-64"><img src="${fileData.url}" class="max-h-full object-contain rounded shadow-sm mx-auto" /></div>
                <div class="p-3 border-t border-green-500/20">
                    <button class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all active:scale-95" data-index="${index}">
                        <iconify-icon icon="ph:download-simple-bold" width="16"></iconify-icon> Download
                    </button>
                </div>
            </div>`;

        card.querySelector('button[data-index]').addEventListener('click', async () => {
            try {
                const { blob, ext } = await convertToFormat(fileData.blob, formatSelect.value, getQuality());
                const name = fileName.replace(/\.[^/.]+$/, '') + '.' + ext;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (err) {
                console.error(err);
                const a = document.createElement('a');
                a.href = fileData.url;
                a.download = fileName;
                a.click();
            }
        });
    }

    async function handleFiles(files) {
        const validFiles = Array.from(files).filter(f => f.type.match('image.*'));
        if (validFiles.length === 0) return;

        uploadArea.classList.add('hidden');
        previewSection.classList.remove('hidden');
        previewContainer.innerHTML = '';
        allProcessedFiles = [];

        // Lazy-load engine on first use
        let engine;
        try {
            engine = await getEngine();
        } catch (e) {
            alert("Error: Assets not found.");
            return;
        }

        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const loadingCard = createLoadingCard(file.name, i);
            previewContainer.appendChild(loadingCard);

            try {
                const result = await engine.process(file);
                const fileName = `${file.name.replace(/\.[^/.]+$/, "")}-clean.png`;
                const fileData = {
                    name: fileName,
                    blob: result.blob,
                    url: URL.createObjectURL(result.blob),
                    originalSrc: result.originalSrc,
                    width: result.width,
                    height: result.height
                };

                allProcessedFiles.push(fileData);
                updateCardWithResult(i, fileData, fileName);
            } catch (err) { console.error(err); }
        }

        if (allProcessedFiles.length === 1) {
            downloadBtn.classList.remove('hidden');
            downloadAllBtn.classList.add('hidden');
        } else if (allProcessedFiles.length > 1) {
            downloadBtn.classList.add('hidden');
            downloadAllBtn.classList.remove('hidden');
        }
    }
});