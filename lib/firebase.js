// Firebase configuration for PW App
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDcXX5F1b5OWBthflH_UlyvIye3RbLQH3o",
  authDomain: "study-portal-1680a.firebaseapp.com",
  projectId: "study-portal-1680a",
  storageBucket: "study-portal-1680a.firebasestorage.app",
  messagingSenderId: "820409379035",
  appId: "1:820409379035:web:90af88cc4db34f8c2704fe"
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
