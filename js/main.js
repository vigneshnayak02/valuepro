import { 
    db, auth, ref, onValue, set, remove,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    EmailAuthProvider, reauthenticateWithCredential, updateEmail, deleteUser
} from './firebase-config.js';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const themeToggle = document.getElementById('themeToggle');
const featuredProductsContainer = document.getElementById('featuredProductsContainer');
const productsContainer = document.getElementById('productsContainer');
const myShopContainer = document.getElementById('myShopContainer');
const wishlistBtn = document.getElementById('wishlistBtn');
const profileBtn = document.getElementById('profileBtn');
const authModal = document.getElementById('authModal');
const wishlistModal = document.getElementById('wishlistModal');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginErrorEl = document.getElementById('loginError');
const signupErrorEl = document.getElementById('signupError');
const wishlistItemsContainer = document.getElementById('wishlistItemsContainer');

// Firebase References
const productsRef = ref(db, 'products');
const settingsRef = ref(db, 'settings');
const bannersRef = ref(db, 'banners');

// Listeners
let productsListener = null;
let settingsListener = null;
let wishlistListener = null;

// App State
let currentUser = null;
let userWishlist = {}; // Store local cache of user's wishlist {productId: true}
let allProductsData = {}; // Cache all products for wishlist display {productId: productData}

// Filter Management
let currentFilters = {
    featured: {
        price: '',
        brand: '',
        discount: '',
        rating: '',
        featured: true,
        search: '',
        category: ''
    },
    all: {
        price: '',
        brand: '',
        discount: '',
        rating: '',
        featured: false,
        search: '',
        category: ''
    },
    myShop: {
        price: '',
        brand: '',
        discount: '',
        rating: '',
        featured: false,
        search: '',
        category: ''
    }
};

// --- Modal Functions --- 
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        // Clear error messages when closing auth modal
        if (modalId === 'authModal') {
            loginErrorEl.textContent = '';
            signupErrorEl.textContent = '';
        }
        // Clear wishlist container when closing wishlist modal
        if (modalId === 'wishlistModal') {
            const wishlistContainer = document.getElementById('wishlistItemsContainer');
            if (wishlistContainer) {
                wishlistContainer.innerHTML = '';
            }
        }
    }
}

function showLogin() {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    loginErrorEl.textContent = '';
    signupErrorEl.textContent = '';
}

function showSignup() {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    loginErrorEl.textContent = '';
    signupErrorEl.textContent = '';
}

// Make modal functions globally accessible from HTML onclick
window.openModal = openModal;
window.closeModal = closeModal;
window.showLogin = showLogin;
window.showSignup = showSignup;
window.scrollToAboutUs = scrollToAboutUs;

// Close modal if clicked outside of content
window.onclick = function(event) {
    if (event.target == authModal) {
        closeModal('authModal');
    }
    if (event.target == wishlistModal) {
        closeModal('wishlistModal');
    }
}
// --- End Modal Functions ---

// --- Authentication Functions --- 
function handleAuthStateChange(user) {
    currentUser = user;
    const loggedOutDropdown = document.getElementById('logged-out-dropdown');
    const loggedInDropdown = document.getElementById('logged-in-dropdown');

    if (user) {
        console.log('User logged in:', user.uid);
        
        // Update logged in dropdown with user info
        const userAvatar = loggedInDropdown.querySelector('.user-avatar');
        const userName = loggedInDropdown.querySelector('.user-name');
        const userEmail = loggedInDropdown.querySelector('.user-email');

        // Set user initial in avatar
        const initial = user.email ? user.email[0].toUpperCase() : '?';
        userAvatar.textContent = initial;

        // Set user email and name
        userEmail.textContent = user.email;
        userName.textContent = user.email.split('@')[0];

        // Ensure both dropdowns are hidden on state change
        loggedOutDropdown.style.display = 'none';
        loggedInDropdown.style.display = 'none';

        // Fetch user's wishlist
        fetchUserWishlist(user.uid);

        // Ensure user profile exists in DB (to show in Admin Users list)
        const userProfileRef = ref(db, `users/${user.uid}/profile`);
        onValue(userProfileRef, (snap) => {
            const data = snap.val() || {};
            
            // Check if there are any admins yet to auto-assign first user as admin
            const usersRef = ref(db, 'users');
            onValue(usersRef, (usersSnap) => {
                const users = usersSnap.val() || {};
                let hasAdmin = false;
                Object.values(users).forEach(u => {
                    if (u.profile && u.profile.role === 'admin') hasAdmin = true;
                });
                
                const role = data.role || (!hasAdmin ? 'admin' : 'user');
                
                set(userProfileRef, {
                    email: user.email,
                    role: role,
                    createdAt: data.createdAt || Date.now(),
                    lastLogin: Date.now()
                });
            }, { onlyOnce: true });
            
        }, { onlyOnce: true });

        closeModal('authModal');

        // Handle Return URL
        const savedReturnUrl = localStorage.getItem('authReturnUrl');
        if (savedReturnUrl) {
            localStorage.removeItem('authReturnUrl');
            window.location.href = savedReturnUrl;
            return;
        }
    } else {
        console.log('User logged out');
        
        // Ensure both dropdowns are hidden on state change
        loggedOutDropdown.style.display = 'none';
        loggedInDropdown.style.display = 'none';

        // Clear wishlist when logged out
        userWishlist = {};
        updateAllWishlistIcons();
    }
}

function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    loginErrorEl.textContent = ''; // Clear previous error

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            console.error("Login error:", error);
            loginErrorEl.textContent = error.message; 
        });
}

function handleSignup(event) {
    event.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    signupErrorEl.textContent = ''; // Clear previous error

    createUserWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            console.error("Signup error:", error);
            signupErrorEl.textContent = error.message;
        });
}

// Function to handle logout
async function handleLogout() {
    try {
        await signOut(auth);
        console.log("Logout successful");
        // The auth state change listener will handle UI updates
    } catch (error) {
        console.error("Logout error:", error);
    }
}

