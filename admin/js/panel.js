import { db, auth, onAuthStateChanged, signOut, ref, onValue, set, remove, storage, get, push, storageRef, uploadBytes, getDownloadURL, deleteObject, firebaseConfig, initializeApp, getAuth, createUserWithEmailAndPassword } from '../../js/firebase-config.js';

const ADMIN_EMAIL = 'admin@valuepro.com';

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email === ADMIN_EMAIL) {
            document.body.classList.add('auth-verified');
            loadUsers();
            return;
        }
        
        // Check role
        const profileRef = ref(db, `users/${user.uid}/profile/role`);
        onValue(profileRef, (snap) => {
            if (snap.val() === 'admin') {
                document.body.classList.add('auth-verified');
                loadUsers();
            } else {
                window.location.replace('login.html');
            }
        }, { onlyOnce: true });
    } else {
        window.location.replace('login.html');
    }
});

import { processExcelData, importProductsToFirebase } from './excel-import.js';

// Firebase References
const productsRef = ref(db, 'products');
const settingsRef = ref(db, 'settings');
const bannersRef = ref(db, 'banners');

// DOM Elements
const productForm = document.getElementById('productForm');
const productFormElement = document.getElementById('productFormElement');

// Banner Elements
const bannerFormElement = document.getElementById('bannerFormElement');
const bannerTitle = document.getElementById('bannerTitle');
const bannerSubtitle = document.getElementById('bannerSubtitle');
const bannerLink = document.getElementById('bannerLink');
const bannerActive = document.getElementById('bannerActive');
const bannerImage = document.getElementById('bannerImage');
const uploadBannerBtn = document.getElementById('uploadBannerBtn');
const bannerUploadStatus = document.getElementById('bannerUploadStatus');
const bannersTableBody = document.getElementById('bannersTableBody');
const formTitle = document.getElementById('formTitle');
const productsTableBody = document.getElementById('productsTableBody');
const myShopProductsTableBody = document.getElementById('myShopProductsTableBody');
const addProductBtn = document.getElementById('addProductBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const logoutBtn = document.getElementById('logoutBtn');
const themeToggle = document.getElementById('themeToggle');
const featuredVisibleToggle = document.getElementById('featuredVisible');
const allProductsVisibleToggle = document.getElementById('allProductsVisible');
const myShopVisibleToggle = document.getElementById('myShopVisible');
const imageUrlInput = document.getElementById('imageUrl');
const imageFileInput = document.getElementById('imageFile');
const imagePreview = document.getElementById('imagePreview');
const excelFileInput = document.getElementById('excelFileInput');
const importExcelBtn = document.getElementById('importExcelBtn');

// Filter Elements
const adminSearchInput = document.getElementById('adminSearchInput');
const adminCategoryFilter = document.getElementById('adminCategoryFilter');
const showFeaturedOnlyBtn = document.getElementById('showFeaturedOnly');
const clearFiltersBtn = document.getElementById('clearFilters');

// My Shop Filter Elements
const myShopSearchInput = document.getElementById('myShopSearchInput');
const myShopCategoryFilter = document.getElementById('myShopCategoryFilter');
const myShopFeaturedOnlyBtn = document.getElementById('myShopFeaturedOnly');
const myShopClearFiltersBtn = document.getElementById('myShopClearFilters');

// Filter State
let currentFilters = {
    main: {
        search: '',
        category: '',
        featuredOnly: false
    },
    myShop: {
    search: '',
    category: '',
    featuredOnly: false
    }
};

// Global variable to store images
let productImages = [];

// Generate unique ID
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Firebase Operations
async function updateProducts(products) {
    try {
        await set(productsRef, products);
        showNotification('Products updated successfully!');
    } catch (error) {
        console.error('Error updating products:', error);
        showNotification('Error updating products', 'error');
    }
}

async function updateSettings(settings) {
    try {
        await set(settingsRef, settings);
        showNotification('Settings updated successfully!');
    } catch (error) {
        console.error('Error updating settings:', error);
        showNotification('Error updating settings', 'error');
    }
}

// Initialize image preview handlers
function setupImagePreview() {
    // Clear productImages when showing form
    productImages = [];
    
    imageFileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            for (const file of e.target.files) {
                // Check file size (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showNotification(`Image ${file.name} is too large (max 2MB)`, 'error');
                    continue;
        }

                // Check file type
                if (!file.type.startsWith('image/')) {
                    showNotification(`File ${file.name} is not an image`, 'error');
                    continue;
                }

                try {
                    const base64Image = await convertImageToBase64(file);
                    // Check if image already exists in productImages
                    if (!productImages.includes(base64Image)) {
                        productImages.push(base64Image);
                        showNotification(`Image ${file.name} added successfully!`, 'success');
                    } else {
                        showNotification(`Image ${file.name} already exists`, 'warning');
                    }
                } catch (error) {
                    console.error('Error reading image:', error);
                    showNotification(`Error reading image ${file.name}`, 'error');
                }
            }
            updateImagePreview();
        }
    });
}

function showImagePreview(src) {
    imagePreview.innerHTML = `
        <img src="${src}" alt="Preview" style="max-width: 200px; max-height: 200px; object-fit: contain;">
        <div style="margin-top: 10px; color: green;">✓ Image ready for upload</div>
    `;
    imagePreview.classList.add('active');
}

