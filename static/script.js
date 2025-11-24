// --- STATE ---
let personImage = null;
let products = [];
const MAX_PRODUCTS = 4;
let isCameraActive = false;
let modelsLoaded = false;
let detectionInterval = null;

// --- INIT ---
window.onload = async () => {
    // Load Face API Models
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
        modelsLoaded = true;
        console.log("Face models loaded");
        updateFaceStatus(false, "Ready");
    } catch (e) {
        console.error("Error loading face models", e);
        updateFaceStatus(false, "Model Error");
    }
};

// --- TABS ---
window.switchTab = function(mode) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    // Find button that triggered this or match by text if called programmatically
    const btns = document.querySelectorAll('.tab-btn');
    if(mode === 'camera') btns[1].classList.add('active');
    else btns[0].classList.add('active');
    
    if (mode === 'camera') {
        document.getElementById('upload-mode').classList.add('hidden');
        document.getElementById('camera-mode').classList.remove('hidden');
        startCamera();
    } else {
        document.getElementById('camera-mode').classList.add('hidden');
        document.getElementById('upload-mode').classList.remove('hidden');
        stopCamera();
    }
}

// --- CAMERA & FACE LOGIC ---
async function startCamera() {
    const video = document.getElementById('webcam');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        video.srcObject = stream;
        isCameraActive = true;
        
        // Wait for video to actually play to get dimensions
        video.onloadedmetadata = () => {
            detectFaces();
        };
    } catch (err) {
        alert("Camera access denied. Please allow camera permissions.");
        console.error(err);
    }
}

function stopCamera() {
    const video = document.getElementById('webcam');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    isCameraActive = false;
    if (detectionInterval) clearInterval(detectionInterval);
}

async function detectFaces() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('face-overlay');
    
    // Ensure video has dimensions
    if (video.videoWidth === 0) {
        setTimeout(detectFaces, 100);
        return;
    }

    const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
    faceapi.matchDimensions(canvas, displaySize);

    detectionInterval = setInterval(async () => {
        if (!isCameraActive || !modelsLoaded) return;

        // --- KEY UPDATE: High Confidence Threshold (0.75) ---
        // inputSize 224 is standard for tinyFaceDetector. 
        // scoreThreshold 0.75 ensures we ignore walls/backgrounds.
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.75 });
        
        const detections = await faceapi.detectAllFaces(video, options);
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Flip for mirror effect so box matches video
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        if (resizedDetections.length > 0) {
            // Face Found
            // Optional: Filter for the largest face only (closest to camera)
            const mainFace = resizedDetections.reduce((prev, current) => {
                return (prev.box.width * prev.box.height > current.box.width * current.box.height) ? prev : current;
            });

            // Draw the box
            const box = mainFace.box;
            const drawOptions = {
                label: `Face (${Math.round(mainFace.score * 100)}%)`,
                boxColor: '#10b981',
                lineWidth: 2
            };
            const drawBox = new faceapi.draw.DrawBox(box, drawOptions);
            drawBox.draw(canvas);

            updateFaceStatus(true, "Face Detected");
            document.getElementById('capture-btn').style.borderColor = '#10b981'; // Green border
        } else {
            updateFaceStatus(false, "Position Face in Guide");
            document.getElementById('capture-btn').style.borderColor = 'rgba(255,255,255,0.3)';
        }
        ctx.restore();
    }, 200);
}

function updateFaceStatus(detected, text) {
    const dot = document.getElementById('face-dot');
    const label = document.getElementById('face-text');
    
    if (detected) {
        dot.classList.add('detected');
        label.style.color = '#10b981';
    } else {
        dot.classList.remove('detected');
        label.style.color = 'white';
    }
    label.textContent = text;
}

window.takePhoto = function() {
    const video = document.getElementById('webcam');
    
    // Create high-res canvas for capture
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Flip horizontal to match mirror view
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
        handlePersonFile(file);
        switchTab('upload'); 
    }, 'image/jpeg', 0.95);
}

// --- FILE HANDLING ---
window.handlePersonFile = function(file) {
    if (!file) return;
    personImage = file;
    
    const preview = document.getElementById('person-preview');
    const placeholder = document.getElementById('upload-placeholder');
    
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    
    checkReady();
}

window.handleProductFiles = function(files) {
    const remaining = MAX_PRODUCTS - products.length;
    const toAdd = Array.from(files).slice(0, remaining);
    
    products = [...products, ...toAdd];
    renderProducts();
    checkReady();
    document.getElementById('product-file').value = ''; // Reset
}

window.removeProduct = function(index) {
    products.splice(index, 1);
    renderProducts();
    checkReady();
}

function renderProducts() {
    const list = document.getElementById('product-list');
    // Clear existing product cards (keep the add button)
    const cards = list.querySelectorAll('.product-card:not(.add-product-card)');
    cards.forEach(c => c.remove());

    products.forEach((file, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${URL.createObjectURL(file)}" alt="Product">
            <button class="remove-btn" onclick="removeProduct(${index})">&times;</button>
        `;
        list.insertBefore(card, list.lastElementChild);
    });

    // Hide add button if full
    const addBtn = list.querySelector('.add-product-card');
    if (products.length >= MAX_PRODUCTS) addBtn.style.display = 'none';
    else addBtn.style.display = 'flex';
}

function checkReady() {
    const btn = document.getElementById('generate-btn');
    btn.disabled = !(personImage && products.length > 0);
}

// --- GENERATION LOGIC (PARALLEL) ---
window.generateAll = async function() {
    const btn = document.getElementById('generate-btn');
    btn.disabled = true;
    btn.textContent = "Processing...";
    
    const resultsArea = document.getElementById('results-area');
    resultsArea.classList.remove('hidden');
    const grid = document.getElementById('results-grid');
    grid.innerHTML = ''; // Clear previous

    // Create placeholders
    const placeholders = products.map((_, i) => {
        const div = document.createElement('div');
        div.className = 'result-card';
        div.style.aspectRatio = "4/5";
        div.innerHTML = `
            <div class="loading-overlay">
                <div class="spinner"></div>
                <span>Generating Look ${i + 1}...</span>
            </div>
        `;
        grid.appendChild(div);
        return div;
    });

    // Launch all requests in parallel
    const promises = products.map(async (productFile, index) => {
        const formData = new FormData();
        formData.append('person_upload', personImage);
        formData.append('product_upload', productFile);

        try {
            const response = await fetch('/combine', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Failed');

            const blob = await response.blob();
            const imgUrl = URL.createObjectURL(blob);
            
            // Replace placeholder with image immediately
            const card = placeholders[index];
            card.innerHTML = `<img src="${imgUrl}" alt="Result ${index + 1}">`;
            
        } catch (err) {
            const card = placeholders[index];
            card.innerHTML = `
                <div class="loading-overlay" style="background: #fef2f2; color: var(--error);">
                    <span>Error generating.</span>
                </div>
            `;
        }
    });

    await Promise.all(promises);
    btn.disabled = false;
    btn.textContent = "Generate Try-Ons";
}