// Initialize page
function initializePage() {
    console.log('Initializing page...');
    
    // Load saved theme
    const savedTheme = localStorage.getItem('darkMode') === 'true';
    if (savedTheme) {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Handle URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
        searchInput.value = searchParam;
        currentFilters.all.search = searchParam;
        currentFilters.featured.search = searchParam;
        currentFilters.myShop.search = searchParam;
        
        // Remove param from URL without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const returnUrl = urlParams.get('returnUrl');
    if (returnUrl) {
        localStorage.setItem('authReturnUrl', returnUrl);
    }

    const openAuthParam = urlParams.get('openAuth');
    if (openAuthParam) {
        setTimeout(() => {
            if (!currentUser) {
                openModal('authModal');
            }
        }, 500);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const openWishlistParam = urlParams.get('openWishlist');
    if (openWishlistParam) {
        setTimeout(() => {
            if (currentUser) {
                openModal('wishlistModal');
            } else {
                openModal('authModal');
            }
        }, 500);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Set up floating navigation buttons
    const myShopFloatingBtn = document.getElementById('myShopFloatingBtn');
    const allProductsFloatingBtn = document.getElementById('allProductsFloatingBtn');
    const featuredFloatingBtn = document.getElementById('featuredFloatingBtn');

    function updateActiveButton(activeBtn) {
        [myShopFloatingBtn, allProductsFloatingBtn, featuredFloatingBtn].forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
    }

    function showOnlySection(sectionId) {
        // Get current visibility settings
        const settings = getCurrentSettings();
        const visibilitySettings = settings?.sectionVisibility || {
            featuredProducts: true,
            allProducts: true,
            myShop: true
        };

        // Map section IDs to their visibility settings
        const sectionVisibilityMap = {
            'featured-products': visibilitySettings?.featuredProducts !== false,
            'all-products': visibilitySettings?.allProducts !== false,
            'my-shop': visibilitySettings?.myShop !== false
        };

        // Hide all sections first
        const sections = ['featured-products', 'all-products', 'my-shop'];
        sections.forEach(id => {
            const section = document.getElementById(id);
            if (section) {
                section.style.display = 'none';
            }
        });

        // Show only the selected section if it's visible in settings
        const selectedSection = document.getElementById(sectionId);
        if (selectedSection && sectionVisibilityMap[sectionId]) {
            selectedSection.style.display = 'block';
            selectedSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Show coming soon popup if section is disabled
            const button = document.querySelector(`#${sectionId.replace('-', '')}FloatingBtn`);
            if (button) {
                showComingSoonPopup(button);
            }
        }
    }

    function getCurrentSettings() {
        const settingsRef = ref(db, 'settings');
        let currentSettings = null;
        onValue(settingsRef, (snapshot) => {
            currentSettings = snapshot.val();
        });
        return currentSettings;
    }

    function showComingSoonPopup(button) {
        // Remove any existing popup
        const existingPopup = button.querySelector('.coming-soon-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Create and show new popup
        const popup = document.createElement('div');
        popup.className = 'coming-soon-popup';
        popup.innerHTML = '<i class="fas fa-clock"></i> Coming Soon';
        button.appendChild(popup);

        // Remove popup after 2 seconds
        setTimeout(() => {
            popup.remove();
        }, 2000);
    }

    if (myShopFloatingBtn) {
        myShopFloatingBtn.addEventListener('click', () => {
            const settings = getCurrentSettings();
            if (settings?.sectionVisibility?.myShop !== false) {
            updateActiveButton(myShopFloatingBtn);
            showOnlySection('my-shop');
            } else {
                showComingSoonPopup(myShopFloatingBtn);
            }
        });
    }

    if (allProductsFloatingBtn) {
        allProductsFloatingBtn.addEventListener('click', () => {
            const settings = getCurrentSettings();
            if (settings?.sectionVisibility?.allProducts !== false) {
            updateActiveButton(allProductsFloatingBtn);
            showOnlySection('all-products');
            } else {
                showComingSoonPopup(allProductsFloatingBtn);
            }
        });
    }

    if (featuredFloatingBtn) {
        featuredFloatingBtn.addEventListener('click', () => {
            const settings = getCurrentSettings();
            if (settings?.sectionVisibility?.featuredProducts !== false) {
            updateActiveButton(featuredFloatingBtn);
            showOnlySection('featured-products');
            } else {
                showComingSoonPopup(featuredFloatingBtn);
            }
        });
    }

    // Listen for Auth state changes
    onAuthStateChanged(auth, handleAuthStateChange);

    // Set up event listeners
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Add event listeners for closing dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        const profileContainer = document.querySelector('.profile-container');
        const dropdowns = document.querySelectorAll('.profile-dropdown');
        
        if (profileContainer && !profileContainer.contains(event.target)) {
            dropdowns.forEach(dropdown => {
                dropdown.style.display = 'none';
            });
        }
    });

        // Settings button click handler (for mobile/touch)
        const settingsBtn = document.querySelector('.settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function(event) {
                event.stopPropagation();
                const settingsDropdown = document.querySelector('.settings-dropdown');
                if (settingsDropdown) {
                    settingsDropdown.classList.toggle('settings-open');
                    const chevron = settingsBtn.querySelector('.chevron-icon');
                    if (chevron) {
                        chevron.classList.toggle('settings-open-chevron');
                    }
                }
            });
        }
        
        // Profile button click handler
    const profileButton = document.querySelector('.profile-button');
    if (profileButton) {
        // Profile dropdown logic
        const loggedInDropdown = document.getElementById('logged-in-dropdown');
        const loggedOutDropdown = document.getElementById('logged-out-dropdown');

        window.toggleProfileDropdown = function(event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            
            if (currentUser) {
                const isHidden = !loggedInDropdown.style.display || loggedInDropdown.style.display === 'none';
                loggedInDropdown.style.display = isHidden ? 'block' : 'none';
                loggedOutDropdown.style.display = 'none';
            } else {
                const isHidden = !loggedOutDropdown.style.display || loggedOutDropdown.style.display === 'none';
                loggedOutDropdown.style.display = isHidden ? 'block' : 'none';
                loggedInDropdown.style.display = 'none';
            }
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            const profileContainer = document.querySelector('.profile-container');
            const navProfile = document.getElementById('navProfile');
            
            // Check if the click is outside both the profile container (header) and the mobile nav profile button
            if (profileContainer && !profileContainer.contains(event.target) && 
                navProfile && !navProfile.contains(event.target)) {
                if (loggedInDropdown) loggedInDropdown.style.display = 'none';
                if (loggedOutDropdown) loggedOutDropdown.style.display = 'none';
            }
        });
    }

    // Attempt to load products from cache for instant loading
    try {
        const cachedStr = localStorage.getItem('cachedProducts');
        if (cachedStr) {
            const cachedData = JSON.parse(cachedStr);
            allProductsData = cachedData;
            const cachedArray = Object.keys(cachedData).map(key => ({ id: key, ...cachedData[key] }));
            updateCategories(cachedArray);
            displayProducts(featuredProductsContainer, cachedArray.filter(p => p.featured));
            displayProducts(productsContainer, cachedArray);
            displayProducts(myShopContainer, cachedArray.filter(p => p.myShop));
        }
    } catch (e) {
        console.error("Error reading cache on home page:", e);
    }

    const productsListener = onValue(productsRef, (snapshot) => {
        const productsData = snapshot.val() || {};
        allProductsData = productsData;
        
        try {
            localStorage.setItem('cachedProducts', JSON.stringify(productsData));
        } catch (e) {}

        const productsArray = Object.keys(productsData).map(key => ({
            id: key,
            ...productsData[key]
        }));
        
        updateCategories(productsArray);
        const featuredProducts = productsArray.filter(p => p.featured);
        const myShopProducts = productsArray.filter(p => p.myShop);
        
        displayProducts(featuredProductsContainer, featuredProducts);
        displayProducts(productsContainer, productsArray);
        displayProducts(myShopContainer, myShopProducts);
        updateAllWishlistIcons();

        // Update wishlist page if we're on it
        if (window.location.pathname.includes('wishlist.html')) {
            showWishlistModal();
        }
    });

    // Set up real-time listener for settings
    const settingsListener = onValue(settingsRef, (snapshot) => {
        const settings = snapshot.val() || {
            sectionVisibility: {
                featuredProducts: true,
                allProducts: true,
                myShop: true
            }
        };
        
        const featuredSection = document.getElementById('featured-products');
        const allProductsSection = document.getElementById('all-products');
        const myShopSection = document.getElementById('my-shop');
        
        const vis = settings.sectionVisibility || {
            featuredProducts: true,
            allProducts: true,
            myShop: true
        };
        
        localStorage.setItem('visibilitySettings', JSON.stringify(vis));

        if (featuredSection) {
            featuredSection.style.display = vis.featuredProducts !== false ? 'block' : 'none';
        }
        if (allProductsSection) {
            allProductsSection.style.display = vis.allProducts !== false ? 'block' : 'none';
        }
        if (myShopSection) {
            myShopSection.style.display = vis.myShop !== false ? 'block' : 'none';
        }

        // Update wishlist display when settings change
        if (window.location.pathname.includes('wishlist.html')) {
            displayWishlistItems();
        }
    });

    // Add event listeners
    themeToggle.addEventListener('click', toggleTheme);
    searchInput.addEventListener('input', updateProductDisplay);
    categoryFilter.addEventListener('change', updateProductDisplay);
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    wishlistBtn.addEventListener('click', showWishlistModal);

    // Clean up listeners when page unloads
    window.addEventListener('beforeunload', () => {
        if (productsListener) productsListener();
        if (settingsListener) settingsListener();
        if (wishlistListener) wishlistListener();
    });

    // Handle BFCache (Browser Back Button) restore
    window.addEventListener('pageshow', (event) => {
        // If the page is loaded from the browser cache (e.g. back button)
        if (event.persisted) {
            console.log('Page restored from BFCache. Re-initializing listeners...');
            // Re-fetch products to ensure data is fresh and skeletons are removed
            const productsRef = ref(db, 'products');
            onValue(productsRef, (snapshot) => {
                const productsData = snapshot.val() || {};
                allProductsData = productsData;
                const productsArray = Object.keys(productsData).map(key => ({ id: key, ...productsData[key] }));
                updateCategories(productsArray);
                const featuredProducts = productsArray.filter(p => p.featured);
                const myShopProducts = productsArray.filter(p => p.myShop);
                displayProducts(featuredProductsContainer, featuredProducts);
                displayProducts(productsContainer, productsArray);
                displayProducts(myShopContainer, myShopProducts);
            }, { onlyOnce: true });
            
            // Re-fetch wishlist if user is logged in
            if (currentUser) {
                fetchUserWishlist(currentUser.uid);
            }
        }
    });

    // Add event listeners for settings options
    document.addEventListener('DOMContentLoaded', () => {
        // Edit Email button handler
        const editEmailBtn = document.querySelector('.settings-option:first-child');
        if (editEmailBtn) {
            editEmailBtn.addEventListener('click', handleEditEmailClick);
        } else {
            console.error('Edit email button not found');
        }

        // Delete Account button handler
        const deleteAccountBtn = document.querySelector('.settings-option.delete-account');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', handleDeleteAccountClick);
        } else {
            console.error('Delete account button not found');
        }

        // Edit Email form handler
        const editEmailForm = document.getElementById('editEmailForm');
        if (editEmailForm) {
            editEmailForm.addEventListener('submit', handleEditEmailSubmit);
        } else {
            console.error('Edit email form not found');
        }

        // Delete Account form handler
        const deleteAccountForm = document.getElementById('deleteAccountForm');
        if (deleteAccountForm) {
            deleteAccountForm.addEventListener('submit', handleDeleteAccountSubmit);
        } else {
            console.error('Delete account form not found');
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);

// Theme toggle (no changes needed)
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('darkMode', isDarkMode);
}