// Product Form Management
function showProductForm(product = null) {
    formTitle.textContent = product ? 'Edit Product' : 'Add New Product';
    productForm.style.display = 'block';
    productFormElement.reset(); // Reset form first
    imagePreview.innerHTML = ''; // Clear preview
    imagePreview.classList.remove('active');
    
    // Clear existing image URLs
    const imageUrlList = document.querySelector('.image-url-list');
    imageUrlList.innerHTML = '';
    
    // Reset productImages array
    productImages = [];

    if (product) {
        document.getElementById('productId').value = product.id;
        document.getElementById('title').value = product.title || '';
        document.getElementById('brand').value = product.brand || '';
        document.getElementById('category').value = product.category || '';
        document.getElementById('originalPrice').value = product.originalPrice || '';
        document.getElementById('discountedPrice').value = product.discountedPrice || '';
        document.getElementById('discountPercentage').value = product.discountPercentage || '';
        document.getElementById('rating').value = product.rating || '';
        document.getElementById('ratingCount').value = product.ratingCount || '';
        document.getElementById('offerTag').value = product.offerTag || '';
        document.getElementById('deliveryInfo').value = product.deliveryInfo || '';
        document.getElementById('description').value = product.description || '';
        document.getElementById('productUrl').value = product.productUrl || '';
        document.getElementById('whatsappNumber').value = product.whatsappNumber || '919951806045';
        document.getElementById('featured').checked = product.featured || false;
        document.getElementById('myShop').checked = product.myShop || false;

        // Handle multiple images
        if (product.images && Array.isArray(product.images)) {
            // Add all images to productImages array
            productImages = [...product.images];
            
            // Create URL inputs for each image
            product.images.forEach((imageUrl, index) => {
                if (index === 0) {
                    // Set the first image to the main image URL input
                    imageUrlInput.value = imageUrl;
                } else {
                    // Add additional image URLs
                    addImageUrlInput(imageUrl);
                }
            });
            
            // Update image preview
            updateImagePreview();
        } else if (product.imageUrl) {
            // Handle legacy single image
            imageUrlInput.value = product.imageUrl;
            productImages = [product.imageUrl];
            updateImagePreview();
        }
    } else {
        document.getElementById('productId').value = '';
        document.getElementById('whatsappNumber').value = '919951806045';
        // Add one empty image URL input
        addImageUrlInput();
    }

    // Scroll to the form for better visibility
    productForm.scrollIntoView({ behavior: 'smooth' });
}

function hideProductForm() {
    productForm.style.display = 'none';
    productFormElement.reset();
    imagePreview.innerHTML = '';
    imagePreview.classList.remove('active');
}

// Firebase Operations
async function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    showNotification('Processing... Please wait', 'success');
    
    const formData = new FormData(event.target);
    const productId = formData.get('productId') || generateUniqueId();

    try {
        // Get all image URLs from inputs
        const imageUrlInputs = document.querySelectorAll('.image-url-input');
        const imageUrls = Array.from(imageUrlInputs)
            .map(input => input.value)
            .filter(url => url.trim() !== '');

        // Create a Set to store unique images
        const uniqueImages = new Set([...imageUrls]);
        
        // Add uploaded images only if they're not already in the set
        productImages.forEach(image => {
            if (!uniqueImages.has(image)) {
                uniqueImages.add(image);
            }
        });

        // Convert Set back to array
        const allImages = Array.from(uniqueImages).filter(Boolean);

        const product = {
            id: productId,
            title: formData.get('title'),
            description: formData.get('description'),
            brand: formData.get('brand'),
            category: formData.get('category'),
            originalPrice: parseFloat(formData.get('originalPrice')),
            discountedPrice: parseFloat(formData.get('discountedPrice')),
            discountPercentage: parseInt(formData.get('discountPercentage')) || 0,
            rating: parseFloat(formData.get('rating')) || 0,
            ratingCount: parseInt(formData.get('ratingCount')) || 0,
            featured: formData.get('featured') === 'on',
            myShop: formData.get('myShop') === 'on',
            productUrl: formData.get('productUrl'),
            deliveryInfo: formData.get('deliveryInfo'),
            offerTag: formData.get('offerTag'),
            whatsappNumber: formData.get('whatsappNumber')
        };

        // Only add images if there are any
        if (allImages.length > 0) {
            product.images = allImages;
            product.imageUrl = allImages[0]; // Keep first image as main image for compatibility
        }

        // Update the existing product or create a new one
        await set(ref(db, `products/${productId}`), product);
        showNotification('✅ Product saved successfully!');
        hideProductForm();
        displayProducts();
    } catch (error) {
        console.error('Error saving product:', error);
        showNotification('❌ Error saving product: ' + error.message, 'error');
    }
}

