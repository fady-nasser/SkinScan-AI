/**
 * SkinScan AI - Skin Cancer Detection Web App
 * Main Application JavaScript
 */

// ============================================
// APP STATE
// ============================================
const AppState = {
    currentScreen: 'home',
    capturedImage: null,
    processedImage: null,
    currentResult: null,
    cameraStream: null,
    flashEnabled: false,
    cropBox: {
        x: 50,
        y: 50,
        width: 200,
        height: 200
    },
    brightness: 100,
    contrast: 100
};

// API Configuration
const API_BASE = window.location.origin;

// ============================================
// DOM ELEMENTS
// ============================================
const DOM = {
    // Screens
    screens: {
        home: document.getElementById('screen-home'),
        camera: document.getElementById('screen-camera'),
        upload: document.getElementById('screen-upload'),
        preprocess: document.getElementById('screen-preprocess'),
        loading: document.getElementById('screen-loading'),
        results: document.getElementById('screen-results'),
        history: document.getElementById('screen-history'),
        info: document.getElementById('screen-info')
    },

    // Camera
    cameraPreview: document.getElementById('camera-preview'),
    cameraError: document.getElementById('camera-error'),
    flashIcon: document.getElementById('flash-icon'),

    // Upload
    fileInput: document.getElementById('file-input'),
    uploadArea: document.getElementById('upload-area'),
    uploadPlaceholder: document.getElementById('upload-placeholder'),
    uploadPreview: document.getElementById('upload-preview'),
    uploadActions: document.getElementById('upload-actions'),

    // Preprocess
    preprocessImage: document.getElementById('preprocess-image'),
    cropWrapper: document.getElementById('crop-wrapper'),
    cropOverlay: document.getElementById('crop-overlay'),
    cropBox: document.getElementById('crop-box'),
    brightnessSlider: document.getElementById('brightness-slider'),
    contrastSlider: document.getElementById('contrast-slider'),
    brightnessValue: document.getElementById('brightness-value'),
    contrastValue: document.getElementById('contrast-value'),

    // Results
    resultCard: document.getElementById('result-card'),
    resultBadge: document.getElementById('result-badge'),
    resultLabel: document.getElementById('result-label'),
    resultDetail: document.getElementById('result-detail'),
    resultThumbnail: document.getElementById('result-thumbnail'),
    confidenceValue: document.getElementById('confidence-value'),
    confidenceFill: document.getElementById('confidence-fill'),
    resultDisclaimer: document.getElementById('result-disclaimer'),

    // History
    historyContent: document.getElementById('history-content'),
    historyEmpty: document.getElementById('history-empty'),
    historyList: document.getElementById('history-list'),

    // Processing canvas
    canvas: document.getElementById('processing-canvas')
};

// ============================================
// SCREEN NAVIGATION
// ============================================
function showScreen(screenName) {
    // Hide all screens
    Object.values(DOM.screens).forEach(screen => {
        screen.classList.remove('active');
    });

    // Show target screen
    if (DOM.screens[screenName]) {
        DOM.screens[screenName].classList.add('active');
        AppState.currentScreen = screenName;

        // Update bottom nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.screen === screenName);
        });

        // Screen-specific initialization
        if (screenName === 'camera') {
            initCamera();
        } else if (screenName === 'history') {
            loadHistory();
        }
    }
}

