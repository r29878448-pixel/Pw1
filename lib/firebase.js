// Firebase configuration for PW App
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
const firebaseConfig = {
  apiKey: "AIzaSyD1QMqvg36iwsTZJJtmuXU7SHMf-rErWPs",
  authDomain: "study-portal-e0ba8.firebaseapp.com",
  projectId: "study-portal-e0ba8",
  storageBucket: "study-portal-e0ba8.firebasestorage.app",
  messagingSenderId: "963386404768",
  appId: "1:963386404768:web:82389285f2f77dd0acfec5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Analytics (only in browser)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