// Product Display Management
function displayProducts() {
    const productsListener = onValue(productsRef, (snapshot) => {
        const productsData = snapshot.val() || {};
        let products = Object.keys(productsData).map(key => ({ id: key, ...productsData[key] }));
        
        // Separate My Shop products from regular products
        let regularProducts = products.filter(product => !product.myShop);
        let myShopProducts = products.filter(product => product.myShop);

        // Apply filters to regular products
        let filteredProducts = [...regularProducts];
        if (currentFilters.main.search) {
            const searchTerm = currentFilters.main.search.toLowerCase();
            filteredProducts = filteredProducts.filter(product =>
                (product.title?.toLowerCase() || '').includes(searchTerm) ||
                (product.brand?.toLowerCase() || '').includes(searchTerm) ||
                (product.description?.toLowerCase() || '').includes(searchTerm) ||
                (product.category?.toLowerCase() || '').includes(searchTerm)
            );
        }
        if (currentFilters.main.category) {
            filteredProducts = filteredProducts.filter(product =>
                product.category === currentFilters.main.category
            );
        }
        if (currentFilters.main.featuredOnly) {
            filteredProducts = filteredProducts.filter(product =>
                product.featured
            );
        }

        // Apply filters to My Shop products
        let filteredMyShopProducts = [...myShopProducts];
        if (currentFilters.myShop.search) {
            const searchTerm = currentFilters.myShop.search.toLowerCase();
            filteredMyShopProducts = filteredMyShopProducts.filter(product =>
                (product.title?.toLowerCase() || '').includes(searchTerm) ||
                (product.brand?.toLowerCase() || '').includes(searchTerm) ||
                (product.description?.toLowerCase() || '').includes(searchTerm) ||
                (product.category?.toLowerCase() || '').includes(searchTerm)
            );
        }
        if (currentFilters.myShop.category) {
            filteredMyShopProducts = filteredMyShopProducts.filter(product =>
                product.category === currentFilters.myShop.category
            );
        }
        if (currentFilters.myShop.featuredOnly) {
            filteredMyShopProducts = filteredMyShopProducts.filter(product =>
                product.featured
            );
        }

        // Update main products table
        productsTableBody.innerHTML = filteredProducts.map(product => `
            <tr>
                <td>
                    <input type="checkbox" class="product-checkbox" data-product-id="${product.id}" onchange="updateDeleteButton()">
                </td>
                <td class="image-cell">
                    <div class="product-image-container">
                        <img src="${product.images?.[0] || product.imageUrl || 'https://via.placeholder.com/50'}" 
                             alt="${product.title}" 
                             class="product-image"
                             onerror="this.src='https://via.placeholder.com/50'"
                             title="${product.images?.length > 1 ? `+${product.images.length - 1} more images` : ''}">
                        ${product.images?.length > 1 ? `<span class="image-count">+${product.images.length - 1}</span>` : ''}
                    </div>
                </td>
                <td>${product.title || 'N/A'}</td>
                <td>${product.brand || 'N/A'}</td>
                <td>${product.category || 'N/A'}</td>
                <td>${product.discountedPrice ? `₹${product.discountedPrice}` : 'N/A'}</td>
                <td>${product.featured ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick='editProduct(${JSON.stringify(product).replace(/'/g, "&#39;")})'>Edit</button>
                    <button class="btn btn-secondary btn-sm" onclick='duplicateProduct(${JSON.stringify(product).replace(/'/g, "&#39;")})'>
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product.id}')">Delete</button>
                </td>
            </tr>
        `).join('');

        // Update My Shop products table
        myShopProductsTableBody.innerHTML = filteredMyShopProducts.map(product => `
            <tr>
                <td>
                    <input type="checkbox" class="my-shop-checkbox" data-product-id="${product.id}" onchange="updateDeleteButton()">
                </td>
                <td class="image-cell">
                    <div class="product-image-container">
                        <img src="${product.images?.[0] || product.imageUrl || 'https://via.placeholder.com/50'}" 
                             alt="${product.title}" 
                             class="product-image"
                             onerror="this.src='https://via.placeholder.com/50'"
                             title="${product.images?.length > 1 ? `+${product.images.length - 1} more images` : ''}">
                        ${product.images?.length > 1 ? `<span class="image-count">+${product.images.length - 1}</span>` : ''}
                    </div>
                </td>
                <td>${product.title || 'N/A'}</td>
                <td>${product.brand || 'N/A'}</td>
                <td>${product.category || 'N/A'}</td>
                <td>${product.discountedPrice ? `₹${product.discountedPrice}` : 'N/A'}</td>
                <td>${product.featured ? 'Yes' : 'No'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick='editProduct(${JSON.stringify(product).replace(/'/g, "&#39;")})'>Edit</button>
                    <button class="btn btn-secondary btn-sm" onclick='duplicateProduct(${JSON.stringify(product).replace(/'/g, "&#39;")})'>
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product.id}')">Delete</button>
                </td>
            </tr>
        `).join('');

        // Update category filters
        updateCategoryFilter(regularProducts, adminCategoryFilter, 'main');
        updateCategoryFilter(myShopProducts, myShopCategoryFilter, 'myShop');
        updateDeleteButton();
    });

    // Clean up listener when function is called again
    if (window.currentProductsListener) {
        window.currentProductsListener();
    }
    window.currentProductsListener = productsListener;
}

// Bulk Selection Functions
function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.product-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
    updateDeleteButton();
}

