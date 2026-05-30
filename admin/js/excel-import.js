import { db, ref, set } from '../../js/firebase-config.js';

// Function to validate product data
function validateProduct(product) {
    const requiredFields = ['title', 'category', 'discountedPrice', 'productUrl', 'whatsappNumber'];
    const missingFields = requiredFields.filter(field => !product[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate numeric fields
    if (isNaN(parseFloat(product.discountedPrice))) {
        throw new Error('Discounted price must be a number');
    }
    if (product.originalPrice && isNaN(parseFloat(product.originalPrice))) {
        throw new Error('Original price must be a number');
    }
    if (product.discountPercentage && isNaN(parseInt(product.discountPercentage))) {
        throw new Error('Discount percentage must be a number');
    }

    return true;
}

// Function to process Excel data
function processExcelData(data) {
    const products = [];
    
    // Skip header row and process each row
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue; // Skip empty rows

        const product = {
            id: generateUniqueId(),
            title: row[0],
            brand: row[1] || '',
            category: row[2],
            originalPrice: row[3] ? parseFloat(row[3]) : null,
            discountedPrice: parseFloat(row[4]),
            discountPercentage: row[5] ? parseInt(row[5]) : null,
            rating: row[6] ? parseFloat(row[6]) : 0,
            ratingCount: row[7] ? parseInt(row[7]) : 0,
            description: row[8] || '',
            imageUrl: row[9] || '',
            productUrl: row[10],
            whatsappNumber: row[11] || '919951806045',
            featured: row[12]?.toLowerCase() === 'yes' || false,
            myShop: row[13]?.toLowerCase() === 'yes' || false,
            deliveryInfo: row[14] || '',
            offerTag: row[15] || ''
        };

        try {
            validateProduct(product);
            products.push(product);
        } catch (error) {
            throw new Error(`Error in row ${i + 1}: ${error.message}`);
        }
    }

    return products;
}

// Function to generate unique ID
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Function to import products to Firebase
async function importProductsToFirebase(products) {
    try {
        const productsRef = ref(db, 'products');
        const existingProductsSnapshot = await get(productsRef);
        const existingProducts = existingProductsSnapshot.val() || {};
        
        // Merge new products with existing ones
        const updatedProducts = {
            ...existingProducts,
            ...products.reduce((acc, product) => ({
                ...acc,
                [product.id]: product
            }), {})
        };

        await set(productsRef, updatedProducts);
        return products.length;
    } catch (error) {
        throw new Error(`Failed to import products: ${error.message}`);
    }
}

export { processExcelData, importProductsToFirebase }; 