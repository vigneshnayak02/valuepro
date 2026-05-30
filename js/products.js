// Initial product data
let products = [
    {
        id: 1,
        title: "Wireless Headphones",
        description: "High-quality wireless headphones with noise cancellation",
        image: "https://picsum.photos/400/300?random=1",
        category: "Electronics",
        externalLink: "https://example.com/headphones",
        featured: true
    },
    {
        id: 2,
        title: "Smart Watch",
        description: "Fitness tracking smartwatch with heart rate monitor",
        image: "https://picsum.photos/400/300?random=2",
        category: "Electronics",
        externalLink: "https://example.com/smartwatch",
        featured: true
    },
    {
        id: 3,
        title: "Laptop Backpack",
        description: "Water-resistant laptop backpack with USB charging port",
        image: "https://picsum.photos/400/300?random=3",
        category: "Accessories",
        externalLink: "https://example.com/backpack",
        featured: false
    }
];

// Get products from localStorage or use default data
const loadProducts = () => {
    const storedProducts = localStorage.getItem('products');
    if (storedProducts) {
        products = JSON.parse(storedProducts);
    }
    return products;
};

// Save products to localStorage
const saveProducts = () => {
    localStorage.setItem('products', JSON.stringify(products));
};

// Get all products
const getAllProducts = () => {
    return loadProducts();
};

// Get featured products
const getFeaturedProducts = () => {
    return loadProducts().filter(product => product.featured);
};

// Get product categories
const getCategories = () => {
    const categories = new Set(loadProducts().map(product => product.category));
    return Array.from(categories);
};

// Add new product
const addProduct = (product) => {
    const products = loadProducts();
    product.id = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push(product);
    saveProducts();
    return product;
};

// Update product
const updateProduct = (id, updatedProduct) => {
    const products = loadProducts();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
        products[index] = { ...products[index], ...updatedProduct };
        saveProducts();
        return products[index];
    }
    return null;
};

// Delete product
const deleteProduct = (id) => {
    const products = loadProducts();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
        products.splice(index, 1);
        saveProducts();
        return true;
    }
    return false;
};

// Search products
const searchProducts = (query, category = '') => {
    const products = loadProducts();
    return products.filter(product => {
        const matchesQuery = product.title.toLowerCase().includes(query.toLowerCase()) ||
                           product.description.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = category === '' || product.category === category;
        return matchesQuery && matchesCategory;
    });
}; 