// --- Wishlist Functions --- 
async function fetchUserWishlist(userId) {
    if (wishlistListener) {
        wishlistListener(); // unsubscribe previous
        wishlistListener = null;
    }
    const wishlistRef = ref(db, `users/${userId}/wishlist`);
    try {
        wishlistListener = onValue(wishlistRef, (snapshot) => {
            const wishlistData = snapshot.val() || {};
            userWishlist = wishlistData;
            console.log('Fetched wishlist:', userWishlist);
            
            // Update wishlist icons and count
            updateAllWishlistIcons();
            updateWishlistCount();
            
            // If wishlist modal is open, update its contents
            const wishlistContainer = document.getElementById('wishlistItemsContainer');
            if (wishlistContainer && wishlistContainer.offsetParent !== null) {
                displayWishlistItems();
            }
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        userWishlist = {};
        updateWishlistCount();
    }
}

// Function to display wishlist items
function displayWishlistItems() {
    const container = document.getElementById('wishlistItemsContainer');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<p>Please log in to view your wishlist.</p>';
        return;
    }

    // Get current visibility settings
    const settingsRef = ref(db, 'settings');
    let visibilitySettings = {
        featuredProducts: true,
        allProducts: true,
        myShop: true
    };

    onValue(settingsRef, (snapshot) => {
        const settings = snapshot.val();
        if (settings?.sectionVisibility) {
            visibilitySettings = settings.sectionVisibility;
        }

        const wishlistProducts = Object.keys(userWishlist)
            .map(productId => {
                const product = allProductsData[productId];
                if (product) {
                    return {
                        ...product,
                        id: productId
                    };
                }
                return null;
            })
            .filter(product => product !== null);

        if (wishlistProducts.length > 0) {
            container.innerHTML = '';
            wishlistProducts.forEach(product => {
                const card = createProductCard(product);
                container.appendChild(card);
            });
        } else {
            container.innerHTML = '<p>Your wishlist is empty.</p>';
        }

        updateWishlistCount();
    }, { once: true });
}

async function toggleWishlist(productId) {
    if (!currentUser) {
        openModal('authModal');
        return;
    }

    const userId = currentUser.uid;
    const wishlistItemRef = ref(db, `users/${userId}/wishlist/${productId}`);

    try {
        if (userWishlist[productId]) {
            // Remove from wishlist
            await remove(wishlistItemRef);
            delete userWishlist[productId];
        } else {
            // Add to wishlist
            await set(wishlistItemRef, true);
            userWishlist[productId] = true;
        }
        
        // Update UI
        updateWishlistIcon(productId, !!userWishlist[productId]);
        updateWishlistCount();
        
        // If wishlist modal is open, update its contents
        const wishlistContainer = document.getElementById('wishlistItemsContainer');
        if (wishlistContainer && wishlistContainer.offsetParent !== null) {
            displayWishlistItems();
        }
    } catch (error) {
        console.error('Error updating wishlist:', error);
    }
}

function updateWishlistIcon(productId, isWishlisted) {
    const buttons = document.querySelectorAll(`.wishlist-button[data-product-id="${productId}"]`);
    buttons.forEach(button => {
        const icon = button.querySelector('i');
        if (isWishlisted) {
            icon.classList.remove('far');
            icon.classList.add('fas', 'wishlisted');
        } else {
            icon.classList.remove('fas', 'wishlisted');
            icon.classList.add('far');
        }
    });
}

function updateAllWishlistIcons() {
    const allButtons = document.querySelectorAll('.wishlist-button');
    allButtons.forEach(button => {
        const productId = button.dataset.productId;
        if (productId) {
            updateWishlistIcon(productId, !!userWishlist[productId]);
        }
    });
}

function updateWishlistCount() {
    const badges = document.querySelectorAll('.wishlist-count');
    const count = Object.keys(userWishlist).length;
    badges.forEach(badge => {
        badge.textContent = count;
        if (count > 0) {
            badge.classList.add('has-items');
        } else {
            badge.classList.remove('has-items');
        }
    });
}

function showWishlistModal() {
    if (!currentUser) {
        openModal('authModal');
        return;
    }

    displayWishlistItems();
        openModal('wishlistModal');
    }

// Create product card (Modified to include wishlist check and WhatsApp button)
function createProductCard(product) {
    // All product cards now link to the product detail page.
    // The product page itself shows the correct buttons per section
    // (Buy Now for app products, WhatsApp for My Shop products).
    const card = document.createElement('a');
    card.className = 'product-card';
    card.href = `product.html?id=${product.id}`;

    const ratingStars = product.rating ? `${product.rating} <i class="fas fa-star"></i>` : '';
    const ratingCount = product.ratingCount ? `| ${product.ratingCount}` : '';
    const originalPriceHTML = product.originalPrice ? `<span class="original-price">₹${product.originalPrice}</span>` : '';
    const discountPercentageHTML = product.discountPercentage ? `<span class="discount-percentage">${product.discountPercentage}% OFF</span>` : '';
    const offerTagHTML = product.offerTag ? `<div class="offer-tag">${product.offerTag}</div>` : '';
    const deliveryInfoHTML = product.deliveryInfo ? `<div class="delivery-info">${product.deliveryInfo}</div>` : '';

    // Determine initial wishlist icon state
    const isWishlisted = !!userWishlist[product.id];
    const heartIconClass = isWishlisted ? 'fas fa-heart wishlisted' : 'far fa-heart';

    // Create WhatsApp message
    const whatsappMessage = encodeURIComponent(
        `Hi! I'm interested in this product:\n\n` +
        `*${product.title}*\n` +
        `${product.description || ''}\n` +
        `Price: ₹${product.discountedPrice || product.originalPrice}\n` +
        `Link: ${product.productUrl || window.location.origin}\n` +
        `Image: ${product.imageUrl || product.image || 'images/placeholder.png'}`
    );

    // Use the WhatsApp number from product data
    const whatsappNumber = product.whatsappNumber || '919951806045';

    // Handle multiple images
    let images = [];
    if (Array.isArray(product.images)) images = product.images;
    else if (product.images && typeof product.images === 'object') images = Object.values(product.images);
    if (images.length === 0) images = [product.imageUrl || product.image || 'images/placeholder.png'];

    const imageSliderHTML = images.length > 1 
        ? `<div class="image-slider" data-current="0" data-auto-sliding="false">
            ${images.map(img => `<img src="${img}" alt="${product.title}" class="product-image" onerror="this.src='images/placeholder.png'">`).join('')}
           </div>
           <div class="slider-nav">
            ${images.map((_, i) => `<div class="slider-dot${i === 0 ? ' active' : ''}" data-index="${i}"></div>`).join('')}
           </div>`
        : `<img src="${images[0]}" alt="${product.title}" class="product-image" onerror="this.src='images/placeholder.png'">`;

    card.innerHTML = `
        <div class="product-image-container">
            ${imageSliderHTML}
            ${product.rating ? `<div class="rating-box">${ratingStars} ${ratingCount}</div>` : ''}
        </div>
        <div class="product-info">
            ${product.brand ? `<h4 class="product-brand">${product.brand}</h4>` : ''}
            <h3 class="product-title">${product.title}</h3>
            ${offerTagHTML}
            <div class="price-container">
                ${product.discountedPrice ? `<span class="discounted-price">₹${product.discountedPrice}</span>` : ''}
                ${originalPriceHTML}
                ${discountPercentageHTML}
            </div>
            ${deliveryInfoHTML}
            ${product.myShop ? `
                <button class="whatsapp-button" onclick="event.preventDefault(); event.stopPropagation(); window.open('https://wa.me/${whatsappNumber}?text=${whatsappMessage}', '_blank');">
                    <i class="fab fa-whatsapp"></i> Chat on WhatsApp
                </button>
            ` : (product.productUrl ? `
                <button class="whatsapp-button" style="background: var(--gradient-primary); box-shadow: 0 4px 15px rgba(124,58,237,0.3);" onclick="event.preventDefault(); event.stopPropagation(); window.open('${product.productUrl}', '_blank');">
                    <i class="fas fa-shopping-bag"></i> Buy Now
                </button>
            ` : '')}
        </div>
        <button class="wishlist-button" data-product-id="${product.id}">
            <i class="${heartIconClass}"></i>
        </button>
    `;

    const wishlistButton = card.querySelector('.wishlist-button');
    wishlistButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(product.id);
    });

    // Add hover event listeners for auto-sliding
    const imageContainer = card.querySelector('.product-image-container');
    if (imageContainer && images.length > 1) {
        // Mouse events for desktop only
        imageContainer.addEventListener('mouseenter', startAutoSlide);
        imageContainer.addEventListener('mouseleave', stopAutoSlide);
    }

    return card;
}

