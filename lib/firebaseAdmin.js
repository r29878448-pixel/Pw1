/**
 * Firebase Admin for API Routes (CommonJS)
 * API URL set by admin via Admin Panel → stored in Firebase.
 * Uses aggressive caching + short timeout so Firebase offline = instant fallback.
 */

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBvOelr7XJ-MTYRUaxMDakTGpQcmEumZNs",
  authDomain: "pw-missiontopper.firebaseapp.com",
  projectId: "pw-missiontopper",
  storageBucket: "pw-missiontopper.firebasestorage.app",
  messagingSenderId: "255162339734",
  appId: "1:255162339734:web:f49f464c93c63bc280cdb7",
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

// In-process cache
let cachedUrl = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 min
const FIREBASE_TIMEOUT = 3000;     // 3s max — if Firebase is slow, use cache/fallback

// Fallback: last known good URL persisted across cold starts via module scope
// Admin sets this via Admin Panel → it gets cached here on first successful fetch
const LAST_KNOWN_FALLBACK = 'https://adc.onrender.app';

async function fetchFromFirebase() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Firebase timeout (3s)')), FIREBASE_TIMEOUT);
    getDoc(doc(db, 'config', 'api'))
      .then(snap => {
        clearTimeout(timer);
        if (snap.exists() && snap.data().baseUrl) {
          resolve(snap.data().baseUrl);
        } else {
          reject(new Error('No API URL in Firebase — set it in Admin Panel'));
        }
      })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

async function getApiUrlFromFirebase() {
  const now = Date.now();

  // Return fresh cache immediately
  if (cachedUrl && (now - cacheTime) < CACHE_TTL) {
    return cachedUrl;
  }

  try {
    const url = await fetchFromFirebase();
    cachedUrl = url;
    cacheTime = now;
    console.log('✅ API URL:', url);
    return url;
  } catch (err) {
    console.warn('⚠️ Firebase:', err.message);
    // Return stale cache if available (better than nothing)
    if (cachedUrl) {
      console.log('↩️ Using stale cache:', cachedUrl);
      return cachedUrl;
    }
    // Last resort fallback
    console.log('↩️ Using fallback:', LAST_KNOWN_FALLBACK);
    return LAST_KNOWN_FALLBACK;
  }
}

function clearApiUrlCache() {
  cachedUrl = null;
  cacheTime = 0;
}

module.exports = { db, getApiUrlFromFirebase, clearApiUrlCache };
