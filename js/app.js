import { WatermarkEngine } from './engine.js';

document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const previewSection = document.getElementById('previewSection');
    const previewContainer = document.getElementById('previewContainer');

    // Buttons & Overlay
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const resetBtn = document.getElementById('resetBtn');

    let engine = null;
    let allProcessedFiles = []; // Store all processed files for bulk download

    // --- Init ---
    try {
        engine = await WatermarkEngine.create();
    } catch (e) {
        alert("Error: Could not load background assets. Please ensure 'assets/bg_48.png' and 'assets/bg_96.png' exist.");
    }

    // --- Event Listeners ---
    uploadArea.addEventListener('click', () => fileInput.click());

    // Drag & Drop Logic
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    uploadArea.addEventListener('dragover', () => uploadArea.classList.add('border-gemini-blue', 'bg-blue-50'));
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('border-gemini-blue', 'bg-blue-50'));

    uploadArea.addEventListener('drop', (e) => {
        uploadArea.classList.remove('border-gemini-blue', 'bg-blue-50');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    resetBtn.addEventListener('click', () => {
        previewSection.classList.add('hidden');
        uploadArea.classList.remove('hidden');
        fileInput.value = '';
        previewContainer.innerHTML = '';
        downloadAllBtn.classList.add('hidden');
        allProcessedFiles = [];
    });

    // Download All as ZIP
    downloadAllBtn.addEventListener('click', async () => {
        if (allProcessedFiles.length === 0) return;

        const zip = new JSZip();
        allProcessedFiles.forEach(item => {
            zip.file(item.name, item.blob);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `cleaned_images_${Date.now()}.zip`;
        a.click();
    });

    // Create loading card
    function createLoadingCard(fileName, index) {
        const card = document.createElement('div');
        card.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white dark:bg-theme-cardDark rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 animate-fade-in';
        card.id = `preview-card-${index}`;

        card.innerHTML = `
            <!-- Original (Loading) -->
            <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                <div class="bg-gray-50 dark:bg-gray-800/80 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-gray-400"></span>
                        <h3 class="font-bold text-slate-700 dark:text-slate-200 text-xs">${fileName}</h3>
                    </div>
                </div>
                <div class="p-3 flex items-center justify-center h-48 bg-gray-50 dark:bg-gray-800">
                    <div class="text-center">
                        <div class="w-12 h-12 mx-auto mb-3 rounded-full border-4 border-gray-300 border-t-brand-primary animate-spin"></div>
                        <p class="text-sm text-gray-500">Loading...</p>
                    </div>
                </div>
            </div>

            <!-- Processed (Processing) -->
            <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-md overflow-hidden border border-brand-primary/30">
                <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 px-3 py-2 border-b border-brand-primary/20">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
                        <h3 class="font-bold text-brand-primary dark:text-indigo-400 text-xs">Processing...</h3>
                    </div>
                </div>
                <div class="p-3 flex items-center justify-center h-48 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10">
                    <div class="text-center">
                        <div class="w-12 h-12 mx-auto mb-3 rounded-full border-4 border-brand-primary/30 border-t-brand-primary animate-spin"></div>
                        <p class="text-sm text-brand-primary font-semibold">Removing watermark...</p>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    // Update card with processed result
    function updateCardWithResult(index, fileData, fileName) {
        const card = document.getElementById(`preview-card-${index}`);
        if (!card) return;

        const sizeText = `${fileData.width} × ${fileData.height} px`;

        card.innerHTML = `
            <!-- Original -->
            <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
                <div class="bg-gray-50 dark:bg-gray-800/80 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-gray-400"></span>
                        <h3 class="font-bold text-slate-700 dark:text-slate-200 text-xs">Original</h3>
                    </div>
                    <div class="text-[10px] font-mono text-slate-500 dark:text-slate-400">${sizeText}</div>
                </div>
                <div class="p-3 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2Y5ZmRmZCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjJmMmYyIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMmYyZjIiLz48L3N2Zz4=')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjMjYyOTMwIi8+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWQxZjI0Ii8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxZDFmMjQiLz48L3N2Zz4=')]">
                    <img src="${fileData.originalSrc}" class="max-w-full max-h-[300px] h-auto rounded shadow-sm object-contain mx-auto" />
                </div>
            </div>

            <!-- Processed (Completed) -->
            <div class="bg-white dark:bg-theme-cardDark rounded-xl shadow-md overflow-hidden border border-green-500/40 ring-2 ring-green-500/20">
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-3 py-2 border-b border-green-500/30 flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <iconify-icon icon="ph:check-circle-fill" class="text-green-500" width="16"></iconify-icon>
                        <h3 class="font-bold text-green-600 dark:text-green-400 text-xs">Completed</h3>
                    </div>
                    <button class="px-2 py-1 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded transition-all hover:scale-105" data-index="${index}">
                        <iconify-icon icon="ph:download-simple-bold" width="12" class="inline"></iconify-icon> Download
                    </button>
                </div>
                <div class="p-3 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2Y5ZmRmZCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjJmMmYyIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMmYyZjIiLz48L3N2Zz4=')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjMjYyOTMwIi8+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWQxZjI0Ii8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxZDFmMjQiLz48L3N2Zz4=')]">
                    <img src="${fileData.url}" class="max-w-full max-h-[300px] h-auto rounded shadow-sm object-contain mx-auto" />
                </div>
            </div>
        `;

        // Attach download listener
        const downloadBtn = card.querySelector('button[data-index]');
        downloadBtn.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = fileData.url;
            a.download = fileName;
            a.click();
        });
    }

    // --- Processing Logic ---
    async function handleFiles(files) {
        if (!files.length) return;

        const filesArray = Array.from(files);
        const validFiles = filesArray.filter(f => f.type.match('image.*'));

        if (validFiles.length === 0) {
            alert("Please upload valid images (PNG, JPG, WebP)");
            return;
        }

        // Show preview section immediately
        uploadArea.classList.add('hidden');
        previewSection.classList.remove('hidden');

        allProcessedFiles = [];
        previewContainer.innerHTML = '';

        try {
            if (!engine) engine = await WatermarkEngine.create();

            // Process all files
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];

                // Add loading card immediately
                const loadingCard = createLoadingCard(file.name, i);
                previewContainer.appendChild(loadingCard);

                // Scroll to new card
                setTimeout(() => {
                    loadingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);

                try {
                    const result = await engine.process(file);
                    const fileName = `clean_${file.name.replace(/\.[^/.]+$/, "")}.png`;

                    const fileData = {
                        name: fileName,
                        blob: result.blob,
                        url: URL.createObjectURL(result.blob),
                        originalSrc: result.originalSrc,
                        width: result.width,
                        height: result.height
                    };

                    allProcessedFiles.push(fileData);

                    // Update card with result
                    updateCardWithResult(i, fileData, fileName);

                } catch (err) {
                    console.error(`Failed to process ${file.name}:`, err);
                }
            }

            // Show/hide Download All button
            if (allProcessedFiles.length > 1) {
                downloadAllBtn.classList.remove('hidden');
            } else {
                downloadAllBtn.classList.add('hidden');
            }

        } catch (error) {
            console.error(error);
            alert("An error occurred during processing.");
        }
    }
});