// ============================================
// CAMERA FUNCTIONALITY
// ============================================
async function initCamera() {
    try {
        // Stop any existing stream
        if (AppState.cameraStream) {
            AppState.cameraStream.getTracks().forEach(track => track.stop());
        }

        // Request camera access
        const constraints = {
            video: {
                facingMode: 'environment', // Use back camera on mobile
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        AppState.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        DOM.cameraPreview.srcObject = AppState.cameraStream;
        DOM.cameraError.style.display = 'none';
        DOM.cameraPreview.style.display = 'block';

    } catch (error) {
        console.error('Camera error:', error);
        DOM.cameraError.style.display = 'flex';
        DOM.cameraPreview.style.display = 'none';
    }
}

function stopCamera() {
    if (AppState.cameraStream) {
        AppState.cameraStream.getTracks().forEach(track => track.stop());
        AppState.cameraStream = null;
    }
}

function capturePhoto() {
    if (!AppState.cameraStream) return;

    const video = DOM.cameraPreview;
    const canvas = DOM.canvas;
    const ctx = canvas.getContext('2d');

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Get image data
    AppState.capturedImage = canvas.toDataURL('image/jpeg', 0.9);

    // Stop camera and go to preprocess
    stopCamera();
    loadPreprocessScreen(AppState.capturedImage);
    showScreen('preprocess');
}

function toggleFlash() {
    if (!AppState.cameraStream) return;

    const track = AppState.cameraStream.getVideoTracks()[0];
    if (track.getCapabilities && track.getCapabilities().torch) {
        AppState.flashEnabled = !AppState.flashEnabled;
        track.applyConstraints({
            advanced: [{ torch: AppState.flashEnabled }]
        });
        document.getElementById('btn-flash-toggle').classList.toggle('flash-on', AppState.flashEnabled);
    }
}

// ============================================
// FILE UPLOAD
// ============================================
function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        AppState.capturedImage = e.target.result;
        DOM.uploadPreview.src = e.target.result;
        DOM.uploadPreview.style.display = 'block';
        DOM.uploadPlaceholder.style.display = 'none';
        DOM.uploadActions.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function resetUpload() {
    DOM.uploadPreview.style.display = 'none';
    DOM.uploadPlaceholder.style.display = 'flex';
    DOM.uploadActions.style.display = 'none';
    DOM.fileInput.value = '';
    AppState.capturedImage = null;
}

// ============================================
// IMAGE PREPROCESSING
// ============================================
function loadPreprocessScreen(imageData) {
    DOM.preprocessImage.src = imageData;

    // Reset enhancement controls
    DOM.brightnessSlider.value = 100;
    DOM.contrastSlider.value = 100;
    DOM.brightnessValue.textContent = '100%';
    DOM.contrastValue.textContent = '100%';
    AppState.brightness = 100;
    AppState.contrast = 100;

    // Initialize crop box after image loads
    DOM.preprocessImage.onload = () => {
        initCropBox();
        applyFilters();
    };
}

function initCropBox() {
    const wrapper = DOM.cropWrapper;
    const image = DOM.preprocessImage;
    const cropBox = DOM.cropBox;

    // Get image display dimensions
    const imgRect = image.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    // Calculate image offset within wrapper
    const offsetX = (wrapperRect.width - imgRect.width) / 2;
    const offsetY = (wrapperRect.height - imgRect.height) / 2;

    // Set initial crop box (centered, 60% of image)
    const boxSize = Math.min(imgRect.width, imgRect.height) * 0.6;
    const boxX = offsetX + (imgRect.width - boxSize) / 2;
    const boxY = offsetY + (imgRect.height - boxSize) / 2;

    cropBox.style.left = boxX + 'px';
    cropBox.style.top = boxY + 'px';
    cropBox.style.width = boxSize + 'px';
    cropBox.style.height = boxSize + 'px';

    AppState.cropBox = {
        x: boxX,
        y: boxY,
        width: boxSize,
        height: boxSize
    };

    // Make crop box draggable
    setupCropInteraction();
}

function setupCropInteraction() {
    const cropBox = DOM.cropBox;
    const wrapper = DOM.cropWrapper;
    const handles = cropBox.querySelectorAll('.crop-handle');

    let isDragging = false;
    let isResizing = false;
    let resizeHandle = null;
    let startX, startY, startBoxX, startBoxY, startWidth, startHeight;

    // Drag the crop box
    cropBox.addEventListener('mousedown', startDrag);
    cropBox.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
        if (e.target.classList.contains('crop-handle')) return;
        e.preventDefault();

        isDragging = true;
        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX;
        startY = point.clientY;
        startBoxX = cropBox.offsetLeft;
        startBoxY = cropBox.offsetTop;

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }

    function onDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;

        const wrapperRect = wrapper.getBoundingClientRect();
        let newX = startBoxX + dx;
        let newY = startBoxY + dy;

        // Constrain to wrapper bounds
        newX = Math.max(0, Math.min(newX, wrapperRect.width - cropBox.offsetWidth));
        newY = Math.max(0, Math.min(newY, wrapperRect.height - cropBox.offsetHeight));

        cropBox.style.left = newX + 'px';
        cropBox.style.top = newY + 'px';

        AppState.cropBox.x = newX;
        AppState.cropBox.y = newY;
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
    }

    // Resize handles
    handles.forEach(handle => {
        handle.addEventListener('mousedown', startResize);
        handle.addEventListener('touchstart', startResize, { passive: false });
    });

    function startResize(e) {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        resizeHandle = e.target;

        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX;
        startY = point.clientY;
        startBoxX = cropBox.offsetLeft;
        startBoxY = cropBox.offsetTop;
        startWidth = cropBox.offsetWidth;
        startHeight = cropBox.offsetHeight;

        document.addEventListener('mousemove', onResize);
        document.addEventListener('touchmove', onResize, { passive: false });
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchend', stopResize);
    }

    function onResize(e) {
        if (!isResizing) return;
        e.preventDefault();

        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;

        let newX = startBoxX;
        let newY = startBoxY;
        let newWidth = startWidth;
        let newHeight = startHeight;

        // Handle different corners
        if (resizeHandle.classList.contains('se')) {
            newWidth = Math.max(50, startWidth + dx);
            newHeight = Math.max(50, startHeight + dy);
        } else if (resizeHandle.classList.contains('sw')) {
            newWidth = Math.max(50, startWidth - dx);
            newHeight = Math.max(50, startHeight + dy);
            newX = startBoxX + (startWidth - newWidth);
        } else if (resizeHandle.classList.contains('ne')) {
            newWidth = Math.max(50, startWidth + dx);
            newHeight = Math.max(50, startHeight - dy);
            newY = startBoxY + (startHeight - newHeight);
        } else if (resizeHandle.classList.contains('nw')) {
            newWidth = Math.max(50, startWidth - dx);
            newHeight = Math.max(50, startHeight - dy);
            newX = startBoxX + (startWidth - newWidth);
            newY = startBoxY + (startHeight - newHeight);
        }

        cropBox.style.left = newX + 'px';
        cropBox.style.top = newY + 'px';
        cropBox.style.width = newWidth + 'px';
        cropBox.style.height = newHeight + 'px';

        AppState.cropBox = { x: newX, y: newY, width: newWidth, height: newHeight };
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', onResize);
        document.removeEventListener('touchmove', onResize);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('touchend', stopResize);
    }
}