// Auto-sliding functionality
function startAutoSlide(event) {
    const container = event.currentTarget;
    const slider = container.querySelector('.image-slider');
    if (!slider || slider.dataset.autoSliding === 'true') return;

    slider.dataset.autoSliding = 'true';
    
    function slide() {
        if (slider.dataset.autoSliding !== 'true') return;
        
        const dots = container.querySelectorAll('.slider-dot');
        let currentIndex = parseInt(slider.dataset.current);
        const totalImages = dots.length;
        
        currentIndex = (currentIndex + 1) % totalImages;
        updateSlider(slider, dots, currentIndex);
        
        if (slider.dataset.autoSliding === 'true') {
            setTimeout(slide, 2000); // Change slide every 2 seconds
        }
    }
    
    slide();
}

function stopAutoSlide(event) {
    const slider = event.currentTarget.querySelector('.image-slider');
    if (slider) {
        slider.dataset.autoSliding = 'false';
    }
}

// Update the updateSlider function to handle smoother transitions
function updateSlider(slider, dots, newIndex) {
    slider.style.transition = 'transform 0.5s ease-in-out';
    slider.style.transform = `translateX(-${newIndex * 100}%)`;
    slider.dataset.current = newIndex;
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === newIndex);
    });
}

// Add touch event handling
function handleTouchStart(event) {
    const container = event.currentTarget;
    const slider = container.querySelector('.image-slider');
    if (!slider) return;

    // Stop auto-sliding when user touches
    stopAutoSlide({ currentTarget: container });

    const touch = event.touches[0];
    slider.dataset.touchStartX = touch.clientX;
    slider.dataset.touchStartY = touch.clientY;
    slider.dataset.currentTranslate = -parseInt(slider.dataset.current) * 100;
}

