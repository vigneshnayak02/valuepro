import { db, auth, ref, onValue, set, remove, onAuthStateChanged } from './firebase-config.js';

// =========================================
// Product Page — Section-Aware Logic
// =========================================
// Products come from two distinct sections:
//   1. "All Products / Featured" — affiliate products from apps.
//      These have an external productUrl and show a "Buy Now" button.
//   2. "My Shop / Our Store" — the store owner's own products.
//      These have myShop=true, show "Chat on WhatsApp", and NO "Buy Now".
//
// The product page, action buttons, and related product suggestions
// are all section-specific. Visibility settings from admin are respected.
// =========================================

// State
let allProducts = {};
let currentProduct = null;
let currentImageIndex = 0;
let currentUser = null;
let userWishlist = {};
let visibilitySettings = {
    featuredProducts: true,
    allProducts: true,
    myShop: true
};

// Get product ID from URL
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

// DOM
const productPage = document.getElementById('productPage');
const themeToggle = document.getElementById('themeToggle');
const searchInput = document.getElementById('searchInput');

// =========================================
// Theme
// =========================================
const savedTheme = localStorage.getItem('darkMode') === 'true';
if (savedTheme) {
    document.body.classList.add('dark-mode');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('darkMode', isDarkMode);
});

// =========================================
// Search redirects to main page
// =========================================
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchInput.value.trim()) {
        window.location.href = `index.html?search=${encodeURIComponent(searchInput.value.trim())}`;
    }
});

// =========================================
// Auth & Wishlist
// =========================================
let wishlistListener = null;

function fetchProductWishlist(uid) {
    if (wishlistListener) {
        wishlistListener(); // unsubscribe previous
        wishlistListener = null;
    }
    const wishlistRef = ref(db, `users/${uid}/wishlist`);
    wishlistListener = onValue(wishlistRef, (snap) => {
        userWishlist = snap.val() || {};
        updateWishlistCount();
        updateWishlistButtonState();
    });
}

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        fetchProductWishlist(user.uid);
    }
});

// Handle BFCache (Browser Back Button) restore
window.addEventListener('pageshow', (event) => {
    if (event.persisted && currentUser) {
        fetchProductWishlist(currentUser.uid);
    }
});

// Clean up listeners when page unloads
window.addEventListener('beforeunload', () => {
    if (wishlistListener) wishlistListener();
});

function updateWishlistCount() {
    const badges = document.querySelectorAll('.wishlist-count');
    const count = Object.keys(userWishlist).length;
    badges.forEach(badge => {
        badge.textContent = count;
        if (count > 0) badge.classList.add('has-items');
        else badge.classList.remove('has-items');
    });
}

function toggleWishlist(pid) {
    if (!currentUser) {
        window.location.href = `index.html?openAuth=true&returnUrl=${encodeURIComponent(window.location.href)}`;
        return;
    }
    const wishlistRef = ref(db, `users/${currentUser.uid}/wishlist/${pid}`);
    if (userWishlist[pid]) {
        remove(wishlistRef);
    } else {
        set(wishlistRef, true);
    }
}

function updateWishlistButtonState() {
    if (!currentProduct) return;
    const btn = document.querySelector('.action-btn.wishlist-action');
    if (!btn) return;
    const isWished = !!userWishlist[currentProduct.id];
    btn.classList.toggle('wishlisted', isWished);
    btn.innerHTML = `<i class="${isWished ? 'fas' : 'far'} fa-heart"></i>`;
}

