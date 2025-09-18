const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set } = require("firebase/database");
const dotenv = require('dotenv');
const { readFileSync } = require('fs');
const { join } = require('path');

dotenv.config({ path: join(__dirname, '..', '.env') });

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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const menData = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'menData.json'), 'utf8'));
const womenData = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'womenData.json'), 'utf8'));

// The app expects eventData.competitions structure where each competition has men and women arrays
const demoProject = {
  id: 'demo-woc-2024',
  name: 'Demo - World Championships 2024',
  timestamp: Date.now(),
  dataSource: 'manual',
  eventData: {
    eventName: 'World Orienteering Championships 2024',
    eventDate: '2024-11-15',
    location: 'Edinburgh, Scotland',
    competitions: [
      {
        id: 'middle-distance',
        name: 'Middle Distance',
        men: menData.competitors,
        women: womenData.competitors,
        status: 'live',
        currentControl: 6,
        lastUpdate: Date.now(),
        courseDetails: {
          men: menData.courseDetails,
          women: womenData.courseDetails
        }
      },
      {
        id: 'long-distance',
        name: 'Long Distance',
        men: menData.competitors.map(c => ({ ...c, id: c.id + 100 })), // Different IDs for different competition
        women: womenData.competitors.map(c => ({ ...c, id: c.id + 100 })),
        status: 'finished',
        currentControl: 8,
        lastUpdate: Date.now(),
        courseDetails: {
          men: { ...menData.courseDetails, distance: "18.5 km", climb: "520 m" },
          women: { ...womenData.courseDetails, distance: "14.2 km", climb: "420 m" }
        }
      }
    ],
    controls: {
      'middle-distance': ['Start', 'Control 1', 'Control 2', 'Control 3', 'Control 4', 'Control 5', 'Control 6', 'Finish'],
      'long-distance': ['Start', 'Control 1', 'Control 2', 'Control 3', 'Control 4', 'Control 5', 'Control 6', 'Control 7', 'Control 8', 'Finish']
    }
  },
  isDemo: true,
  description: 'Demo data for testing and demonstration purposes. Shows realistic competition data from World Orienteering Championships.'
};

async function addDemoData() {
  try {
    const dbPrefix = process.env.REACT_APP_FIREBASE_DB_PREFIX || 'dev';
    console.log(`Adding demo data to Firebase (${dbPrefix} environment)...`);

    const projectPath = `${dbPrefix}/projects/${demoProject.id}`;
    await set(ref(database, projectPath), demoProject);

    // Also set initial competitors data for immediate display
    const initialCompetitorsData = {
      men: demoProject.eventData.competitions[0].men,
      women: demoProject.eventData.competitions[0].women
    };

    await set(ref(database, `${dbPrefix}/competitorsData`), initialCompetitorsData);
    await set(ref(database, `${dbPrefix}/currentCompetitionId`), demoProject.eventData.competitions[0].id);

    console.log('✅ Demo project added successfully!');
    console.log(`Project ID: ${demoProject.id}`);
    console.log(`Project Name: ${demoProject.name}`);
    console.log('');
    console.log('The demo project is now available in your application.');
    console.log('Select "Demo - World Championships 2024" from the project dropdown.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding demo data:', error);
    process.exit(1);
  }
}

addDemoData();