function handleTouchMove(event) {
    const container = event.currentTarget;
    const slider = container.querySelector('.image-slider');
    if (!slider || !slider.dataset.touchStartX) return;

    const touch = event.touches[0];
    const diffX = touch.clientX - parseFloat(slider.dataset.touchStartX);
    const diffY = touch.clientY - parseFloat(slider.dataset.touchStartY);

    // If vertical scrolling is more prominent, don't slide
    if (Math.abs(diffY) > Math.abs(diffX)) return;

    // Prevent default to stop page scrolling while sliding
    event.preventDefault();

    const translateX = parseFloat(slider.dataset.currentTranslate) + (diffX / slider.offsetWidth * 100);
    slider.style.transition = 'none';
    slider.style.transform = `translateX(${translateX}%)`;
}

function handleTouchEnd(event) {
    const container = event.currentTarget;
    const slider = container.querySelector('.image-slider');
    if (!slider || !slider.dataset.touchStartX) return;

    const touch = event.changedTouches[0];
    const diffX = touch.clientX - parseFloat(slider.dataset.touchStartX);
    const dots = container.querySelectorAll('.slider-dot');
    let currentIndex = parseInt(slider.dataset.current);

    // Determine if the swipe was significant enough to change slides
    if (Math.abs(diffX) > slider.offsetWidth / 3) {
        currentIndex = diffX > 0 ? 
            Math.max(0, currentIndex - 1) : 
            Math.min(dots.length - 1, currentIndex + 1);
    }

    updateSlider(slider, dots, currentIndex);

    // Clean up touch data
    delete slider.dataset.touchStartX;
    delete slider.dataset.touchStartY;
    delete slider.dataset.currentTranslate;
}

// Display products
function displayProducts(container, products) {
    if (!container || !products) return;
    
    container.innerHTML = '';
    products.forEach(product => {
        if (product && product.id) {
            // Update the global product cache if displaying main products
            if (container === productsContainer || container === featuredProductsContainer || container === myShopContainer) {
                allProductsData[product.id] = product;
            }
            
            // Only show My Shop products in the My Shop section
            if (container === myShopContainer && !product.myShop) {
                return; // Skip non-My Shop products in My Shop section
            }
            
            // Don't show My Shop products in other sections
            if (container !== myShopContainer && product.myShop) {
                return; // Skip My Shop products in other sections
            }
            
            const card = createProductCard(product);
            container.appendChild(card);
        }
    });
    updateBrandFilterDropdown();
    updateCategoryFilterDropdown();
}

// Filter products (No changes needed here for wishlist)
function filterProducts(products) {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;

    return products.filter(product => {
        const titleMatch = product.title?.toLowerCase().includes(searchTerm) || false;
        const brandMatch = product.brand?.toLowerCase().includes(searchTerm) || false;
        const descMatch = product.description?.toLowerCase().includes(searchTerm) || false;
        const categoryMatchFilter = !selectedCategory || product.category === selectedCategory;
        const categoryMatchSearch = product.category?.toLowerCase().includes(searchTerm) || false;
        
        const matchesSearch = !searchTerm || titleMatch || brandMatch || descMatch || categoryMatchSearch;
        
        // Exclude My Shop products from main products list
        return matchesSearch && categoryMatchFilter && !product.myShop;
    });
}

// Function to update product display based on search and category
function updateProductDisplay() {
    const activeSection = getActiveSection();
    if (!activeSection) return;

    // Get current search and category values
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;

    // Update current filters for active section
    currentFilters[activeSection].search = searchTerm;
    currentFilters[activeSection].category = selectedCategory;

    // Get all products
    const allProducts = Object.values(allProductsData);
    let filteredProducts = [...allProducts];

    // Apply section-specific filters first
    if (activeSection === 'featured') {
        filteredProducts = filteredProducts.filter(product => product.featured);
    } else if (activeSection === 'myShop') {
        filteredProducts = filteredProducts.filter(product => product.myShop);
    }

    // Apply search filter
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product => {
            const titleMatch = product.title?.toLowerCase().includes(searchTerm) || false;
            const brandMatch = product.brand?.toLowerCase().includes(searchTerm) || false;
            const descMatch = product.description?.toLowerCase().includes(searchTerm) || false;
            return titleMatch || brandMatch || descMatch;
        });
    }

    // Apply category filter
    if (selectedCategory) {
        filteredProducts = filteredProducts.filter(product => {
            // For My Shop products, check both category and myShopCategory
            if (activeSection === 'myShop') {
                return (product.category === selectedCategory || product.myShopCategory === selectedCategory);
            }
            return product.category === selectedCategory;
        });
    }

    // Apply other filters (price, brand, discount, rating)
    if (currentFilters[activeSection].price === 'low') {
        filteredProducts.sort((a, b) => (a.discountedPrice || a.originalPrice) - (b.discountedPrice || b.originalPrice));
    } else if (currentFilters[activeSection].price === 'high') {
        filteredProducts.sort((a, b) => (b.discountedPrice || b.originalPrice) - (a.discountedPrice || a.originalPrice));
    }

    if (currentFilters[activeSection].brand) {
        filteredProducts = filteredProducts.filter(product => product.brand === currentFilters[activeSection].brand);
    }

    if (currentFilters[activeSection].discount) {
        const minDiscount = parseInt(currentFilters[activeSection].discount);
        filteredProducts = filteredProducts.filter(product => {
            if (!product.discountedPrice || !product.originalPrice) return false;
            const discount = ((product.originalPrice - product.discountedPrice) / product.originalPrice) * 100;
            return discount >= minDiscount;
        });
    }

    if (currentFilters[activeSection].rating) {
        const minRating = parseFloat(currentFilters[activeSection].rating);
        filteredProducts = filteredProducts.filter(product => product.rating >= minRating);
    }

    // Display filtered products in appropriate container
    const container = getContainerForSection(activeSection);
    if (container) {
        displayProducts(container, filteredProducts);
    }
}