// Render dynamic wishlist modal on the same page
const topWishlistBtn = document.getElementById('wishlistBtn');
if (topWishlistBtn) {
    topWishlistBtn.addEventListener('click', () => {
        if (!currentUser) {
            window.location.href = `index.html?openAuth=true&returnUrl=${encodeURIComponent(window.location.href)}`;
            return;
        }
        
        let modal = document.getElementById('wishlistModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wishlistModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content wishlist-content">
                    <span class="close-btn" onclick="document.getElementById('wishlistModal').style.display='none'">&times;</span>
                    <h2>My Wishlist</h2>
                    <div id="wishlistItemsContainer" class="products-grid"></div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Close on outside click
            window.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
        
        const container = document.getElementById('wishlistItemsContainer');
        const wishlistProducts = Object.keys(userWishlist)
            .map(id => allProducts[id])
            .filter(Boolean);
            
        if (wishlistProducts.length > 0) {
            container.innerHTML = '';
            wishlistProducts.forEach(p => {
                const isShop = isMyShopProduct(p);
                const wpMsg = encodeURIComponent(`Hi! I'm interested in this product:\n\n*${p.title}*\nPrice: ₹${p.discountedPrice || p.originalPrice}\nLink: ${window.location.origin}/product.html?id=${p.id}`);
                const wpNum = p.whatsappNumber || '919951806045';
                const img = Array.isArray(p.images) ? p.images[0] : (p.images && typeof p.images === 'object' ? Object.values(p.images)[0] : p.imageUrl || p.image || 'images/placeholder.png');
                
                container.innerHTML += `
                    <a href="product.html?id=${p.id}" class="product-card" style="text-decoration: none;">
                        <div class="product-image-container">
                            <img src="${img}" alt="${p.title}" class="product-image" onerror="this.src='images/placeholder.png'">
                            ${p.rating ? `<div class="rating-box">${p.rating} <i class="fas fa-star"></i></div>` : ''}
                        </div>
                        <div class="product-info">
                            <h3 class="product-title">${p.title}</h3>
                            <div class="price-container">
                                ${p.discountedPrice ? `<span class="discounted-price">₹${p.discountedPrice}</span>` : ''}
                                ${p.originalPrice ? `<span class="original-price">₹${p.originalPrice}</span>` : ''}
                            </div>
                            ${isShop ? `
                                <button class="whatsapp-button" onclick="event.preventDefault(); event.stopPropagation(); window.open('https://wa.me/${wpNum}?text=${wpMsg}', '_blank');">
                                    <i class="fab fa-whatsapp"></i> Chat
                                </button>
                            ` : (p.productUrl ? `
                                <button class="whatsapp-button" style="background: var(--gradient-primary);" onclick="event.preventDefault(); event.stopPropagation(); window.open('${p.productUrl}', '_blank');">
                                    <i class="fas fa-shopping-bag"></i> Buy
                                </button>
                            ` : '')}
                        </div>
                    </a>
                `;
            });
        } else {
            container.innerHTML = '<p style="text-align:center; width:100%; color:#64748b;">Your wishlist is empty.</p>';
        }
        
        modal.style.display = 'block';
    });
}

// =========================================
// Helpers — Section Detection
// =========================================
function isMyShopProduct(product) {
    return !!product.myShop;
}

try {
    const savedVis = localStorage.getItem('visibilitySettings');
    if (savedVis) {
        visibilitySettings = JSON.parse(savedVis);
    }
} catch (e) {}

function isAppProduct(product) {
    return !product.myShop;
}

// Get the section label for a product
function getSectionLabel(product) {
    return isMyShopProduct(product) ? 'Our Store' : 'Products from Apps';
}

// Get the back link for breadcrumb based on section
function getSectionLink(product) {
    return isMyShopProduct(product) ? 'index.html#my-shop' : 'index.html#all-products';
}

// Check if a product's section is currently visible in admin settings
function isSectionVisible(product) {
    if (isMyShopProduct(product)) {
        return visibilitySettings.myShop !== false;
    }
    // App products are visible if either allProducts or featuredProducts is on
    return visibilitySettings.allProducts !== false || visibilitySettings.featuredProducts !== false;
}

// =========================================
// Load Settings + Products from Firebase
// =========================================
const settingsRef = ref(db, 'settings');
const productsRef = ref(db, 'products');

// Load visibility settings first, then products
onValue(settingsRef, (snapshot) => {
    const settings = snapshot.val();
    if (settings?.sectionVisibility) {
        visibilitySettings = settings.sectionVisibility;
    }
});

let initialRenderDone = false;

// Attempt to load from cache first for instant loading
try {
    const cachedProducts = localStorage.getItem('cachedProducts');
    if (cachedProducts) {
        allProducts = JSON.parse(cachedProducts);
        if (productId && allProducts[productId]) {
            currentProduct = allProducts[productId];
            try {
                renderProductPage(currentProduct);
                initialRenderDone = true;
            } catch (e) {
                console.error("Error rendering from cache:", e);
            }
        }
    }
} catch (e) {
    console.error("Cache read error:", e);
}

onValue(productsRef, (snapshot) => {
    const newProducts = {};
    snapshot.forEach((child) => {
        const p = child.val();
        newProducts[child.key] = { ...p, id: child.key };
    });
    
    // Save to cache for next time
    try {
        localStorage.setItem('cachedProducts', JSON.stringify(newProducts));
    } catch (e) {}

    allProducts = newProducts;

    if (productId && allProducts[productId]) {
        const newCurrentProduct = allProducts[productId];
        // Only re-render if it's the first time OR the data has actually changed
        if (!initialRenderDone || JSON.stringify(currentProduct) !== JSON.stringify(newCurrentProduct)) {
            currentProduct = newCurrentProduct;
            try {
                renderProductPage(currentProduct);
                initialRenderDone = true;
            } catch (error) {
                console.error("Error rendering product page:", error);
                productPage.innerHTML = `
                    <div class="product-not-found" style="padding: 4rem 1rem; text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                        <h2>Oops! Something went wrong.</h2>
                        <p style="color: #64748b; margin-bottom: 1.5rem;">We couldn't load this product properly.</p>
                        <a href="index.html" style="display: inline-flex; align-items: center; gap: 0.5rem; background: var(--gradient-primary); color: #fff; padding: 0.8rem 2rem; border-radius: 12px; text-decoration: none; font-weight: 600;"><i class="fas fa-arrow-left"></i> Back to Store</a>
                    </div>
                `;
            }
        }
    } else {
        renderNotFound();
    }
});

// =========================================
// Render Product Page
// =========================================
function renderProductPage(product) {
    let images = [];
    if (Array.isArray(product.images)) {
        images = product.images;
    } else if (product.images && typeof product.images === 'object') {
        images = Object.values(product.images);
    }
    if (images.length === 0) {
        images = [product.imageUrl || product.image || 'images/placeholder.png'];
    }
    
    currentImageIndex = 0;

    const isShop = isMyShopProduct(product);
    const sectionLabel = getSectionLabel(product);
    const sectionLink = getSectionLink(product);

    // Build WhatsApp link (only for My Shop products)
    const whatsappMessage = encodeURIComponent(
        `Hi! I'm interested in this product:\n\n` +
        `*${product.title}*\n` +
        `${product.description || ''}\n` +
        `Price: ₹${product.discountedPrice || product.originalPrice}\n` +
        `Link: ${window.location.href}`
    );
    const whatsappNumber = product.whatsappNumber || '919951806045';

    const isWishlisted = !!userWishlist[product.id];

    // Build action buttons based on section
    let actionButtonsHTML = '';

    if (isShop) {
        // My Shop / Our Store → WhatsApp button only, no Buy Now
        actionButtonsHTML = `
            <a href="https://wa.me/${whatsappNumber}?text=${whatsappMessage}" target="_blank" class="action-btn whatsapp-action">
                <i class="fab fa-whatsapp"></i> Chat on WhatsApp
            </a>
        `;
    } else {
        // App / Affiliate products → Buy Now button only, no WhatsApp
        if (product.productUrl) {
            actionButtonsHTML = `
                <a href="${product.productUrl}" target="_blank" class="action-btn buy-now">
                    <i class="fas fa-shopping-bag"></i> Buy Now
                </a>
            `;
        }
    }

    // Section badge style
    const sectionBadgeColor = isShop
        ? 'background: linear-gradient(135deg, #25d366, #128c7e); color: #fff;'
        : 'background: var(--gradient-primary); color: #fff;';
    const sectionIcon = isShop ? 'fas fa-store' : 'fas fa-shopping-bag';

    productPage.innerHTML = `
        <!-- Breadcrumb -->
        <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="index.html"><i class="fas fa-home"></i> Home</a>
            <span class="separator"><i class="fas fa-chevron-right"></i></span>
            <a href="${sectionLink}">${sectionLabel}</a>
            <span class="separator"><i class="fas fa-chevron-right"></i></span>
            ${product.category ? `<a href="${sectionLink}">${product.category}</a><span class="separator"><i class="fas fa-chevron-right"></i></span>` : ''}
            <span>${product.title}</span>
        </nav>

        <!-- Main Product Detail -->
        <div class="product-detail">
            <!-- Image Gallery -->
            <div class="product-gallery">
                <div class="main-image-container" id="mainImageContainer">
                    <img id="mainImage" src="${images[0]}" alt="${product.title}" onerror="this.src='images/placeholder.png'">
                    ${images.length > 1 ? `
                        <button class="gallery-nav-btn prev" id="galleryPrev" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>
                        <button class="gallery-nav-btn next" id="galleryNext" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>
                    ` : ''}
                </div>
                ${images.length > 1 ? `
                    <div class="thumbnail-strip" id="thumbnailStrip">
                        ${images.map((img, i) => `
                            <div class="thumbnail ${i === 0 ? 'active' : ''}" data-index="${i}">
                                <img src="${img}" alt="Thumbnail ${i + 1}" onerror="this.src='images/placeholder.png'">
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <!-- Product Info -->
            <div class="product-info-detail">
                <!-- Section Badge -->
                <span class="section-badge" style="${sectionBadgeColor} display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.9rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; width: fit-content; letter-spacing: 0.3px; margin-bottom: 0.5rem;">
                    <i class="${sectionIcon}"></i> ${sectionLabel}
                </span>

                ${product.brand ? `<span class="product-brand-name">${product.brand}</span>` : ''}
                <h1 class="product-main-title">${product.title}</h1>

                ${product.rating ? `
                    <div class="product-rating-bar">
                        <span class="rating-badge">${product.rating} <i class="fas fa-star"></i></span>
                        ${product.ratingCount ? `<span class="rating-count">${product.ratingCount} ratings</span>` : ''}
                    </div>
                ` : ''}

                ${product.offerTag ? `<span class="offer-tag-detail"><i class="fas fa-bolt"></i> ${product.offerTag}</span>` : ''}

                <div class="price-block">
                    <div class="price-row">
                        <span class="current-price">₹${product.discountedPrice || product.originalPrice || 'N/A'}</span>
                        ${product.originalPrice && product.discountedPrice ? `<span class="original-price-detail">₹${product.originalPrice}</span>` : ''}
                        ${product.discountPercentage ? `<span class="discount-badge">${product.discountPercentage}% OFF</span>` : ''}
                    </div>
                </div>

                ${product.deliveryInfo ? `
                    <div class="delivery-badge">
                        <i class="fas fa-truck"></i> ${product.deliveryInfo}
                    </div>
                ` : ''}

                ${product.description ? `
                    <div class="product-description-block">
                        <h3>Product Description</h3>
                        <p>${product.description}</p>
                    </div>
                ` : ''}

                <div class="product-actions">
                    ${actionButtonsHTML}
                    <button class="action-btn wishlist-action ${isWishlisted ? 'wishlisted' : ''}" id="wishlistActionBtn" aria-label="Add to Wishlist">
                        <i class="${isWishlisted ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                    <button class="action-btn share-btn" id="shareBtn" aria-label="Share Product">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Related Products (section-specific) -->
        <div class="related-section" id="relatedByCategory"></div>
        <div class="related-section" id="relatedByBrand"></div>
    `;

    // Update page title
    document.title = `${product.title} — ValuePro`;

    // Setup interactions
    setupGallery(images);
    setupWishlistButton();
    setupShareButton(product);
    setupZoom(images);
    renderRelatedProducts(product);
}

// =========================================
// Gallery Navigation
// =========================================
function setupGallery(images) {
    if (images.length <= 1) return;

    const mainImage = document.getElementById('mainImage');
    const thumbnails = document.querySelectorAll('.thumbnail');
    const prevBtn = document.getElementById('galleryPrev');
    const nextBtn = document.getElementById('galleryNext');

    function goTo(index) {
        currentImageIndex = index;
        mainImage.style.opacity = '0';
        setTimeout(() => {
            mainImage.src = images[index];
            mainImage.style.opacity = '1';
        }, 200);
        thumbnails.forEach((t, i) => t.classList.toggle('active', i === index));

        // Scroll thumbnail into view
        const activeThumb = thumbnails[index];
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo((currentImageIndex - 1 + images.length) % images.length);
    });
    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo((currentImageIndex + 1) % images.length);
    });

    thumbnails.forEach(thumb => {
        thumb.addEventListener('click', () => goTo(parseInt(thumb.dataset.index)));
    });

    // Add fade transition to main image
    mainImage.style.transition = 'opacity 0.2s ease';

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (document.querySelector('.image-zoom-overlay')) return;
        if (e.key === 'ArrowLeft') goTo((currentImageIndex - 1 + images.length) % images.length);
        if (e.key === 'ArrowRight') goTo((currentImageIndex + 1) % images.length);
    });
}

