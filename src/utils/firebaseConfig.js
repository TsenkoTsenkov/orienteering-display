import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, off } from "firebase/database";

// Your Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let app;
let database;

try {
  app = initializeApp(firebaseConfig);
  // Initialize database without URL - Firebase will determine it automatically
  database = getDatabase(app);
  console.log("[Firebase] Initialized successfully");

  // Test the connection
  const testRef = ref(database, ".info/connected");
  onValue(testRef, (snapshot) => {
    const connected = snapshot.val();
    console.log(
      "[Firebase] Database connection status:",
      connected ? "Connected" : "Disconnected",
    );
  });
} catch (error) {
  console.error("[Firebase] Initialization error:", error);
}

// Get database prefix based on environment
const getDbPrefix = () => {
  const prefix = process.env.REACT_APP_FIREBASE_DB_PREFIX || 'dev';
  const env = process.env.REACT_APP_ENV || 'development';
  console.log(`[Firebase] Using database prefix: ${prefix} (env: ${env})`);
  return prefix;
};

// Helper functions for database operations
export const saveData = async (path, data) => {
  if (!database) {
    console.warn(
      "[Firebase] Database not initialized. Please check your Firebase configuration.",
    );
    return false;
  }

  try {
    const prefixedPath = `${getDbPrefix()}/${path}`;
    await set(ref(database, prefixedPath), data);
    console.log(`[Firebase] Saved to ${prefixedPath}:`, data);
    return true;
  } catch (error) {
    console.error(`[Firebase] Error saving to ${path}:`, error);
    return false;
  }
};

export const getData = async (path) => {
  if (!database) {
    console.warn(
      "[Firebase] Database not initialized. Please check your Firebase configuration.",
    );
    return null;
  }

  return new Promise((resolve) => {
    const prefixedPath = `${getDbPrefix()}/${path}`;
    const dataRef = ref(database, prefixedPath);
    onValue(
      dataRef,
      (snapshot) => {
        const data = snapshot.val();
        console.log(`[Firebase] Got data from ${prefixedPath}:`, data);
        resolve(data);
      },
      { onlyOnce: true },
    );
  });
};

export const listenToData = (path, callback) => {
  if (!database) {
    console.warn(
      "[Firebase] Database not initialized. Please check your Firebase configuration.",
    );
    return () => {}; // Return empty unsubscribe function
  }

  const prefixedPath = `${getDbPrefix()}/${path}`;
  const dataRef = ref(database, prefixedPath);
  const listener = onValue(dataRef, (snapshot) => {
    const data = snapshot.val();
    console.log(`[Firebase] Data updated at ${prefixedPath}:`, data);
    callback(data);
  });

  // Return unsubscribe function
  return () => off(dataRef, "value", listener);
};

export { database };
