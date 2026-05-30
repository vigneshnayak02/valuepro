// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, get, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
// Import Firebase Auth functions
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updateEmail,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBJKPLiUEMFJYaLBQ3dnHrbBlaaIQ8-DRw",
    authDomain: "valuepro-fa6e8.firebaseapp.com",
    databaseURL: "https://valuepro-fa6e8-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "valuepro-fa6e8",
    storageBucket: "valuepro-fa6e8.firebasestorage.app",
    messagingSenderId: "281661233962",
    appId: "1:281661233962:web:17f65060adb94c00c85c53"
  };
//const firebaseConfig = {
  //  apiKey: "AIzaSyBkoXANp72M3tBUuuoqiffM1ffm9NH2bhs",
    //authDomain: "vylpro-fddbe.firebaseapp.com",
    //databaseURL: "https://vylpro-fddbe-default-rtdb.firebaseio.com",
    //projectId: "vylpro-fddbe",
    //storageBucket: "vylpro-fddbe.firebasestorage.app",
    //messagingSenderId: "865026096423",
    //appId: "1:865026096423:web:6c7369309754638105bd02",
    //measurementId: "G-614P7ZRHGL"
  //};
  
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // Initialize Auth
const storage = getStorage(app); // Initialize Storage
// Export all necessary functions
export { 
    db, 
    auth,
    storage,
    ref, 
    onValue, 
    set, 
    remove,
    get,
    push,
    storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updateEmail,
    deleteUser,
    firebaseConfig,
    initializeApp,
    getAuth
}; 