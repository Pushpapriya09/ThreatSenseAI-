/**
 * QR Handler — ThreatSense-AI
 * Provides QR code scanning (decode + threat analysis) and QR code generation.
 * Libraries used via CDN:
 *   - jsQR  (QR decode from image)
 *   - qrcode (QR generation)
 */

(function () {
    /* ─── State ─── */
    let qrMode = 'scan'; // 'scan' | 'generate'

    /* ─── Init ─── */
    function initQR() {
        setupModeSwitcher();
        setupScanner();
        setupGenerator();
    }

    /* ─── Mode Switcher ─── */
    function setupModeSwitcher() {
        const btnScan = document.getElementById('qr-mode-scan');
        const btnGen  = document.getElementById('qr-mode-gen');
        if (!btnScan || !btnGen) return;

        btnScan.addEventListener('click', () => switchMode('scan'));
        btnGen.addEventListener('click',  () => switchMode('generate'));
    }

    function switchMode(mode) {
        qrMode = mode;
        const panelScan = document.getElementById('qr-scan-panel');
        const panelGen  = document.getElementById('qr-gen-panel');
        const btnScan   = document.getElementById('qr-mode-scan');
        const btnGen    = document.getElementById('qr-mode-gen');

        if (mode === 'scan') {
            panelScan.classList.remove('hidden');
            panelGen.classList.add('hidden');
            btnScan.classList.add('active');
            btnGen.classList.remove('active');
        } else {
            panelScan.classList.add('hidden');
            panelGen.classList.remove('hidden');
            btnScan.classList.remove('active');
            btnGen.classList.add('active');
        }
    }

    /* ══════════════════════════════════════
       SCANNER — upload image → decode → analyze
       ══════════════════════════════════════ */
    function setupScanner() {
        const dropZone   = document.getElementById('qr-drop-zone');
        const fileInput  = document.getElementById('qr-file-input');
        const pasteBtn   = document.getElementById('qr-paste-btn');
        const clearBtn   = document.getElementById('qr-clear-btn');
        const analyzeBtn = document.getElementById('qr-analyze-btn');

        if (!dropZone) return;

        /* Click to choose file */
        dropZone.addEventListener('click', () => fileInput && fileInput.click());

        /* Drag & drop */
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) processQRFile(file);
        });

        /* File input */
        fileInput && fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) processQRFile(file);
            fileInput.value = '';
        });

        /* Clipboard paste */
        pasteBtn && pasteBtn.addEventListener('click', async () => {
            try {
                const items = await navigator.clipboard.read();
                for (const item of items) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            processQRFile(blob);
                            return;
                        }
                    }
                }
                showScanError('No image found in clipboard. Copy a QR code image first.');
            } catch {
                showScanError('Clipboard access denied. Please use file upload instead.');
            }
        });

        /* Clear */
        clearBtn && clearBtn.addEventListener('click', resetScanner);

        /* Analyze decoded URL */
        analyzeBtn && analyzeBtn.addEventListener('click', async () => {
            const decoded = document.getElementById('qr-decoded-url');
            if (!decoded || !decoded.dataset.url) return;
            const url = decoded.dataset.url;

            // Switch to URL result panel
            showResultLoading && showResultLoading();
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<span class="spinner"></span> Analyzing...';

            try {
                const result = await aiManager.analyze(`Analyze this URL for security risks: ${url}`);
                showResultData && showResultData(result, 'qr');
                // Scroll to results
                document.getElementById('analysis-result') &&
                    document.getElementById('analysis-result').scrollIntoView({ behavior: 'smooth' });
            } catch (err) {
                console.error('[QR] Analysis failed:', err);
            } finally {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
                    </svg>
                    Analyze Threat`;
            }
        });
    }

    function processQRFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => decodeQRFromImage(img);
            img.onerror = () => showScanError('Could not load image. Please try another file.');
            img.src = e.target.result;

            // Show preview
            const preview = document.getElementById('qr-preview-img');
            const previewBox = document.getElementById('qr-preview-box');
            if (preview && previewBox) {
                preview.src = e.target.result;
                previewBox.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    }

    function decodeQRFromImage(img) {
        // Use jsQR to decode
        if (typeof jsQR === 'undefined') {
            showScanError('QR decoder library not loaded. Check your internet connection.');
            return;
        }

        // Show a scanning indicator
        const errorEl = document.getElementById('qr-scan-error');
        if (errorEl) {
            errorEl.textContent = '🔍 Scanning QR code...';
            errorEl.classList.remove('hidden');
            errorEl.style.color = 'hsl(var(--primary))';
        }

        // Use requestAnimationFrame so the UI updates before heavy processing
        requestAnimationFrame(() => {
            const result = tryMultipleDecodingStrategies(img);

            if (result) {
                if (errorEl) {
                    errorEl.classList.add('hidden');
                    errorEl.style.color = '';
                }
                showDecoded(result);
            } else {
                if (errorEl) errorEl.style.color = '';
                showScanError('No QR code detected. Tips: use a clear, well-lit image with the QR code filling most of the frame.');
            }
        });
    }

    /**
     * Attempts multiple strategies to decode a QR code from an image:
     * 1. Original size with inversion attempts
     * 2. Multiple scaled versions (smaller and larger)
     * 3. Contrast-enhanced version
     * 4. Grayscale + threshold version
     */
    function tryMultipleDecodingStrategies(img) {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        // Strategy 1: Try at original size with all inversion modes
        let result = decodeAtSize(img, w, h);
        if (result) return result;

        // Strategy 2: Try scaled versions — helps with very small or very large images
        const scales = [0.5, 1.5, 2.0, 0.75, 3.0];
        for (const scale of scales) {
            const sw = Math.round(w * scale);
            const sh = Math.round(h * scale);
            if (sw < 50 || sh < 50 || sw > 4000 || sh > 4000) continue;
            result = decodeAtSize(img, sw, sh);
            if (result) return result;
        }

        // Strategy 3: Try with contrast enhancement
        result = decodeWithContrast(img, w, h, 1.5);
        if (result) return result;

        result = decodeWithContrast(img, w, h, 2.0);
        if (result) return result;

        // Strategy 4: Try with grayscale + threshold (binarization)
        result = decodeWithThreshold(img, w, h, 128);
        if (result) return result;

        result = decodeWithThreshold(img, w, h, 100);
        if (result) return result;

        result = decodeWithThreshold(img, w, h, 160);
        if (result) return result;

        return null;
    }

    function decodeAtSize(img, width, height) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);

        // Try with inversion attempts: 'attemptBoth' catches more QR codes
        let code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) return code.data;

        return null;
    }

    function decodeWithContrast(img, width, height, contrast) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = width;
        canvas.height = height;

        // Apply contrast via CSS filter
        ctx.filter = `contrast(${contrast})`;
        ctx.drawImage(img, 0, 0, width, height);
        ctx.filter = 'none';

        const imageData = ctx.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) return code.data;

        return null;
    }

    function decodeWithThreshold(img, width, height, threshold) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Convert to grayscale and apply binary threshold
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            const val = gray > threshold ? 255 : 0;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
        }

        ctx.putImageData(imageData, 0, 0);
        const processedData = ctx.getImageData(0, 0, width, height);

        const code = jsQR(processedData.data, processedData.width, processedData.height, {
            inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) return code.data;

        return null;
    }

    function showDecoded(data) {
        const resultBox = document.getElementById('qr-result-box');
        const decodedEl = document.getElementById('qr-decoded-url');
        const errorEl   = document.getElementById('qr-scan-error');
        const analyzeBtn = document.getElementById('qr-analyze-btn');
        const clearBtn  = document.getElementById('qr-clear-btn');

        if (errorEl) errorEl.classList.add('hidden');
        if (resultBox) resultBox.classList.remove('hidden');
        if (clearBtn) clearBtn.classList.remove('hidden');

        if (decodedEl) {
            decodedEl.textContent = data;
            decodedEl.dataset.url = data;
        }

        // Show analyze button only for URL-like content
        const isUrl = /^https?:\/\//i.test(data) || /^www\./i.test(data);
        if (analyzeBtn) {
            analyzeBtn.classList.toggle('hidden', !isUrl);
        }

        // Add copy button
        const copyBtn = document.getElementById('qr-copy-btn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(data).then(() => {
                    copyBtn.textContent = '✓ Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
                });
            };
        }
    }

    function showScanError(msg) {
        const errorEl = document.getElementById('qr-scan-error');
        const resultBox = document.getElementById('qr-result-box');
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
        }
        if (resultBox) resultBox.classList.add('hidden');
    }

    function resetScanner() {
        const previewBox = document.getElementById('qr-preview-box');
        const resultBox  = document.getElementById('qr-result-box');
        const errorEl    = document.getElementById('qr-scan-error');
        const clearBtn   = document.getElementById('qr-clear-btn');

        if (previewBox) previewBox.classList.add('hidden');
        if (resultBox)  resultBox.classList.add('hidden');
        if (errorEl)    errorEl.classList.add('hidden');
        if (clearBtn)   clearBtn.classList.add('hidden');
    }

    /* ══════════════════════════════════════
       GENERATOR — input URL → draw QR code
       ══════════════════════════════════════ */
    function setupGenerator() {
        const form     = document.getElementById('qr-gen-form');
        const input    = document.getElementById('qr-gen-input');
        const output   = document.getElementById('qr-gen-output');
        const dlBtn    = document.getElementById('qr-download-btn');

        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            generateQR(text);
        });

        dlBtn && dlBtn.addEventListener('click', () => {
            const canvas = output.querySelector('canvas');
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = 'threatsense-qr.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }

    function generateQR(text) {
        if (typeof QRCode === 'undefined') {
            console.error('[QR] QRCode library not loaded.');
            return;
        }

        const output = document.getElementById('qr-gen-output');
        const wrapper = document.getElementById('qr-gen-result');
        const dlBtn   = document.getElementById('qr-download-btn');

        output.innerHTML = ''; // clear old

        const size = Math.min(output.offsetWidth || 240, 240);

        new QRCode(output, {
            text: text,
            width: size,
            height: size,
            colorDark: '#ffffff',
            colorLight: '#0f1729',
            correctLevel: QRCode.CorrectLevel.H,
        });

        if (wrapper) wrapper.classList.remove('hidden');
        if (dlBtn)   dlBtn.classList.remove('hidden');
    }

    /* ─── Expose init so app.js can call it ─── */
    window.initQR = initQR;

    /* ─── Also try to hook into result panel helpers if available ─── */
    function showResultLoading() {
        const ph = document.getElementById('result-placeholder');
        const sk = document.getElementById('result-skeleton');
        const rd = document.getElementById('result-data');
        if (ph) ph.classList.add('hidden');
        if (rd) rd.classList.add('hidden');
        if (sk) { sk.classList.remove('hidden'); sk.style.display = 'flex'; }
    }

    function showResultData(analysis, type) {
        const sk = document.getElementById('result-skeleton');
        const ph = document.getElementById('result-placeholder');
        const container = document.getElementById('result-data');
        if (sk) sk.classList.add('hidden');
        if (ph) ph.classList.add('hidden');
        if (!container) return;
        container.classList.remove('hidden');

        const badgeClass =
            analysis.classification === 'GENUINE' || analysis.classification === 'SAFE'
                ? 'badge-success'
                : analysis.classification === 'SUSPICIOUS'
                    ? 'badge-warning'
                    : 'badge-destructive';

        const progressColor =
            analysis.risk_score > 70 ? 'hsl(var(--destructive))'
                : analysis.risk_score > 40 ? 'hsl(var(--warning))'
                : 'hsl(var(--success))';

        const reasonsHtml = (analysis.reasons || [])
            .map(r => `<li class="result-reason">
                <svg class="result-reason-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                    viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
                </svg>
                <span>${r.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            </li>`).join('');

        container.innerHTML = `
        <div class="result-header">
            <div>
                <h2 class="text-2xl font-bold font-headline">QR Threat Analysis</h2>
                <p class="text-sm text-muted-foreground">Risk assessment for the decoded QR URL.</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                fill="none" stroke="hsl(var(--primary))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/>
                <rect width="5" height="5" x="3" y="16" rx="1"/>
                <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                <path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/>
                <path d="M16 12h1"/><path d="M21 12v.01"/>
            </svg>
        </div>
        <div class="result-body">
            <div class="result-classification">
                <h4 class="font-semibold">Classification</h4>
                <span class="badge ${badgeClass}">${(analysis.classification || '').replace(/</g,'&lt;')}</span>
            </div>
            <div>
                <h4 class="font-semibold" style="margin-bottom:0.5rem;">Risk Score: ${analysis.risk_score}/100</h4>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${analysis.risk_score}%;background:${progressColor};"></div>
                </div>
            </div>
            <div>
                <h4 class="font-semibold" style="margin-bottom:0.75rem;">Reasons</h4>
                <ul class="result-reasons">${reasonsHtml}</ul>
            </div>
            <div class="result-recommendation">
                <h4 class="font-semibold" style="margin-bottom:0.5rem;">Recommendation</h4>
                <p>${(analysis.recommendation || '').replace(/</g,'&lt;')}</p>
            </div>
        </div>`;
    }
})();
