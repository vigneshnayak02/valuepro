import { db, ref, set } from './firebase-config.js';

// Reference to the products node
const productsRef = ref(db, 'products');

// Delete all products by setting the products node to null
async function deleteAllProducts() {
    try {
        await set(productsRef, null);
        console.log('All products have been deleted successfully');
    } catch (error) {
        console.error('Error deleting products:', error);
    }
}

// Execute the deletion
deleteAllProducts(); 