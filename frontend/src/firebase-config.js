// Import the functions from the SDKs 
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCuZtq_Dh5IqKV-KCUpu1KKSd7ohphKnt8",
  authDomain: "freelancedash-58984.firebaseapp.com",
  projectId: "freelancedash-58984",
  storageBucket: "freelancedash-58984.firebasestorage.app",
  messagingSenderId: "954718646502",
  appId: "1:954718646502:web:9adb44315483518e6b4b27",
  measurementId: "G-38C6FRVWE8"
};

console.log('🔧 Firebase Config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKey: firebaseConfig.apiKey ? 'Present' : 'Missing'
});

// Initialize Firebase
console.log('🚀 Initializing Firebase...');
const initStartTime = performance.now();
const app = initializeApp(firebaseConfig);
const initTime = performance.now();
console.log(`✅ Firebase initialized in ${(initTime - initStartTime).toFixed(2)}ms`);

// Initialize Firebase services
console.log('🔧 Initializing Firebase services...');
const servicesStartTime = performance.now();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
const servicesTime = performance.now();
console.log(`✅ Firebase services ready in ${(servicesTime - servicesStartTime).toFixed(2)}ms`);
console.log(`🏁 Total Firebase setup: ${(servicesTime - initStartTime).toFixed(2)}ms`);

// Test Firestore connection
console.log('🧪 Testing Firestore connection...');

// Simple test to verify Firestore is working
const testFirestoreConnection = async () => {
  try {
    console.log('🧪 Testing basic Firestore read...');
    const testCollection = collection(db, 'test');
    await getDocs(testCollection);
    console.log('✅ Firestore connection test successful');
  } catch (error) {
    console.error('❌ Firestore connection test failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
};

// Run test after a short delay to ensure Firebase is fully initialized
setTimeout(testFirestoreConnection, 1000);

export default app;