function toggleSelectAllMyShop(checkbox) {
    const checkboxes = document.querySelectorAll('.my-shop-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
    updateDeleteButton();
}

function updateDeleteButton() {
    const regularCheckboxes = document.querySelectorAll('.product-checkbox:checked');
    const myShopCheckboxes = document.querySelectorAll('.my-shop-checkbox:checked');
    const totalSelected = regularCheckboxes.length + myShopCheckboxes.length;
    
    deleteSelectedBtn.style.display = totalSelected > 0 ? 'inline-block' : 'none';
    deleteSelectedBtn.textContent = `Delete Selected (${totalSelected})`;
}

async function deleteSelectedProducts() {
    const regularCheckboxes = document.querySelectorAll('.product-checkbox:checked');
    const myShopCheckboxes = document.querySelectorAll('.my-shop-checkbox:checked');
    const totalSelected = regularCheckboxes.length + myShopCheckboxes.length;
    
    if (totalSelected === 0) return;

    const productIds = [
        ...Array.from(regularCheckboxes).map(cb => cb.dataset.productId),
        ...Array.from(myShopCheckboxes).map(cb => cb.dataset.productId)
    ];

    if (!confirm(`Are you sure you want to delete ${totalSelected} selected products?`)) return;

    try {
        for (const productId of productIds) {
            const productRef = ref(db, `products/${productId}`);
            await remove(productRef);
        }
        showNotification(`✅ ${totalSelected} products deleted successfully!`);
        document.getElementById('selectAllCheckbox').checked = false;
        document.getElementById('selectAllMyShopCheckbox').checked = false;
        updateDeleteButton();
    } catch (error) {
        console.error('Error deleting products:', error);
        showNotification(`❌ Error deleting products: ${error.message}`, 'error');
    }
}

// Product Operations
async function deleteProduct(productId) {
    if (!productId) {
        showNotification('Error: Product ID is missing.', 'error');
        return;
    }
    if (!confirm(`Are you sure you want to delete product ID: ${productId}?`)) return;

    const productRef = ref(db, `products/${productId}`);

    try {
        await remove(productRef);
        showNotification(`Product ${productId} deleted successfully!`);
    } catch (error) {
        console.error('Error deleting product:', error);
        showNotification(`Error deleting product: ${error.message}`, 'error');
    }
}

async function duplicateProduct(product) {
    const duplicatedProduct = {
        ...product,
        id: generateUniqueId(), // Generate new ID
        title: `${product.title || 'Product'} (Copy)`
    };
    
    try {
        await set(ref(db, `products/${duplicatedProduct.id}`), duplicatedProduct);
        showNotification('Product duplicated successfully!');
        displayProducts(); // Refresh the table
    } catch (error) {
        console.error('Error duplicating product:', error);
        showNotification('Error duplicating product', 'error');
    }
}

// Filter Management
function updateCategoryFilter(products, filterElement, section) {
    if (!filterElement) return;
    
    const categories = [...new Set(products.map(product => product.category))];
    filterElement.innerHTML = `
        <option value="">All Categories</option>
        ${categories.map(category => `
            <option value="${category}" ${currentFilters[section].category === category ? 'selected' : ''}>
                ${category}
            </option>
        `).join('')}
    `;
}

function handleSearchInput(e, section) {
    currentFilters[section].search = e.target.value;
    displayProducts();
}

function handleCategoryChange(e, section) {
    currentFilters[section].category = e.target.value;
    displayProducts();
}

function handleFeaturedToggle(section) {
    currentFilters[section].featuredOnly = !currentFilters[section].featuredOnly;
    const button = section === 'main' ? showFeaturedOnlyBtn : myShopFeaturedOnlyBtn;
    button.classList.toggle('active');
    displayProducts();
}

function clearFilters(section) {
    currentFilters[section] = {
        search: '',
        category: '',
        featuredOnly: false
    };
    
    if (section === 'main') {
    adminSearchInput.value = '';
    adminCategoryFilter.value = '';
    showFeaturedOnlyBtn.classList.remove('active');
    } else {
        myShopSearchInput.value = '';
        myShopCategoryFilter.value = '';
        myShopFeaturedOnlyBtn.classList.remove('active');
    }
    
    displayProducts();
}

// Theme Management
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('darkMode', isDarkMode);
}

// Visibility Management
async function handleVisibilityChange() {
    const settings = {
        sectionVisibility: {
            featuredProducts: featuredVisibleToggle.checked,
            allProducts: allProductsVisibleToggle.checked,
            myShop: myShopVisibleToggle.checked
        }
    };
    try {
        await updateSettings(settings);
        showNotification('Visibility settings updated successfully!');
    } catch (error) {
        console.error('Error updating visibility settings:', error);
        showNotification('Error updating visibility settings', 'error');
    }
}

// Notifications
function showNotification(message, type = 'success') {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px 25px';
    notification.style.borderRadius = '5px';
    notification.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
    notification.style.color = 'white';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    notification.style.zIndex = '1000';
    notification.style.animation = 'slideIn 0.5s ease-out';
    notification.style.minWidth = '300px';
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Set a clear timeout for exactly 3 seconds
    const timeoutId = setTimeout(() => {
        notification.style.animation = 'slideOut 0.5s ease-in';
        notification.addEventListener('animationend', () => {
        notification.remove();
            style.remove();
        });
    }, 3000);

    // Store the timeout ID on the notification element
    notification.dataset.timeoutId = timeoutId;
}

// Excel Import Functions
async function handleExcelImport(event) {
    const file = event.target.files[0];
    if (!file) {
        showNotification('No file selected', 'error');
        return;
    }

    // Check file extension
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(fileExtension)) {
        showNotification('Please select an Excel file (.xlsx or .xls)', 'error');
        return;
    }

    // Reset the file input to ensure it triggers change event next time
    event.target.value = '';

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                console.log('Reading Excel file...');
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get the first sheet
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                console.log('Sheet loaded:', workbook.SheetNames[0]);
                
                // Convert to JSON with header: 1 to get array of arrays
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                console.log('Excel data rows:', jsonData.length);

                if (jsonData.length < 2) {
                    throw new Error('Excel file is empty or contains only headers');
                }

                // Show processing notification
                showNotification('Processing Excel file...', 'success');

                // Process the Excel data
                console.log('Processing Excel data...');
                const products = processExcelData(jsonData);
                console.log('Processed products:', products.length);
                
                // Import products to Firebase
                console.log('Importing to Firebase...');
                const importedCount = await importProductsToFirebase(products);
                
                // Show success notification with count
                showNotification(`✅ Successfully imported ${importedCount} products from Excel!`, 'success');
                displayProducts(); // Refresh the display
            } catch (error) {
                console.error('Excel processing error:', error);
                showNotification(`❌ Error processing Excel file: ${error.message}`, 'error');
            }
        };

        reader.onerror = function(error) {
            console.error('FileReader error:', error);
            showNotification('❌ Error reading the file', 'error');
        };

        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error('Excel import error:', error);
        showNotification(`❌ Error reading Excel file: ${error.message}`, 'error');
    }
}

