const admin = require('firebase-admin');
require('dotenv').config();

let app;

try {
  if (!admin.apps.length) {
    // Try to initialize with service account key file first
    try {
      const serviceAccount = require('./freelancedash-58984-firebase-adminsdk-fbsvc-aebaf27278.json');
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "freelancedash-58984",
        storageBucket: "freelancedash-58984.firebasestorage.app"
      });
      console.log('Firebase Admin initialized with service account key file');
    } catch (keyError) {
      console.log('Service account key file not found, trying environment variables...');
      
      // Try environment variables
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
        const serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };

        app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: "freelancedash-58984",
          storageBucket: "freelancedash-58984.firebasestorage.app"
        });
        console.log('Firebase Admin initialized with environment variables');
      } else {
        console.log('Environment variables not found, trying application default credentials...');
        
        // Last resort: try application default credentials
        app = admin.initializeApp({
          projectId: "freelancedash-58984",
          storageBucket: "freelancedash-58984.firebasestorage.app"
        });
        console.log('Firebase Admin initialized with application default credentials');
      }
    }
  } else {
    app = admin.apps[0];
  }
} catch (error) {
  console.error('Firebase Admin initialization failed:', error.message);
  console.error('Please ensure you have either:');
  console.error('1. A service-account-key.json file in the backend folder, or');
  console.error('2. Proper environment variables set, or');
  console.error('3. Application default credentials configured');
  throw new Error('Firebase Admin SDK requires authentication credentials');
}


const db = admin.firestore();
const storage = admin.storage();

module.exports = { admin, db, storage };