// =========================================
// Image Zoom
// =========================================
function setupZoom(images) {
    const container = document.getElementById('mainImageContainer');
    if (!container) return;

    container.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.className = 'image-zoom-overlay';
        overlay.innerHTML = `
            <img src="${images[currentImageIndex]}" alt="Zoom">
            <button class="close-zoom" aria-label="Close zoom"><i class="fas fa-times"></i></button>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const close = () => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                document.body.style.overflow = '';
            }, 200);
        };
        overlay.addEventListener('click', close);
        overlay.querySelector('.close-zoom').addEventListener('click', (e) => {
            e.stopPropagation();
            close();
        });

        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', escHandler);
            }
        });
    });
}

// =========================================
// Wishlist & Share
// =========================================
function setupWishlistButton() {
    const btn = document.getElementById('wishlistActionBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (!currentProduct) return;
        toggleWishlist(currentProduct.id);
    });
}

function setupShareButton(product) {
    const btn = document.getElementById('shareBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const shareData = {
            title: product.title,
            text: `Check out ${product.title} on ValuePro — ₹${product.discountedPrice || product.originalPrice}`,
            url: window.location.href
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(window.location.href);
                showToast('Link copied to clipboard!');
            }
        } catch (err) {
            // User cancelled or error
        }
    });
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '2rem', left: '50%',
        transform: 'translateX(-50%)',
        background: '#0f172a', color: '#fff',
        padding: '0.8rem 1.5rem', borderRadius: '12px',
        fontSize: '0.9rem', fontWeight: '500',
        boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
        zIndex: '9999', animation: 'fadeIn 0.3s ease'
    });
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// =========================================
// Related Products — Section-Specific
// =========================================
function renderRelatedProducts(product) {
    const isShop = isMyShopProduct(product);

    // Get all products that are currently visible according to admin settings
    const visibleProducts = Object.values(allProducts).filter(p => {
        if (p.id === product.id) return false; // exclude current product
        return isSectionVisible(p); // only include if its section is visible
    });

    // Related by category (can be from any visible section)
    if (product.category) {
        const byCategory = visibleProducts
            .filter(p => p.category && p.category === product.category)
            .slice(0, 12);
        if (byCategory.length > 0) {
            renderRelatedCarousel(
                document.getElementById('relatedByCategory'),
                `More in ${product.category}`,
                byCategory,
                'cat'
            );
        }
    }

    // Related by brand (can be from any visible section)
    if (product.brand) {
        const byBrand = visibleProducts
            .filter(p => p.brand && p.brand === product.brand)
            .slice(0, 12);
        if (byBrand.length > 0) {
            renderRelatedCarousel(
                document.getElementById('relatedByBrand'),
                `More from ${product.brand}`,
                byBrand,
                'brand'
            );
        }
    }
}

function renderRelatedCarousel(container, title, products, prefix) {
    if (!container || products.length === 0) return;

    container.innerHTML = `
        <div class="section-header">
            <h2>${title}</h2>
            <div class="related-nav-btns">
                <button class="related-nav-btn" id="${prefix}Prev" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
                <button class="related-nav-btn" id="${prefix}Next" aria-label="Next"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
        <div class="related-products-track-wrapper">
            <div class="related-products-track" id="${prefix}Track">
                ${products.map(p => createRelatedCard(p)).join('')}
            </div>
        </div>
    `;

    // Setup native scroll navigation & mouse drag
    const track = document.getElementById(`${prefix}Track`);
    const prevBtn = document.getElementById(`${prefix}Prev`);
    const nextBtn = document.getElementById(`${prefix}Next`);

    const getCardWidth = () => {
        const card = track.querySelector('.product-card');
        return card ? card.offsetWidth + 16 : 236;
    };

    nextBtn.addEventListener('click', () => {
        track.scrollBy({ left: getCardWidth() * 2, behavior: 'smooth' });
    });

    prevBtn.addEventListener('click', () => {
        track.scrollBy({ left: -getCardWidth() * 2, behavior: 'smooth' });
    });

    // Mouse drag scrolling
    let isDown = false;
    let isDragging = false;
    let startX;
    let scrollLeft;

    track.addEventListener('mousedown', (e) => {
        isDown = true;
        isDragging = false; // Reset on new click
        track.style.scrollBehavior = 'auto'; // Disable smooth scroll during drag
        startX = e.pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
    });

    track.addEventListener('mouseleave', () => {
        isDown = false;
        track.style.scrollBehavior = 'smooth';
    });

    track.addEventListener('mouseup', () => {
        isDown = false;
        track.style.scrollBehavior = 'smooth';
        // We do NOT reset isDragging here because we need it for the click event
    });

    track.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - track.offsetLeft;
        const walk = (x - startX) * 2; // Scroll fast
        
        // If moved more than 5px, consider it a drag
        if (Math.abs(walk) > 5) {
            isDragging = true;
        }
        
        track.scrollLeft = scrollLeft - walk;
    });

    // Prevent default link clicks if the user was dragging
    track.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (isDragging) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    });
}

function createRelatedCard(product) {
    let images = [];
    if (Array.isArray(product.images)) images = product.images;
    else if (product.images && typeof product.images === 'object') images = Object.values(product.images);
    
    const img = images[0] || product.imageUrl || product.image || 'images/placeholder.png';
    const discount = product.discountPercentage ? `<span class="discount-percentage">${product.discountPercentage}% OFF</span>` : '';
    const originalPrice = product.originalPrice ? `<span class="original-price">₹${product.originalPrice}</span>` : '';
    const rating = product.rating ? `<div class="rating-box">${product.rating} <i class="fas fa-star"></i></div>` : '';

    const whatsappMessage = encodeURIComponent(
        `Hi! I'm interested in this product:\n\n*${product.title}*\nPrice: ₹${product.discountedPrice || product.originalPrice}\nLink: ${window.location.origin}/product.html?id=${product.id}`
    );
    const whatsappNumber = product.whatsappNumber || '919951806045';
    const isShop = isMyShopProduct(product);

    return `
        <a href="product.html?id=${product.id}" class="product-card" style="text-decoration: none;">
            <div class="product-image-container">
                <img src="${img}" alt="${product.title}" class="product-image" onerror="this.src='images/placeholder.png'">
                ${rating}
            </div>
            <div class="product-info">
                ${product.brand ? `<h4 class="product-brand">${product.brand}</h4>` : ''}
                <h3 class="product-title">${product.title}</h3>
                <div class="price-container">
                    ${product.discountedPrice ? `<span class="discounted-price">₹${product.discountedPrice}</span>` : ''}
                    ${originalPrice}
                    ${discount}
                </div>
                ${isShop ? `
                    <button class="whatsapp-button" onclick="event.preventDefault(); event.stopPropagation(); window.open('https://wa.me/${whatsappNumber}?text=${whatsappMessage}', '_blank');">
                        <i class="fab fa-whatsapp"></i> Chat on WhatsApp
                    </button>
                ` : (product.productUrl ? `
                    <button class="whatsapp-button" style="background: var(--gradient-primary); box-shadow: 0 4px 15px rgba(124,58,237,0.3);" onclick="event.preventDefault(); event.stopPropagation(); window.open('${product.productUrl}', '_blank');">
                        <i class="fas fa-shopping-bag"></i> Buy Now
                    </button>
                ` : '')}
            </div>
        </a>
    `;
}

// =========================================
// Not Found
// =========================================
function renderNotFound() {
    productPage.innerHTML = `
        <div class="product-not-found">
            <i class="fas fa-box-open"></i>
            <h2>Product Not Found</h2>
            <p>The product you're looking for doesn't exist or may have been removed.</p>
            <a href="index.html"><i class="fas fa-arrow-left"></i> Back to Store</a>
        </div>
    `;
}
