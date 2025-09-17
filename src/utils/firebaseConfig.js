import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off } from 'firebase/database';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Helper functions for database operations
export const saveData = async (path, data) => {
  try {
    await set(ref(database, path), data);
    console.log(`[Firebase] Saved to ${path}:`, data);
    return true;
  } catch (error) {
    console.error(`[Firebase] Error saving to ${path}:`, error);
    return false;
  }
};

export const getData = async (path) => {
  return new Promise((resolve) => {
    const dataRef = ref(database, path);
    onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      console.log(`[Firebase] Got data from ${path}:`, data);
      resolve(data);
    }, { onlyOnce: true });
  });
};

export const listenToData = (path, callback) => {
  const dataRef = ref(database, path);
  const listener = onValue(dataRef, (snapshot) => {
    const data = snapshot.val();
    console.log(`[Firebase] Data updated at ${path}:`, data);
    callback(data);
  });

  // Return unsubscribe function
  return () => off(dataRef, 'value', listener);
};

export { database };