// Function to apply filters
function applyFilters() {
    const priceFilter = document.getElementById('filterPrice').value;
    const brandFilter = document.getElementById('filterBrand').value;
    const discountFilter = document.getElementById('filterDiscount').value;
    const ratingFilter = document.getElementById('filterRating').value;
    const featuredFilter = document.getElementById('filterFeatured').checked;

    const activeSection = getActiveSection();
    if (!activeSection) return;

    // Update current filters for active section
    currentFilters[activeSection] = {
        ...currentFilters[activeSection],
        price: priceFilter,
        brand: brandFilter,
        discount: discountFilter,
        rating: ratingFilter,
        featured: featuredFilter
    };

    // Update product display with all current filters
    updateProductDisplay();
}

// Reset filters function
function resetFilters() {
    // Reset all filter fields to their default values
    document.getElementById('filterPrice').value = '';
    document.getElementById('filterBrand').value = '';
    document.getElementById('filterDiscount').value = '';
    document.getElementById('filterRating').value = '';
    document.getElementById('filterFeatured').checked = false;
    searchInput.value = '';
    categoryFilter.value = '';
    
    const activeSection = getActiveSection();
    if (!activeSection) return;

    // Reset current filters for active section
    currentFilters[activeSection] = {
        price: '',
        brand: '',
        discount: '',
        rating: '',
        featured: activeSection === 'featured',
        search: '',
        category: ''
    };
    
    // Display all products for the active section
    const allProducts = Object.values(allProductsData);
    let filteredProducts = [...allProducts];

    // Apply section-specific filters
    if (activeSection === 'featured') {
        filteredProducts = filteredProducts.filter(product => product.featured);
    } else if (activeSection === 'myShop') {
        filteredProducts = filteredProducts.filter(product => product.myShop);
    }

    const container = getContainerForSection(activeSection);
    if (container) {
        displayProducts(container, filteredProducts);
    }
}

// Update categories in filter
function updateCategories(products) {
    // Get all unique categories from all products
    const categories = [...new Set(products.map(p => {
        // For My Shop products, include both category and myShopCategory
        if (p.myShop) {
            return [p.category, p.myShopCategory].filter(Boolean);
        }
        return p.category;
    }).reduce((acc, val) => acc.concat(val), []).filter(Boolean))].sort();
    
    // Update category filter options
    categoryFilter.innerHTML = `
        <option value="">All Categories</option>
        ${categories.map(category => `
            <option value="${category}">${category}</option>
        `).join('')}
    `;
}

// Add event listeners for search and category
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...

    // Add event listeners for search and category
    searchInput.addEventListener('input', updateProductDisplay);
    categoryFilter.addEventListener('change', updateProductDisplay);

    // ... existing code ...
});

// Initialize settings functionality
function initializeSettings() {
    console.log('Initializing settings functionality...');
    
    // About Us button handler
    const aboutUsBtn = document.querySelector('.settings-option.about-us-btn');
    if (aboutUsBtn) {
        aboutUsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const aboutSection = document.querySelector('.footer-section.about');
            if (aboutSection) {
                aboutSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // Delete Account button handler
    const deleteAccountBtn = document.querySelector('.settings-option.delete-account');
    if (deleteAccountBtn) {
        console.log('Delete account button found');
        deleteAccountBtn.addEventListener('click', handleDeleteAccountClick);
    } else {
        console.error('Delete account button not found');
    }
}

// Handle Edit Email button click
async function handleEditEmailClick(e) {
    e.preventDefault();
    console.log('Edit email button clicked');
    
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        alert('Please log in to edit your email');
        return;
    }

    const currentEmailInput = document.getElementById('currentEmail');
    if (currentEmailInput) {
        currentEmailInput.value = user.email;
        console.log('Current email set to:', user.email);
    } else {
        console.error('Current email input not found');
    }

    openModal('editEmailModal');
}

// Handle Delete Account button click
async function handleDeleteAccountClick(e) {
    e.preventDefault();
    console.log('Delete account button clicked');
    
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        alert('Please log in to delete your account');
        return;
    }

    openModal('deleteAccountModal');
}

// Handle Edit Email form submission
async function handleEditEmailSubmit(e) {
    e.preventDefault();
    console.log('Edit email form submitted');
    
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        alert('Please log in to update your email');
        return;
    }

    const newEmail = document.getElementById('newEmail').value;
    const password = document.getElementById('emailPassword').value;
    const errorElement = document.getElementById('editEmailError');

    if (!newEmail || !password) {
        console.log('Missing email or password');
        errorElement.textContent = 'Please fill in all fields';
        return;
    }

    try {
        // First, reauthenticate the user
        console.log('Attempting to reauthenticate user...');
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        console.log('User reauthenticated successfully');

        // Directly update email
        console.log('Attempting to update email...');
        await updateEmail(user, newEmail);
        console.log('Email updated successfully');

        // Send verification email
        await user.sendEmailVerification();
        console.log('Verification email sent to new address');

        // Update UI
        const userEmailElement = document.querySelector('.user-email');
        if (userEmailElement) {
            userEmailElement.textContent = newEmail;
            console.log('UI updated with new email');
        }

        // Close modal and clear form
        closeModal('editEmailModal');
        e.target.reset();
        errorElement.textContent = '';
        
        alert('Email updated successfully! A verification email has been sent to ' + newEmail + '. Please check your inbox and verify your new email address.');

    } catch (error) {
        console.error('Error updating email:', error);
        switch (error.code) {
            case 'auth/requires-recent-login':
                errorElement.textContent = 'For security reasons, please log out and log in again before changing your email.';
                break;
            case 'auth/invalid-email':
                errorElement.textContent = 'Please enter a valid email address.';
                break;
            case 'auth/email-already-in-use':
                errorElement.textContent = 'This email is already associated with another account.';
                break;
            case 'auth/network-request-failed':
                errorElement.textContent = 'Network error. Please check your internet connection and try again.';
                break;
            case 'auth/too-many-requests':
                errorElement.textContent = 'Too many attempts. Please try again later.';
                break;
            default:
                errorElement.textContent = 'Error: ' + (error.message || 'Failed to update email. Please try again.');
        }
    }
}