// Function to add new image URL input
function addImageUrlInput(initialValue = '') {
    const imageUrlList = document.querySelector('.image-url-list');
    const inputGroup = document.createElement('div');
    inputGroup.className = 'image-url-input-group';
    inputGroup.innerHTML = `
        <input type="url" class="image-url-input" placeholder="Enter image URL" value="${initialValue}">
        <button type="button" class="remove-url" onclick="removeImageUrl(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    imageUrlList.appendChild(inputGroup);
}

// Function to remove image URL input
function removeImageUrl(button) {
    button.closest('.image-url-input-group').remove();
}

// Function to remove image from preview
function removeImage(index) {
    productImages.splice(index, 1);
    updateImagePreview();
}

// Function to update image preview
function updateImagePreview() {
    const previewContainer = document.getElementById('imagePreview');
    previewContainer.innerHTML = productImages.map((image, index) => `
        <div class="image-preview-item">
            <img src="${image}" alt="Preview ${index + 1}">
            <button type="button" class="remove-image" onclick="removeImage(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// Initialize
function initializeAdminPanel() {
    setupImagePreview();
    displayProducts();
    
    // Event Listeners
    addProductBtn.addEventListener('click', () => showProductForm());
    deleteSelectedBtn.addEventListener('click', deleteSelectedProducts);
    productFormElement.addEventListener('submit', handleFormSubmit);
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('isAdminAuthenticated');
        window.location.href = 'login.html';
    });
    themeToggle.addEventListener('click', toggleTheme);
    featuredVisibleToggle.addEventListener('change', handleVisibilityChange);
    allProductsVisibleToggle.addEventListener('change', handleVisibilityChange);
    myShopVisibleToggle.addEventListener('change', handleVisibilityChange);
    adminSearchInput.addEventListener('input', (e) => handleSearchInput(e, 'main'));
    adminCategoryFilter.addEventListener('change', (e) => handleCategoryChange(e, 'main'));
    showFeaturedOnlyBtn.addEventListener('click', () => handleFeaturedToggle('main'));
    clearFiltersBtn.addEventListener('click', () => clearFilters('main'));

    // Excel import event listeners
    importExcelBtn.addEventListener('click', () => {
        // Clear the file input before clicking
        excelFileInput.value = '';
        excelFileInput.click();
    });
    excelFileInput.addEventListener('change', handleExcelImport);

    // My Shop filter event listeners
    if (myShopSearchInput) {
        myShopSearchInput.addEventListener('input', (e) => handleSearchInput(e, 'myShop'));
    }
    if (myShopCategoryFilter) {
        myShopCategoryFilter.addEventListener('change', (e) => handleCategoryChange(e, 'myShop'));
    }
    if (myShopFeaturedOnlyBtn) {
        myShopFeaturedOnlyBtn.addEventListener('click', () => handleFeaturedToggle('myShop'));
    }
    if (myShopClearFiltersBtn) {
        myShopClearFiltersBtn.addEventListener('click', () => clearFilters('myShop'));
    }

    // Load initial theme
    const savedTheme = localStorage.getItem('darkMode') === 'true';
    if (savedTheme) {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Load initial visibility settings
    onValue(settingsRef, (snapshot) => {
        const settings = snapshot.val() || { 
            sectionVisibility: { 
                featuredProducts: true, 
                allProducts: true,
                myShop: true 
            } 
        };
        if (featuredVisibleToggle) featuredVisibleToggle.checked = settings.sectionVisibility.featuredProducts;
        if (allProductsVisibleToggle) allProductsVisibleToggle.checked = settings.sectionVisibility.allProducts;
        if (myShopVisibleToggle) myShopVisibleToggle.checked = settings.sectionVisibility.myShop;
    }, { onlyOnce: true });
}

// Make functions available globally
// ==========================================
// Banner Management Functions
// ==========================================

window.removeBannerImage = function() {
    const bannerImage = document.getElementById('bannerImage');
    if (bannerImage) bannerImage.value = '';
    const bannerImagePreview = document.getElementById('bannerImagePreview');
    if (bannerImagePreview) {
        bannerImagePreview.innerHTML = '';
        bannerImagePreview.classList.remove('active');
    }
};

