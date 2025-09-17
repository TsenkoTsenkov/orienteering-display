import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, get } from 'firebase/database';

// Your Firebase configuration - using the exact config you provided
const firebaseConfig = {
  apiKey: "AIzaSyBcdimQ_ScFa57nSgKRE7KXRE80sWgyS60",
  authDomain: "orienteering-display.firebaseapp.com",
  databaseURL: "https://orienteering-display-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "orienteering-display",
  storageBucket: "orienteering-display.firebasestorage.app",
  messagingSenderId: "135957995762",
  appId: "1:135957995762:web:9e6e5373ac43cb6201706b",
  measurementId: "G-Z05G3F1TPX"
};

// Initialize Firebase
let app;
let database;

try {
  app = initializeApp(firebaseConfig);
  // Initialize database without URL - Firebase will determine it automatically
  database = getDatabase(app);
  console.log('[Firebase] Initialized successfully');

  // Test the connection
  const testRef = ref(database, '.info/connected');
  onValue(testRef, (snapshot) => {
    const connected = snapshot.val();
    console.log('[Firebase] Database connection status:', connected ? 'Connected' : 'Disconnected');
  });
} catch (error) {
  console.error('[Firebase] Initialization error:', error);
}

// Helper functions for database operations
export const saveData = async (path, data) => {
  if (!database) {
    console.warn('[Firebase] Database not initialized. Please check your Firebase configuration.');
    return false;
  }

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
  if (!database) {
    console.warn('[Firebase] Database not initialized. Please check your Firebase configuration.');
    return null;
  }

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
  if (!database) {
    console.warn('[Firebase] Database not initialized. Please check your Firebase configuration.');
    return () => {}; // Return empty unsubscribe function
  }

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