// Add email verification state listener
function setupEmailVerificationListener() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            user.reload().then(() => {
                if (user.emailVerified) {
                    console.log('Email verified successfully');
                    const userEmailElement = document.querySelector('.user-email');
                    if (userEmailElement) {
                        userEmailElement.textContent = user.email;
                    }
                }
            });
        }
    });
}

// Handle Delete Account form submission
async function handleDeleteAccountSubmit(e) {
    e.preventDefault();
    console.log('Delete account form submitted');
    
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        alert('Please log in to delete your account');
        return;
    }

    const password = document.getElementById('deletePassword').value;
    const errorElement = document.getElementById('deleteAccountError');

    if (!password) {
        console.log('Missing password');
        errorElement.textContent = 'Please enter your password';
        return;
    }

    try {
        console.log('Attempting to reauthenticate user...');
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        console.log('User reauthenticated successfully');

        console.log('Attempting to delete user data...');
        const userRef = ref(db, `users/${user.uid}`);
        await remove(userRef);
        console.log('User data deleted successfully');

        console.log('Attempting to delete user account...');
        await deleteUser(user);
        console.log('User account deleted successfully');

        // Close modal and clear form
        closeModal('deleteAccountModal');
        e.target.reset();
        errorElement.textContent = '';
        
        alert('Account deleted successfully!');
        window.location.href = '/';
    } catch (error) {
        console.error('Error deleting account:', error);
        errorElement.textContent = error.message;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing settings...');
    initializeSettings();
    setupEmailVerificationListener();

    // Patch Brand filter to select and update options
    patchBrandFilterToSelect();
    updateBrandFilterDropdown();
    updateCategoryFilterDropdown();

    // Filter button dropdown logic
    const filterBtn = document.getElementById('filterBtn');
    const filterDropdown = document.getElementById('filterDropdown');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (filterBtn && filterDropdown) {
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterDropdown.style.display = (filterDropdown.style.display === 'flex') ? 'none' : 'flex';
        });
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!filterDropdown.contains(e.target) && e.target !== filterBtn) {
                filterDropdown.style.display = 'none';
            }
        });
    }
    // Add event listeners for filter bar
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applyFilters();
            if (window.innerWidth < 768) {
                const filterBar = document.getElementById('filterBar');
                const filterOverlay = document.getElementById('filterOverlay');
                if (filterBar) filterBar.classList.remove('drawer-open');
                if (filterOverlay) filterOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // --- Advanced Search Functionality ---
    const voiceSearchBtn = document.getElementById('voiceSearchBtn');
    const imageSearchBtn = document.getElementById('imageSearchBtn');
    const imageSearchInput = document.getElementById('imageSearchInput');
    const searchInput = document.getElementById('searchInput');
    
    // Voice Search Overlays
    const voiceSearchOverlay = document.getElementById('voiceSearchOverlay');
    const closeVoiceSearch = document.getElementById('closeVoiceSearch');
    const voiceSearchStatus = document.getElementById('voiceSearchStatus');
    const voiceSearchTranscript = document.getElementById('voiceSearchTranscript');
    


    // Reset filters button
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetFilters();
        });
    }
});