async function handleBannerSubmit(e) {
    e.preventDefault();
    const bannerImage = document.getElementById('bannerImage');
    const file = bannerImage ? bannerImage.files[0] : null;
    const bannerImageUrl = document.getElementById('bannerImageUrl');
    const bannerUrlValue = bannerImageUrl ? bannerImageUrl.value.trim() : '';
    
    if (!file && !bannerUrlValue) {
        bannerUploadStatus.innerHTML = '<span style="color: var(--danger-color);">Please provide an image URL or upload a file.</span>';
        return;
    }

    uploadBannerBtn.disabled = true;
    uploadBannerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    bannerUploadStatus.innerHTML = 'Processing banner...';

    try {
        let downloadURL = bannerUrlValue;

        if (file) {
            bannerUploadStatus.innerHTML = 'Processing image...';
            downloadURL = await convertImageToBase64(file);
        }

        bannerUploadStatus.innerHTML = 'Saving banner to Database...';

        const bannerTitleColor = document.getElementById('bannerTitleColor') ? document.getElementById('bannerTitleColor').value : '#ffffff';
        const bannerSubtitleColor = document.getElementById('bannerSubtitleColor') ? document.getElementById('bannerSubtitleColor').value : '#ffffff';
        const bannerTitleFont = document.getElementById('bannerTitleFont') ? document.getElementById('bannerTitleFont').value : 'Inter, sans-serif';
        const bannerSubtitleFont = document.getElementById('bannerSubtitleFont') ? document.getElementById('bannerSubtitleFont').value : 'Inter, sans-serif';
        const bannerButtonText = document.getElementById('bannerButtonText') ? document.getElementById('bannerButtonText').value.trim() : '';
        const bannerButtonStyle = document.getElementById('bannerButtonStyle') ? document.getElementById('bannerButtonStyle').value : 'btn-primary';
        const bannerButtonBgColor = document.getElementById('bannerButtonBgColor') ? document.getElementById('bannerButtonBgColor').value : '#0f172a';
        const bannerButtonTextColor = document.getElementById('bannerButtonTextColor') ? document.getElementById('bannerButtonTextColor').value : '#ffffff';
        const bannerAlignment = document.getElementById('bannerAlignment') ? document.getElementById('bannerAlignment').value : 'center';
        const bannerWholeClickable = document.getElementById('bannerWholeClickable') ? document.getElementById('bannerWholeClickable').checked : true;

        const bannerIdField = document.getElementById('bannerId');
        const isUpdate = bannerIdField && bannerIdField.value;
        const targetRef = isUpdate ? ref(db, `banners/${bannerIdField.value}`) : push(bannersRef);
        
        await set(targetRef, {
            id: targetRef.key,
            imageUrl: downloadURL,
            title: bannerTitle.value.trim(),
            titleColor: bannerTitleColor,
            titleFont: bannerTitleFont,
            subtitle: bannerSubtitle.value.trim(),
            subtitleColor: bannerSubtitleColor,
            subtitleFont: bannerSubtitleFont,
            buttonText: bannerButtonText,
            buttonStyle: bannerButtonStyle,
            buttonBgColor: bannerButtonBgColor,
            buttonTextColor: bannerButtonTextColor,
            alignment: bannerAlignment,
            wholeClickable: bannerWholeClickable,
            link: bannerLink.value.trim(),
            active: bannerActive.checked,
            createdAt: isUpdate ? (window.allBanners[targetRef.key]?.createdAt || Date.now()) : Date.now()
        });

        bannerUploadStatus.innerHTML = `<span style="color: var(--success-color);">Banner ${isUpdate ? 'updated' : 'added'} successfully!</span>`;
        bannerFormElement.reset();
        window.removeBannerImage();
        if (bannerIdField) bannerIdField.value = '';
        uploadBannerBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Banner';
        
        setTimeout(() => {
            bannerUploadStatus.innerHTML = '';
        }, 3000);
    } catch (error) {
        console.error("Error uploading banner:", error);
        bannerUploadStatus.innerHTML = `<span style="color: var(--danger-color);">Error: ${error.message}</span>`;
    } finally {
        uploadBannerBtn.disabled = false;
        if (!document.getElementById('bannerId')?.value) {
            uploadBannerBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Banner';
        }
    }
}

window.editBanner = function(id) {
    const banner = window.allBanners[id];
    if (!banner) return;
    
    let idField = document.getElementById('bannerId');
    if (!idField) {
        idField = document.createElement('input');
        idField.type = 'hidden';
        idField.id = 'bannerId';
        idField.name = 'bannerId';
        document.getElementById('bannerFormElement').appendChild(idField);
    }
    idField.value = banner.id;

    document.getElementById('bannerTitle').value = banner.title || '';
    if (document.getElementById('bannerTitleColor')) document.getElementById('bannerTitleColor').value = banner.titleColor || '#ffffff';
    if (document.getElementById('bannerTitleFont')) document.getElementById('bannerTitleFont').value = banner.titleFont || 'Inter, sans-serif';
    document.getElementById('bannerSubtitle').value = banner.subtitle || '';
    if (document.getElementById('bannerSubtitleColor')) document.getElementById('bannerSubtitleColor').value = banner.subtitleColor || '#ffffff';
    if (document.getElementById('bannerSubtitleFont')) document.getElementById('bannerSubtitleFont').value = banner.subtitleFont || 'Inter, sans-serif';
    if (document.getElementById('bannerButtonText')) document.getElementById('bannerButtonText').value = banner.buttonText || '';
    if (document.getElementById('bannerButtonStyle')) {
        document.getElementById('bannerButtonStyle').value = banner.buttonStyle || 'btn-primary';
        document.getElementById('bannerButtonStyle').dispatchEvent(new Event('change'));
    }
    if (document.getElementById('bannerButtonBgColor')) document.getElementById('bannerButtonBgColor').value = banner.buttonBgColor || '#0f172a';
    if (document.getElementById('bannerButtonTextColor')) document.getElementById('bannerButtonTextColor').value = banner.buttonTextColor || '#ffffff';
    if (document.getElementById('bannerAlignment')) document.getElementById('bannerAlignment').value = banner.alignment || 'center';
    if (document.getElementById('bannerWholeClickable')) document.getElementById('bannerWholeClickable').checked = banner.wholeClickable !== false;
    document.getElementById('bannerLink').value = banner.link || '';
    document.getElementById('bannerActive').checked = banner.active;
    
    const bannerImageUrl = document.getElementById('bannerImageUrl');
    if (bannerImageUrl) bannerImageUrl.value = banner.imageUrl || '';
    
    if (banner.imageUrl) {
        const bannerImagePreview = document.getElementById('bannerImagePreview');
        if (bannerImagePreview) {
            bannerImagePreview.innerHTML = `
                <div class="image-preview-item">
                    <img src="${banner.imageUrl}" alt="Banner Preview" style="max-width: 200px; max-height: 200px; object-fit: contain;">
                    <button type="button" class="remove-image" onclick="removeBannerImage()">
                        <i class="fas fa-times"></i>
                    </button>
                    <div style="margin-top: 10px; color: green; font-size: 0.9rem;">Current Image</div>
                </div>
            `;
            bannerImagePreview.classList.add('active');
        }
    }

    document.getElementById('uploadBannerBtn').innerHTML = '<i class="fas fa-save"></i> Update Banner';
    window.showBannerForm();
};