function applyFilters() {
    const brightness = AppState.brightness / 100;
    const contrast = AppState.contrast / 100;
    DOM.preprocessImage.style.filter = `brightness(${brightness}) contrast(${contrast})`;
}

function getCroppedImage() {
    const canvas = DOM.canvas;
    const ctx = canvas.getContext('2d');
    const image = DOM.preprocessImage;
    const wrapper = DOM.cropWrapper;
    const cropBox = DOM.cropBox;

    // Get actual image dimensions
    const imgNaturalWidth = image.naturalWidth;
    const imgNaturalHeight = image.naturalHeight;

    // Get displayed dimensions
    const imgRect = image.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    // Calculate offset
    const offsetX = (wrapperRect.width - imgRect.width) / 2;
    const offsetY = (wrapperRect.height - imgRect.height) / 2;

    // Get crop box position relative to image
    const cropX = AppState.cropBox.x - offsetX;
    const cropY = AppState.cropBox.y - offsetY;

    // Scale factors
    const scaleX = imgNaturalWidth / imgRect.width;
    const scaleY = imgNaturalHeight / imgRect.height;

    // Calculate source coordinates in natural image
    const srcX = Math.floor(Math.max(0, cropX * scaleX));
    const srcY = Math.floor(Math.max(0, cropY * scaleY));
    const srcWidth = Math.floor(Math.min(AppState.cropBox.width * scaleX, imgNaturalWidth - srcX));
    const srcHeight = Math.floor(Math.min(AppState.cropBox.height * scaleY, imgNaturalHeight - srcY));

    // Set canvas size (ensure at least 1px)
    canvas.width = Math.max(1, srcWidth);
    canvas.height = Math.max(1, srcHeight);

    // Apply filters
    const brightness = AppState.brightness / 100;
    const contrast = AppState.contrast / 100;
    ctx.filter = `brightness(${brightness}) contrast(${contrast})`;

    // Create temp image to draw
    const tempImg = new Image();

    return new Promise((resolve, reject) => {
        tempImg.onload = () => {
            try {
                // Clear canvas first
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw
                ctx.drawImage(tempImg, srcX, srcY, srcWidth, srcHeight, 0, 0, canvas.width, canvas.height);

                // Get data URL
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

                // Validate data URL
                if (dataUrl === 'data:,') {
                    reject(new Error('Cropped image is empty'));
                    return;
                }

                resolve(dataUrl);
            } catch (e) {
                reject(e);
            }
        };
        tempImg.onerror = () => reject(new Error('Failed to load image for cropping'));
        tempImg.src = AppState.capturedImage;
    });
}