// Add function to show email verification banner
function showEmailVerificationBanner() {
    const banner = document.createElement('div');
    banner.className = 'email-verification-banner';
    banner.innerHTML = `
        <p>Please verify your email address. 
        <button onclick="resendVerificationEmail()" class="resend-verification-btn">
            Resend verification email
        </button></p>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
}

// Add function to resend verification email
window.resendVerificationEmail = async function() {
    const user = auth.currentUser;
    if (user) {
        try {
            await user.sendEmailVerification();
            alert('Verification email sent! Please check your inbox.');
        } catch (error) {
            console.error('Error sending verification email:', error);
            alert('Failed to send verification email. Please try again later.');
        }
    }
}

// Utility to update the Brand filter dropdown with unique brands
function updateBrandFilterDropdown() {
    const brandSelect = document.getElementById('filterBrand');
    if (!brandSelect) return;
    // Clear existing options
    brandSelect.innerHTML = '';
    const optionAll = document.createElement('option');
    optionAll.value = '';
    optionAll.textContent = 'All';
    brandSelect.appendChild(optionAll);
    // Get unique brands from allProductsData
    const brands = [...new Set(Object.values(allProductsData).map(p => p.brand).filter(Boolean))].sort();
    brands.forEach(brand => {
        const opt = document.createElement('option');
        opt.value = brand;
        opt.textContent = brand;
        brandSelect.appendChild(opt);
    });
}

// Utility to update the Category filter dropdown with unique categories
function updateCategoryFilterDropdown() {
    const categorySelect = document.getElementById('filterCategory');
    if (!categorySelect) return;
    // Clear existing options
    categorySelect.innerHTML = '';
    const optionAll = document.createElement('option');
    optionAll.value = '';
    optionAll.textContent = 'All';
    categorySelect.appendChild(optionAll);
    // Get unique categories from allProductsData
    const categories = [...new Set(Object.values(allProductsData).map(p => p.category).filter(Boolean))].sort();
    categories.forEach(category => {
        const opt = document.createElement('option');
        opt.value = category;
        opt.textContent = category;
        categorySelect.appendChild(opt);
    });
}

// Patch: Replace Brand input with select on DOMContentLoaded (if needed)
function patchBrandFilterToSelect() {
    const brandInput = document.getElementById('filterBrand');
    if (brandInput && brandInput.tagName === 'INPUT') {
        const select = document.createElement('select');
        select.id = 'filterBrand';
        select.className = brandInput.className;
        brandInput.parentNode.replaceChild(select, brandInput);
    }
}

// Function to get active section
function getActiveSection() {
    const featuredSection = document.getElementById('featured-products');
    const allProductsSection = document.getElementById('all-products');
    const myShopSection = document.getElementById('my-shop');

    if (featuredSection && featuredSection.style.display !== 'none') {
        return 'featured';
    } else if (allProductsSection && allProductsSection.style.display !== 'none') {
        return 'all';
    } else if (myShopSection && myShopSection.style.display !== 'none') {
        return 'myShop';
    }
    return null;
}

// Function to get container for section
function getContainerForSection(section) {
    switch (section) {
        case 'featured':
            return featuredProductsContainer;
        case 'all':
            return productsContainer;
        case 'myShop':
            return myShopContainer;
        default:
            return null;
    }
}

// Add event listener for wishlist modal close button
document.addEventListener('DOMContentLoaded', () => {
    const wishlistCloseBtn = document.querySelector('#wishlistModal .close-btn');
    if (wishlistCloseBtn) {
        wishlistCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal('wishlistModal');
        });
    }
});

// Function to scroll to About Us section
function scrollToAboutUs() {
    const aboutSection = document.querySelector('.footer-section.about');
    if (aboutSection) {
        aboutSection.scrollIntoView({ behavior: 'smooth' });
        // Close the dropdown if it's open
        const loggedOutDropdown = document.getElementById('logged-out-dropdown');
        const loggedInDropdown = document.getElementById('logged-in-dropdown');
        if (loggedOutDropdown) loggedOutDropdown.style.display = 'none';
        if (loggedInDropdown) loggedInDropdown.style.display = 'none';
    }
}

// ==========================================
// Hero Slider Logic
// ==========================================
let currentSlideIndex = 0;
let slideInterval;
const SLIDE_DURATION = 5000; // 5 seconds

function renderHeroSlider(banners) {
    let heroEl = document.getElementById('heroContainer') || document.getElementById('heroSliderContainer');
    if (!heroEl) return; // If we aren't on index page

    // Reset slide index when re-rendering
    currentSlideIndex = 0;

    // Sort by newest
    banners.sort((a, b) => b.createdAt - a.createdAt);

    if (banners.length === 0) {
        // Replace skeleton with a static fallback banner if no banners exist
        heroEl.outerHTML = `
            <section class="hero-section static-hero" id="heroContainer" style="background: var(--gradient-primary); padding: 4rem 2rem; border-radius: 20px; text-align: center; color: white; margin: 1rem 0;">
                <h2 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 1rem;">Welcome to ValuePro</h2>
                <p style="font-size: 1.1rem; opacity: 0.9; max-width: 600px; margin: 0 auto;">Discover premium products at unbeatable prices.</p>
            </section>
        `;
        return;
    }

    // Build Slider HTML
    let slidesHTML = '';
    let indicatorsHTML = '';

    banners.forEach((banner, index) => {
        const activeClass = index === 0 ? 'active' : '';
        
        const alignment = banner.alignment || 'center';
        const alignStyles = `display: flex; flex-direction: column; align-items: ${alignment}; text-align: ${alignment === 'flex-start' ? 'left' : alignment === 'flex-end' ? 'right' : 'center'}; width: 100%;`;

        const buttonStyleClass = banner.buttonStyle || 'btn-primary';
        const isWholeClickable = banner.wholeClickable !== false;
        const isCustomStyle = buttonStyleClass === 'btn-custom';
        const customStyleStr = isCustomStyle ? `background-color: ${banner.buttonBgColor || '#0f172a'}; color: ${banner.buttonTextColor || '#ffffff'}; border: none;` : '';
        const finalClass = isCustomStyle ? 'btn' : `btn ${buttonStyleClass}`;
        
        const buttonHtml = banner.buttonText 
            ? (isWholeClickable 
                ? `<span class="${finalClass}" style="margin-top: 1.5rem; display: inline-block; ${customStyleStr}">${banner.buttonText}</span>` 
                : `<a href="${banner.link || 'javascript:void(0)'}" class="${finalClass}" style="margin-top: 1.5rem; display: inline-block; position: relative; z-index: 10; ${customStyleStr}">${banner.buttonText}</a>`)
            : '';

        const slideTag = isWholeClickable ? 'a' : 'div';
        const slideHref = isWholeClickable ? `href="${banner.link || 'javascript:void(0)'}"` : '';
        const slideCursor = isWholeClickable && banner.link ? 'pointer' : 'default';

        slidesHTML += `
            <${slideTag} ${slideHref} class="hero-slide ${activeClass}" style="display: flex; cursor: ${slideCursor}; text-decoration: none;">
                <img src="${banner.imageUrl}" alt="${banner.title || 'Banner'}">
                <div class="hero-slide-overlay"></div>
                <div class="hero-slide-content" style="${alignStyles}">
                    ${banner.title ? `<h2 class="hero-slide-title" style="color: ${banner.titleColor || '#ffffff'}; font-family: ${banner.titleFont || 'Inter, sans-serif'}; margin-bottom: 0.5rem;">${banner.title}</h2>` : ''}
                    ${banner.subtitle ? `<p class="hero-slide-subtitle" style="color: ${banner.subtitleColor || '#ffffff'}; font-family: ${banner.subtitleFont || 'Inter, sans-serif'};">${banner.subtitle}</p>` : ''}
                    ${buttonHtml}
                </div>
            </${slideTag}>
        `;

        // Build indicator
        indicatorsHTML += `<button class="hero-indicator ${activeClass}" onclick="goToSlide(${index})"></button>`;
    });

    // Inject into container
    heroEl.outerHTML = `
        <div id="heroSliderContainer" class="hero-slider-container">
            ${slidesHTML}
            
            ${banners.length > 1 ? `
                <button class="hero-nav-btn hero-prev" onclick="prevSlide(event)">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <button class="hero-nav-btn hero-next" onclick="nextSlide(event)">
                    <i class="fas fa-chevron-right"></i>
                </button>
                <div class="hero-indicators">
                    ${indicatorsHTML}
                </div>
            ` : ''}
        </div>
    `;

    if (banners.length > 1) {
        startSlideShow();
    }
}

function initHeroSlider() {
    // Attempt to load from cache first
    try {
        const cachedBannersStr = localStorage.getItem('cachedBanners');
        if (cachedBannersStr) {
            const cachedBanners = JSON.parse(cachedBannersStr);
            renderHeroSlider(cachedBanners);
        }
    } catch (e) {
        console.error("Error reading banner cache:", e);
    }

    onValue(bannersRef, (snapshot) => {
        const banners = [];
        snapshot.forEach((childSnapshot) => {
            const banner = childSnapshot.val();
            if (banner.active) {
                banners.push(banner);
            }
        });
        
        // Save to cache
        try {
            localStorage.setItem('cachedBanners', JSON.stringify(banners));
        } catch (e) {}

        renderHeroSlider(banners);
    });
}

window.goToSlide = function(index) {
    const slides = document.querySelectorAll('.hero-slide');
    const indicators = document.querySelectorAll('.hero-indicator');
    if (!slides.length) return;

    slides[currentSlideIndex].classList.remove('active');
    if (indicators[currentSlideIndex]) indicators[currentSlideIndex].classList.remove('active');

    currentSlideIndex = index;
    if (currentSlideIndex >= slides.length) currentSlideIndex = 0;
    if (currentSlideIndex < 0) currentSlideIndex = slides.length - 1;

    slides[currentSlideIndex].classList.add('active');
    if (indicators[currentSlideIndex]) indicators[currentSlideIndex].classList.add('active');

    resetSlideShow();
}

window.nextSlide = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    goToSlide(currentSlideIndex + 1);
}

window.prevSlide = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    goToSlide(currentSlideIndex - 1);
}

function startSlideShow() {
    clearInterval(slideInterval);
    slideInterval = setInterval(window.nextSlide, SLIDE_DURATION);
}

function resetSlideShow() {
    clearInterval(slideInterval);
    startSlideShow();
}

// Initialize Slider on Load
document.addEventListener('DOMContentLoaded', () => {
    initHeroSlider();
}); 