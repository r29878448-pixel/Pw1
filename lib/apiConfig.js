/**
 * API Configuration Service for PW App
 * Manages admin-configured API Base URL
 * Stored in Firebase Firestore
 */

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Default API URL - fallback if not configured
const DEFAULT_API_URL = 'https://deltaserver-2bfee9989a1f.herokuapp.com';

// Export for immediate use
export const API_BASE_URL = DEFAULT_API_URL;

// API Base URL - cached in memory
let BASE_URL = '';
let isLoading = false;
let loadPromise = null;

// Load API URL from Firebase
const loadApiUrl = async () => {
  if (typeof window === 'undefined') return DEFAULT_API_URL;
  
  // If already loading, return the existing promise
  if (isLoading && loadPromise) {
    return loadPromise;
  }
  
  isLoading = true;
  loadPromise = (async () => {
    try {
      const docRef = doc(db, 'config', 'api');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        BASE_URL = data.baseUrl || DEFAULT_API_URL;
        console.log('✅ API Base URL loaded from Firebase:', BASE_URL);
        return BASE_URL;
      } else {
        // No config in Firebase, use default and save it
        BASE_URL = DEFAULT_API_URL;
        console.log('ℹ️ No API config in Firebase, using default:', DEFAULT_API_URL);
        
        // Save default to Firebase
        try {
          await setDoc(docRef, { baseUrl: DEFAULT_API_URL, updatedAt: new Date().toISOString() });
          console.log('✅ Default API URL saved to Firebase');
        } catch (saveError) {
          console.error('❌ Error saving default API URL:', saveError);
        }
        
        return BASE_URL;
      }
    } catch (error) {
      console.error('❌ Error loading API URL from Firebase:', error);
      // Fallback to default on error
      BASE_URL = DEFAULT_API_URL;
      return DEFAULT_API_URL;
    } finally {
      isLoading = false;
    }
  })();
  
  return loadPromise;
};

// Update BASE_URL and persist to Firebase (admin only)
export const setApiUrl = async (newUrl) => {
  if (!newUrl || typeof newUrl !== 'string') {
    throw new Error('Invalid API URL');
  }
  
  // Validate URL format
  try {
    new URL(newUrl);
  } catch (e) {
    throw new Error('Invalid URL format');
  }
  
  BASE_URL = newUrl.trim();
  
  // Save to Firebase
  try {
    const docRef = doc(db, 'config', 'api');
    await setDoc(docRef, { 
      baseUrl: BASE_URL,
      updatedAt: new Date().toISOString()
    });
    console.log('✅ API Base URL saved to Firebase:', BASE_URL);
  } catch (error) {
    console.error('❌ Error saving API URL to Firebase:', error);
    throw new Error('Failed to save API URL to Firebase');
  }
};

// Get current BASE_URL (async)
export const getApiUrl = async () => {
  if (!BASE_URL) {
    BASE_URL = await loadApiUrl();
  }
  return BASE_URL;
};

// Get current BASE_URL (sync - returns cached or default)
export const getApiUrlSync = () => {
  return BASE_URL || DEFAULT_API_URL;
};

// Validate that BASE_URL is configured
export const validateApiUrl = async () => {
  const url = await getApiUrl();
  if (!url || url.trim() === '') {
    throw new Error('API not configured. Please contact admin.');
  }
  return url;
};