// ============================================
// AI ANALYSIS
// ============================================
async function analyzeImage() {
    try {
        // Get cropped/processed image BEFORE hiding the screen
        const processedImage = await getCroppedImage();
        AppState.processedImage = processedImage;

        showScreen('loading');

        // Send to API
        // Send to API
        const response = await fetch(`${API_BASE}/api/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: processedImage
            })
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const textHTML = await response.text();
            console.error("Server returned non-JSON response:", textHTML);
            throw new Error(`Server Error (${response.status}): The server returned an HTML error instead of JSON. Check console for details.`);
        }

        const result = await response.json();

        if (result.success) {
            AppState.currentResult = result;
            displayResults(result);
            showScreen('results');
        } else {
            throw new Error(result.error || 'Analysis failed');
        }

    } catch (error) {
        console.error('Analysis error:', error);
        alert('Error analyzing image: ' + error.message);
        showScreen('preprocess');
    }
}

function displayResults(result) {
    const isBenign = result.result === 'BENIGN';

    // Update result card styling
    DOM.resultCard.className = 'result-card ' + (isBenign ? 'benign' : 'suspicious');
    DOM.resultBadge.className = 'result-badge ' + (isBenign ? 'benign' : 'suspicious');

    // Update result text
    DOM.resultLabel.textContent = result.result;
    DOM.resultDetail.textContent = result.result_detail;

    // Update thumbnail
    DOM.resultThumbnail.src = AppState.processedImage;

    // Update confidence
    DOM.confidenceValue.textContent = result.confidence + '%';
    DOM.confidenceFill.style.width = result.confidence + '%';

    // Update disclaimer
    if (result.disclaimer) {
        DOM.resultDisclaimer.textContent = result.disclaimer;
    }
}

// ============================================
// HISTORY MANAGEMENT
// ============================================
function loadHistory() {
    const history = getHistoryFromStorage();

    if (history.length === 0) {
        DOM.historyEmpty.style.display = 'flex';
        DOM.historyList.style.display = 'none';
    } else {
        DOM.historyEmpty.style.display = 'none';
        DOM.historyList.style.display = 'flex';

        DOM.historyList.innerHTML = history.map((item, index) => `
            <div class="history-item" data-index="${index}">
                <div class="history-thumbnail">
                    <img src="${item.thumbnail}" alt="Scan result">
                </div>
                <div class="history-info">
                    <div class="history-result ${item.result.toLowerCase()}">${item.result}</div>
                    <div class="history-date">${formatDate(item.date)}</div>
                </div>
                <div class="history-confidence">${item.confidence}%</div>
            </div>
        `).join('');

        // Add click handlers
        DOM.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                viewHistoryItem(history[index]);
            });
        });
    }
}

function saveToHistory() {
    if (!AppState.currentResult || !AppState.processedImage) return;

    const historyItem = {
        thumbnail: AppState.processedImage,
        result: AppState.currentResult.result,
        result_detail: AppState.currentResult.result_detail,
        confidence: AppState.currentResult.confidence,
        date: new Date().toISOString()
    };

    const history = getHistoryFromStorage();
    history.unshift(historyItem);

    // Keep only last 50 items
    if (history.length > 50) {
        history.pop();
    }

    localStorage.setItem('skinScanHistory', JSON.stringify(history));

    alert('Saved to history!');
}

function getHistoryFromStorage() {
    try {
        const data = localStorage.getItem('skinScanHistory');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all history?')) {
        localStorage.removeItem('skinScanHistory');
        loadHistory();
    }
}

function viewHistoryItem(item) {
    AppState.processedImage = item.thumbnail;
    AppState.currentResult = {
        result: item.result,
        result_detail: item.result_detail,
        confidence: item.confidence
    };
    displayResults(AppState.currentResult);
    showScreen('results');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// EVENT LISTENERS
// ============================================
function initEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            showScreen(item.dataset.screen);
        });
    });

    // Home screen
    document.getElementById('btn-start-scan').addEventListener('click', () => {
        showScreen('camera');
    });

    document.getElementById('btn-upload-image').addEventListener('click', () => {
        showScreen('upload');
    });

    // Camera screen
    document.getElementById('btn-camera-back').addEventListener('click', () => {
        stopCamera();
        showScreen('home');
    });

    document.getElementById('btn-capture').addEventListener('click', capturePhoto);
    document.getElementById('btn-flash-toggle').addEventListener('click', toggleFlash);

    // Upload screen
    document.getElementById('btn-upload-back').addEventListener('click', () => {
        resetUpload();
        showScreen('home');
    });

    DOM.uploadArea.addEventListener('click', () => {
        DOM.fileInput.click();
    });

    DOM.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Drag and drop
    DOM.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.uploadArea.classList.add('drag-over');
    });

    DOM.uploadArea.addEventListener('dragleave', () => {
        DOM.uploadArea.classList.remove('drag-over');
    });

    DOM.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    document.getElementById('btn-choose-different').addEventListener('click', resetUpload);

    document.getElementById('btn-continue-to-preprocess').addEventListener('click', () => {
        if (AppState.capturedImage) {
            loadPreprocessScreen(AppState.capturedImage);
            showScreen('preprocess');
        }
    });

    // Preprocess screen
    document.getElementById('btn-preprocess-back').addEventListener('click', () => {
        showScreen('upload');
    });

    DOM.brightnessSlider.addEventListener('input', (e) => {
        AppState.brightness = parseInt(e.target.value);
        DOM.brightnessValue.textContent = AppState.brightness + '%';
        applyFilters();
    });

    DOM.contrastSlider.addEventListener('input', (e) => {
        AppState.contrast = parseInt(e.target.value);
        DOM.contrastValue.textContent = AppState.contrast + '%';
        applyFilters();
    });

    document.getElementById('btn-analyze').addEventListener('click', analyzeImage);

    // Results screen
    document.getElementById('btn-results-close').addEventListener('click', () => {
        showScreen('home');
    });

    document.getElementById('btn-scan-again').addEventListener('click', () => {
        AppState.capturedImage = null;
        AppState.processedImage = null;
        AppState.currentResult = null;
        showScreen('home');
    });

    document.getElementById('btn-save-result').addEventListener('click', saveToHistory);

    // History screen
    document.getElementById('btn-clear-history').addEventListener('click', clearHistory);
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    showScreen('home');

    // Check if camera is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Camera API not available');
    }
});

// Handle visibility change (stop camera when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && AppState.currentScreen === 'camera') {
        stopCamera();
    }
});
