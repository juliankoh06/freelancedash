// Import the functions from the SDKs 
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export let analytics = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

export default app;
