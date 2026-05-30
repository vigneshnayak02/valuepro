import { 
    db, auth, ref, onValue, set, remove, onAuthStateChanged 
} from './firebase-config.js';

// DOM Elements
const wishlistItemsContainer = document.getElementById('wishlistItemsContainer');
const emptyWishlist = document.getElementById('emptyWishlist');
const wishlistBtn = document.getElementById('wishlistBtn');

// App State
let currentUser = null;
let userWishlist = {};
let allProductsData = {};

// Initialize page
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        fetchUserWishlist(user.uid);
        fetchAllProducts();
    } else {
        window.location.href = 'login.html';
    }
});

// Fetch user's wishlist
function fetchUserWishlist(userId) {
    const wishlistRef = ref(db, `users/${userId}/wishlist`);
    onValue(wishlistRef, (snapshot) => {
        userWishlist = snapshot.val() || {};
        displayWishlistItems();
    }, (error) => {
        console.error("Error fetching wishlist:", error);
        userWishlist = {};
        displayWishlistItems();
    });
}

// Fetch all products
function fetchAllProducts() {
    const productsRef = ref(db, 'products');
    onValue(productsRef, (snapshot) => {
        allProductsData = snapshot.val() || {};
        displayWishlistItems();
    }, (error) => {
        console.error("Error fetching products:", error);
        allProductsData = {};
        displayWishlistItems();
    });
}

// Display wishlist items
function displayWishlistItems() {
    if (!wishlistItemsContainer) return;

    const wishlistedProductIds = Object.keys(userWishlist);
    const wishlistProducts = wishlistedProductIds
        .map(id => allProductsData[id])
        .filter(p => p);

    if (wishlistProducts.length === 0) {
        wishlistItemsContainer.style.display = 'none';
        emptyWishlist.style.display = 'block';
    } else {
        wishlistItemsContainer.style.display = 'grid';
        emptyWishlist.style.display = 'none';
        wishlistItemsContainer.innerHTML = wishlistProducts
            .map(product => createProductCard(product))
            .join('');
    }
}

// Create product card
function createProductCard(product) {
    return `
        <div class="product-card">
            <div class="product-image-container">
                <img src="${product.imageUrl}" alt="${product.title}" class="product-image">
                <button class="wishlist-button" data-product-id="${product.id}">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            <div class="product-info">
                <div class="product-brand">${product.brand}</div>
                <div class="product-title">${product.title}</div>
                <div class="price-container">
                    <span class="discounted-price">$${product.discountedPrice}</span>
                    <span class="original-price">$${product.originalPrice}</span>
                    <span class="discount-percentage">${product.discountPercentage}% OFF</span>
                </div>
                <div class="delivery-info">Free Delivery</div>
            </div>
        </div>
    `;
}

// Handle wishlist button click
if (wishlistItemsContainer) {
    wishlistItemsContainer.addEventListener('click', async (e) => {
        const wishlistButton = e.target.closest('.wishlist-button');
        if (!wishlistButton) return;

        const productId = wishlistButton.dataset.productId;
        if (!productId || !currentUser) return;

        const userId = currentUser.uid;
        const wishlistItemRef = ref(db, `users/${userId}/wishlist/${productId}`);

        try {
            await remove(wishlistItemRef);
            delete userWishlist[productId];
            displayWishlistItems();
        } catch (error) {
            console.error("Error removing from wishlist:", error);
        }
    });
}

// Handle wishlist button in navigation
if (wishlistBtn) {
    wishlistBtn.addEventListener('click', () => {
        if (currentUser) {
            window.location.href = 'wishlist.html';
        } else {
            window.location.href = 'login.html';
        }
    });
} 