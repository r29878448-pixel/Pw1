// Firebase configuration for PW App
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
const firebaseConfig = {
  apiKey: "AIzaSyDy4cef7XvSOQ0kI-geiBD_-1ZhQ7dlnNg",
  authDomain: "pw-missiontopper-d603d.firebaseapp.com",
  projectId: "pw-missiontopper-d603d",
  storageBucket: "pw-missiontopper-d603d.firebasestorage.app",
  messagingSenderId: "41342728127",
  appId: "1:41342728127:web:983b3e038dd59c6acc130a"
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