// Custom Batches Management (Firebase Firestore)
export const getCustomBatches = async () => {
  if (typeof window === 'undefined') return [];
  
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const batchesRef = collection(db, 'customBatches');
    const snapshot = await getDocs(batchesRef);
    
    const batches = [];
    snapshot.forEach(doc => {
      batches.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('✅ Custom batches loaded from Firebase:', batches.length);
    return batches;
  } catch (error) {
    console.error('❌ Error loading custom batches from Firebase:', error);
    return [];
  }
};

export const addCustomBatch = async (batch) => {
  // Validate batch
  if (!batch.batchId || !batch.batchName) {
    throw new Error('Batch ID and Name are required');
  }
  
  try {
    const { doc: firestoreDoc, setDoc } = await import('firebase/firestore');
    const batchRef = firestoreDoc(db, 'customBatches', batch.batchId);
    
    await setDoc(batchRef, {
      batchId: batch.batchId,
      batchName: batch.batchName,
      batchImage: batch.batchImage || '',
      _tag: batch._tag || 'Custom',
      _custom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ Custom batch added to Firebase:', batch.batchId);
    return await getCustomBatches();
  } catch (error) {
    console.error('❌ Error adding custom batch:', error);
    throw new Error('Failed to add custom batch to Firebase');
  }
};

export const removeCustomBatch = async (batchId) => {
  try {
    const { doc: firestoreDoc, deleteDoc } = await import('firebase/firestore');
    const batchRef = firestoreDoc(db, 'customBatches', batchId);
    
    await deleteDoc(batchRef);
    console.log('✅ Custom batch removed from Firebase:', batchId);
    return await getCustomBatches();
  } catch (error) {
    console.error('❌ Error removing custom batch:', error);
    throw new Error('Failed to remove custom batch');
  }
};

export const updateCustomBatch = async (batchId, updates) => {
  try {
    const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore');
    const batchRef = firestoreDoc(db, 'customBatches', batchId);
    
    await updateDoc(batchRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ Custom batch updated in Firebase:', batchId);
    return await getCustomBatches();
  } catch (error) {
    console.error('❌ Error updating custom batch:', error);
    throw new Error('Failed to update custom batch');
  }
};

// Get all batches edits from Firebase (for both custom and default batches)
export const getAllBatchesForEdit = async () => {
  if (typeof window === 'undefined') return {};
  
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const editsRef = collection(db, 'batchEdits');
    const snapshot = await getDocs(editsRef);
    
    const edits = {};
    snapshot.forEach(doc => {
      edits[doc.id] = doc.data();
    });
    
    console.log('✅ Batch edits loaded from Firebase:', Object.keys(edits).length);
    return edits;
  } catch (error) {
    console.error('❌ Error loading batch edits from Firebase:', error);
    return {};
  }
};

// Save batch edits to Firebase (for both custom and default batches)
export const saveBatchEdit = async (batchId, edits) => {
  if (typeof window === 'undefined') return;
  
  try {
    const { doc: firestoreDoc, setDoc } = await import('firebase/firestore');
    const editRef = firestoreDoc(db, 'batchEdits', batchId);
    
    await setDoc(editRef, {
      ...edits,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('✅ Batch edits saved to Firebase:', batchId);
  } catch (error) {
    console.error('❌ Error saving batch edits:', error);
    throw new Error('Failed to save batch edits to Firebase');
  }
};

// Get edited batch data (async version for Firebase)
export const getBatchWithEdits = async (batch) => {
  try {
    const { doc: firestoreDoc, getDoc } = await import('firebase/firestore');
    const editRef = firestoreDoc(db, 'batchEdits', batch.batchId);
    const editSnap = await getDoc(editRef);
    
    if (editSnap.exists()) {
      const batchEdits = editSnap.data();
      return {
        ...batch,
        batchName: batchEdits.batchName || batch.batchName,
        batchImage: batchEdits.batchImage || batch.batchImage,
        _tag: batchEdits._tag || batch._tag
      };
    }
    
    return batch;
  } catch (error) {
    console.error('❌ Error getting batch edits:', error);
    return batch;
  }
};

// Sync version for immediate use (returns batch as-is, edits loaded separately)
export const getBatchWithEditsSync = (batch, edits = {}) => {
  const batchEdits = edits[batch.batchId];
  
  if (!batchEdits) return batch;
  
  return {
    ...batch,
    batchName: batchEdits.batchName || batch.batchName,
    batchImage: batchEdits.batchImage || batch.batchImage,
    _tag: batchEdits._tag || batch._tag
  };
};