window.allBanners = {};

function loadBanners() {
    onValue(bannersRef, (snapshot) => {
        if (!bannersTableBody) return;
        bannersTableBody.innerHTML = '';
        const banners = [];
        window.allBanners = {};
        
        snapshot.forEach((childSnapshot) => {
            const banner = childSnapshot.val();
            banners.push(banner);
            window.allBanners[banner.id] = banner;
        });

        if (banners.length === 0) {
            bannersTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No banners found.</td></tr>';
            return;
        }

        // Sort by newest first
        banners.sort((a, b) => b.createdAt - a.createdAt);

        banners.forEach(banner => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${banner.imageUrl}" style="width: 100px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                <td>
                    <strong>${banner.title || '(No Title)'}</strong><br>
                    <span style="font-size: 0.8rem; color: #666;">${banner.subtitle || ''}</span>
                    ${banner.link ? `<br><a href="${banner.link}" target="_blank" style="font-size: 0.8rem; color: var(--primary-color);">Link</a>` : ''}
                </td>
                <td>
                    <span style="padding: 0.3rem 0.6rem; border-radius: 12px; font-size: 0.8rem; font-weight: 500; background: ${banner.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${banner.active ? 'var(--success-color)' : 'var(--danger-color)'};">
                        ${banner.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn" style="padding: 0.4rem 0.8rem; background: var(--primary-color); color: white; margin-bottom: 0.5rem;" onclick="editBanner('${banner.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn" style="padding: 0.4rem 0.8rem; background: var(--danger-color); color: white; margin-bottom: 0.5rem;" onclick="deleteBanner('${banner.id}', '${banner.storagePath}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="btn" style="padding: 0.4rem 0.8rem; background: var(--secondary-color); color: white;" onclick="toggleBannerStatus('${banner.id}', ${banner.active})">
                        ${banner.active ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            `;
            bannersTableBody.appendChild(tr);
        });
    });
}

window.removeImage = function(index) {
    if (confirm('Are you sure you want to remove this image?')) {
        const fileRef = storageRef(storage, `products/${Date.now()}_${index}`);
        uploadedFiles.splice(index, 1);
        updateImagePreview();
    }
};

window.switchTab = function(tabId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(tabId + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
        li.classList.remove('active');
    });

    // Find and set the active nav item based on the onclick attribute
    const navItem = Array.from(document.querySelectorAll('.sidebar-nav li')).find(li => li.getAttribute('onclick') === `switchTab('${tabId}')`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Auto-hide the product form when switching tabs if it's open
    if (tabId !== 'all-products' && tabId !== 'my-shop') {
        window.hideProductForm();
    }

    // Auto-close sidebar on mobile
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
    if (backdrop && backdrop.classList.contains('open')) {
        backdrop.classList.remove('open');
    }
};

window.deleteBanner = async (id, storagePath) => {
    if (confirm('Are you sure you want to delete this banner?')) {
        try {
            if (storagePath && storagePath !== 'undefined' && storagePath !== 'null') {
                const fileRef = storageRef(storage, storagePath);
                await deleteObject(fileRef).catch(e => console.log('Storage deletion skipped', e));
            }
            await remove(ref(db, `banners/${id}`));
        } catch (error) {
            console.error("Error deleting banner:", error);
            alert("Error deleting banner. Please check console.");
        }
    }
};

window.toggleBannerStatus = async (id, currentStatus) => {
    try {
        await set(ref(db, `banners/${id}/active`), !currentStatus);
    } catch (error) {
        console.error("Error toggling banner status:", error);
    }
};

// Make functions available globally
window.showProductForm = showProductForm;
window.hideProductForm = hideProductForm;
window.editProduct = showProductForm;
window.duplicateProduct = duplicateProduct;
window.deleteProduct = deleteProduct;
window.toggleSelectAll = toggleSelectAll;
window.toggleSelectAllMyShop = toggleSelectAllMyShop;
window.updateDeleteButton = updateDeleteButton;
window.deleteSelectedProducts = deleteSelectedProducts;
window.addImageUrlInput = addImageUrlInput;
window.removeImageUrl = removeImageUrl;
window.removeImage = removeImage;

window.showBannerForm = function() {
    const bannerFormContainer = document.getElementById('bannerFormContainer');
    if (bannerFormContainer) {
        bannerFormContainer.style.display = 'block';
        bannerFormContainer.scrollIntoView({ behavior: 'smooth' });
    }
};

window.hideBannerForm = function() {
    const bannerFormContainer = document.getElementById('bannerFormContainer');
    if (bannerFormContainer) {
        bannerFormContainer.style.display = 'none';
        if (bannerFormElement) bannerFormElement.reset();
    }
};

// Initialize event listeners and admin panel
document.addEventListener('DOMContentLoaded', () => {
    initializeAdminPanel();
    
    // Set up banner form
    if (bannerFormElement) {
        bannerFormElement.addEventListener('submit', handleBannerSubmit);
        loadBanners();
        
        const bannerImage = document.getElementById('bannerImage');
        if (bannerImage) {
            bannerImage.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    if (file.size > 2 * 1024 * 1024) {
                        showNotification(`Image is too large (max 2MB)`, 'error');
                        bannerImage.value = '';
                        return;
                    }
                    try {
                        const base64Image = await convertImageToBase64(file);
                        const bannerImagePreview = document.getElementById('bannerImagePreview');
                        bannerImagePreview.innerHTML = `
                            <div class="image-preview-item">
                                <img src="${base64Image}" alt="Banner Preview" style="max-width: 200px; max-height: 200px; object-fit: contain;">
                                <button type="button" class="remove-image" onclick="removeBannerImage()">
                                    <i class="fas fa-times"></i>
                                </button>
                                <div style="margin-top: 10px; color: green; font-size: 0.9rem;">✓ Image ready for upload</div>
                            </div>
                        `;
                        bannerImagePreview.classList.add('active');
                    } catch (error) {
                        console.error('Error reading banner image:', error);
                        showNotification(`Error reading banner image`, 'error');
                    }
                }
            });
        }
    }

    // Set up image preview
    setupImagePreview();
});

// Download Excel Template Function
window.downloadExcelTemplate = function() {
    const headers = ['name', 'price', 'discountPrice', 'category', 'brand', 'stock', 'description', 'featured', 'imageUrl'];
    const csvContent = headers.join(',') + '\n' + 'Sample Product, 99.99, 79.99, Electronics, Sony, 10, "A great product", true, "https://example.com/image.jpg"';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "ValuePro_Product_Template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// =========================================
// Users Management
// =========================================
window.loadUsers = function() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        const usersTableBody = document.getElementById('usersTableBody');
        if (!usersTableBody) return;
        usersTableBody.innerHTML = '';
        const usersData = snapshot.val() || {};
        
        let usersArray = [];
        Object.keys(usersData).forEach(uid => {
            const profile = usersData[uid].profile || {};
            // Skip if no profile exists
            if (!profile.email) return;
            usersArray.push({
                uid: uid,
                email: profile.email || 'Unknown',
                role: profile.role || 'user',
                createdAt: profile.createdAt || Date.now(),
                lastLogin: profile.lastLogin || Date.now()
            });
        });
        
        // Sort by joined at desc
        usersArray.sort((a, b) => b.createdAt - a.createdAt);
        
        // Filter if search
        const searchInput = document.getElementById('userSearchInput');
        if (searchInput && searchInput.value) {
            const q = searchInput.value.toLowerCase();
            usersArray = usersArray.filter(u => u.email.toLowerCase().includes(q));
        }
        
        // Render
        usersArray.forEach(u => {
            const joinedAt = new Date(u.createdAt).toLocaleDateString();
            const lastLogin = new Date(u.lastLogin).toLocaleDateString();
            
            const badgeBg = u.role === 'admin' ? '#10b981' : '#64748b';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.email}</td>
                <td>${joinedAt}</td>
                <td>${lastLogin}</td>
                <td>
                    <span style="background: ${badgeBg}; color: white; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                        ${u.role.toUpperCase()}
                    </span>
                </td>
                <td>
                    <button class="icon-btn btn-secondary" onclick="toggleUserRole('${u.uid}', '${u.role}')" title="Toggle Admin Access">
                        <i class="fas fa-user-shield"></i>
                    </button>
                    <button class="icon-btn btn-danger" onclick="deleteUserRecord('${u.uid}')" title="Delete User Profile">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });
    });
};

window.toggleUserRole = async (uid, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (confirm(`Change user role to ${newRole}?`)) {
        try {
            await set(ref(db, `users/${uid}/profile/role`), newRole);
            showNotification(`User role updated to ${newRole}`);
            // Force reload users list
            window.loadUsers();
        } catch (error) {
            console.error('Error updating role:', error);
            showNotification('Error updating role', 'error');
        }
    }
};

const userSearchInput = document.getElementById('userSearchInput');
if (userSearchInput) {
    userSearchInput.addEventListener('input', window.loadUsers);
}

window.deleteUserRecord = async (uid) => {
    if (confirm('Are you sure you want to completely remove this user from the system? This action cannot be undone.')) {
        try {
            await remove(ref(db, `users/${uid}`));
            showNotification('User deleted successfully');
            // Force reload users list
            window.loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            showNotification('Error deleting user', 'error');
        }
    }
};

window.showAddUserModal = () => {
    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

window.closeAddUserModal = () => {
    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('addUserForm').reset();
    }
};

window.handleAddUser = async (event) => {
    event.preventDefault();
    const btn = document.getElementById('addUserSubmitBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Creating...';
    btn.disabled = true;

    const email = document.getElementById('newUserInfoEmail').value;
    const password = document.getElementById('newUserInfoPassword').value;
    const role = document.getElementById('newUserInfoRole').value;

    try {
        // Create secondary app instance to avoid logging out the current admin
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newUserUid = userCredential.user.uid;
        
        // Save user profile to database
        await set(ref(db, `users/${newUserUid}/profile`), {
            email: email,
            role: role,
            createdAt: Date.now(),
            lastLogin: Date.now()
        });
        
        // Sign out secondary auth and cleanup
        await secondaryAuth.signOut();
        
        showNotification('User created successfully!');
        window.closeAddUserModal();
        window.loadUsers();
    } catch (error) {
        console.error('Error creating user:', error);
        showNotification(error.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};