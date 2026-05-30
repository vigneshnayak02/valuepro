import { 
    auth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from './firebase-config.js';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginErrorEl = document.getElementById('loginError');
const signupErrorEl = document.getElementById('signupError');
const profileBtn = document.getElementById('profileBtn');

// Handle Auth State Changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log('User logged in:', user.uid);
        if (profileBtn) {
            // Get first letter of email and convert to uppercase
            const firstLetter = user.email.charAt(0).toUpperCase();
            profileBtn.innerHTML = `
                <span class="user-initial">${firstLetter}</span>
                <span class="logout-text">Logout</span>
            `;
            profileBtn.classList.add('logged-in');
            profileBtn.style.width = 'auto';
            profileBtn.style.aspectRatio = 'auto';
            profileBtn.onclick = handleLogout;
        }
        // Redirect to home page if on auth pages
        if (window.location.pathname.includes('login.html') || 
            window.location.pathname.includes('signup.html')) {
            window.location.href = 'index.html';
        }
    } else {
        // User is signed out
        console.log('User logged out');
        if (profileBtn) {
            profileBtn.innerHTML = '<i class="fas fa-user"></i>';
            profileBtn.classList.remove('logged-in');
            profileBtn.style.width = '';
            profileBtn.style.aspectRatio = '1';
            profileBtn.onclick = () => window.location.href = 'login.html';
        }
        // Redirect to login if on protected pages
        if (window.location.pathname.includes('wishlist.html')) {
            window.location.href = 'login.html';
        }
    }
});

// Handle Login
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        loginErrorEl.textContent = '';

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed in
                console.log("Login successful");
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error("Login error:", error);
                loginErrorEl.textContent = getErrorMessage(error.code);
            });
    });
}

// Handle Signup
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        signupErrorEl.textContent = '';

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed up
                console.log("Signup successful");
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error("Signup error:", error);
                signupErrorEl.textContent = getErrorMessage(error.code);
            });
    });
}

// Handle Logout
function handleLogout() {
    signOut(auth).then(() => {
        console.log("Logout successful");
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Logout error:", error);
    });
}

// Helper function to get user-friendly error messages
function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/email-already-in-use':
            return 'This email is already registered.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/operation-not-allowed':
            return 'This operation is not allowed.';
        default:
            return 'An error occurred. Please try again.';
    }
} 