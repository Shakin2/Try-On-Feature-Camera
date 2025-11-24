document.addEventListener('DOMContentLoaded', () => {

    // --- DEFAULT URL ---
    const DEFAULT_PRODUCT_URL = 'https://media.stylerunner.com/products/0a961c81-e363-4dca-b7f0-1e1b455ac440/66eda75f/nu26272-wht_wht_01.jpg';
    
    // --- GLOBAL STATE ---
    let personImageFile = null;
    let productQueue = [];
    let resultBlobs = []; // ADDED: To store images for sharing
    const MAX_PRODUCTS = 4;

    // --- 1. GET ALL ELEMENTS ---
    // Modals
    const welcomeModal = document.getElementById('welcome-modal');
    const productModal = document.getElementById('product-modal');
    const acknowledgeBtn = document.getElementById('acknowledge-btn');
    const confirmProductBtn = document.getElementById('confirm-product-btn');
    const useDefaultBtn = document.getElementById('use-default-btn');
    const productUrlInput = document.getElementById('product-url-input');
    
    // Setup Container
    const setupContainer = document.getElementById('setup-container');
    const dropZone = document.getElementById('drop-zone');
    const dropZonePrompt = document.getElementById('drop-zone-prompt');
    const personPreview = document.getElementById('person-preview');
    const personUploadInput = document.getElementById('person-upload');
    const productQueueContainer = document.getElementById('product-queue');
    const addProductBtn = document.getElementById('add-product-btn');
    const productUploadInput = document.getElementById('product-upload');
    const generateBtn = document.getElementById('generate-btn');
    const startOverSetupBtn = document.getElementById('start-over-setup-btn'); 
    
    // Results Container
    const resultsContainer = document.getElementById('results-container');
    const carouselSlider = document.getElementById('carousel-slider');
    const startOverBtn = document.getElementById('start-over-btn');
    const shareBtn = document.getElementById('share-btn'); // ADDED

    // Messages
    const errorMessage = document.getElementById('error-message');
    const loadingMessage = document.getElementById('loading-message');

    // --- 2. MODAL LOGIC (No Change) ---
    acknowledgeBtn.addEventListener('click', () => {
        welcomeModal.classList.add('hidden');
        productModal.classList.remove('hidden');
    });

    confirmProductBtn.addEventListener('click', () => {
        let url = productUrlInput.value.trim();
        if (url) {
            addProductToQueue(url);
            productModal.classList.add('hidden');
        } else {
            alert("Please paste a URL or use the default.");
        }
    });

    useDefaultBtn.addEventListener('click', () => {
        addProductToQueue(DEFAULT_PRODUCT_URL);
        productModal.classList.add('hidden');
    });

    // --- 3. PRODUCT QUEUE LOGIC (No Change) ---
    function addProductToQueue(product) {
        if (productQueue.length >= MAX_PRODUCTS) {
            alert(`You can only add up to ${MAX_PRODUCTS} products.`);
            return;
        }
        productQueue.push(product);
        renderProductQueue();
        updateButtons();
    }

    function removeProductFromQueue(index) {
        productQueue.splice(index, 1);
        renderProductQueue();
        updateButtons();
    }

    function renderProductQueue() {
        productQueueContainer.innerHTML = ''; 
        productQueue.forEach((product, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'product-thumbnail';
            
            const img = document.createElement('img');
            img.src = (typeof product === 'string') ? product : URL.createObjectURL(product);
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => removeProductFromQueue(index);
            
            thumb.appendChild(img);
            thumb.appendChild(removeBtn);
            productQueueContainer.appendChild(thumb);
        });
    }

    addProductBtn.addEventListener('click', () => {
        productUploadInput.click(); 
    });

    productUploadInput.addEventListener('change', (e) => {
        let files = Array.from(e.target.files);
        let remainingSlots = MAX_PRODUCTS - productQueue.length;
        
        if (files.length > remainingSlots) {
            alert(`You can only add ${remainingSlots} more product(s).`);
            files = files.slice(0, remainingSlots);
        }
        
        files.forEach(file => addProductToQueue(file));
        e.target.value = null; 
    });

    // --- 4. PERSON UPLOAD & DROPZONE LOGIC (No Change) ---
    dropZone.addEventListener('click', () => {
        personUploadInput.click();
    });

    personUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlePersonFile(e.target.files[0]);
        }
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });
    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0) {
            handlePersonFile(e.dataTransfer.files[0]);
        }
    });

    function handlePersonFile(file) {
        if (!file.type.startsWith('image/')) {
            alert("Please upload an image file.");
            return;
        }
        personImageFile = file;
        personPreview.src = URL.createObjectURL(file);
        personPreview.classList.remove('hidden');
        dropZonePrompt.classList.add('hidden');
        updateButtons();
    }

    // --- 5. MAIN GENERATE & API LOGIC ---
    generateBtn.addEventListener('click', async () => {
        if (!personImageFile || productQueue.length === 0) {
            alert("Please upload a person photo and at least one product.");
            return;
        }

        setLoadingState(true);
        carouselSlider.innerHTML = '';
        resultBlobs = []; // MODIFIED: Clear old results
        
        for (let i = 0; i < productQueue.length; i++) {
            const product = productQueue[i];
            loadingMessage.textContent = `Generating ${i + 1} of ${productQueue.length}...`;
            await runAICombination(personImageFile, product);
        }

        setLoadingState(false);
        setupContainer.classList.add('hidden');
        resultsContainer.classList.remove('hidden');

        // MODIFIED: Check if sharing is possible and show button
        if (navigator.share && resultBlobs.length > 0) {
            shareBtn.classList.remove('hidden');
        }
    });

    async function runAICombination(personFile, product) {
        const formData = new FormData();
        formData.append('person_upload', personFile);

        if (typeof product === 'string') {
            formData.append('product_url', product);
        } else {
            formData.append('product_upload', product);
        }
        
        try {
            const response = await fetch('/combine', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const imageBlob = await response.blob();
                addResultToCarousel(imageBlob);
                resultBlobs.push(imageBlob); // MODIFIED: Store blob for sharing
            } else {
                const error = await response.json();
                showError(`Error for one product: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showError('A network error occurred. Check the console.');
        }
    }
    
    function addResultToCarousel(imageBlob) {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(imageBlob);
        item.appendChild(img);
        carouselSlider.appendChild(item);
    }

    // --- 6. UI STATE & HELPER FUNCTIONS (No Change) ---
    function updateButtons() {
        if (productQueue.length < MAX_PRODUCTS) {
            addProductBtn.disabled = false;
        } else {
            addProductBtn.disabled = true;
        }

        if (personImageFile && productQueue.length > 0) {
            generateBtn.disabled = false;
        } else {
            generateBtn.disabled = true;
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            loadingMessage.textContent = "Preparing to generate..."; 
            loadingMessage.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            generateBtn.disabled = true;
            addProductBtn.disabled = true;
            startOverSetupBtn.disabled = true;
        } else {
            loadingMessage.classList.add('hidden');
            generateBtn.disabled = false;
            startOverSetupBtn.disabled = false;
            updateButtons();
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
    
    // --- 7. START OVER LOGIC ---
    function startOver() {
        personImageFile = null;
        productQueue = [];
        resultBlobs = []; // MODIFIED: Clear blobs
        
        resultsContainer.classList.add('hidden');
        setupContainer.classList.remove('hidden');
        productModal.classList.remove('hidden');
        shareBtn.classList.add('hidden'); // MODIFIED: Hide share button
        
        carouselSlider.innerHTML = '';
        renderProductQueue();
        
        personPreview.classList.add('hidden');
        dropZonePrompt.classList.remove('hidden');
        personUploadInput.value = null;
        productUploadInput.value = null;
        
        errorMessage.classList.add('hidden');
        
        updateButtons();
    }
    
    startOverBtn.addEventListener('click', startOver);
    startOverSetupBtn.addEventListener('click', startOver);

    // --- 8. ADDED: SHARE BUTTON LOGIC ---
    shareBtn.addEventListener('click', async () => {
        if (!navigator.share) {
            alert('Your browser does not support sharing files.');
            return;
        }

        // Create File objects from blobs
        const files = resultBlobs.map((blob, i) => {
            return new File([blob], `TryOnResult-${i + 1}.jpg`, { type: 'image/jpeg' });
        });

        if (!navigator.canShare || !navigator.canShare({ files: files })) {
            alert('Your browser can\'t share these files.');
            return;
        }

        try {
            await navigator.share({
                title: 'My AI Try-Ons',
                text: 'Check out the AI try-on images I generated!',
                files: files
            });
            console.log('Shared successfully');
        } catch (err) {
            console.error('Share failed:', err);
            // Don't alert on "AbortError", which happens if user cancels
            if (err.name !== 'AbortError') {
                alert('An error occurred while sharing.');
            }
        }
    });

});