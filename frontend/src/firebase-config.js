// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAdFucOoWOtQ-UsXny-rsO6kZ107tpNW7I",
  authDomain: "freelancedash-3442e.firebaseapp.com",
  projectId: "freelancedash-3442e",
  storageBucket: "freelancedash-3442e.firebasestorage.app",
  messagingSenderId: "579857711642",
  appId: "1:579857711642:web:5aca0970cf6957669a07a3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
