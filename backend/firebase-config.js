const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// For development, we'll use the same project config as the frontend
// In production, you should use proper service account credentials
let app;

try {
  // Try to initialize with application default credentials first
  app = admin.initializeApp({
    projectId: "freelancedash-3442e",
    storageBucket: "freelancedash-3442e.firebasestorage.app"
  });
  console.log('Firebase Admin initialized with application default credentials');
} catch (error) {
  console.log('Application default credentials not available, trying environment variables...');
  
  // Fallback to environment variables if available
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const serviceAccount = {
      type: "service_account",
      project_id: "freelancedash-3442e",
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
      storageBucket: "freelancedash-3442e.firebasestorage.app"
    });
    console.log('Firebase Admin initialized with service account credentials');
  } else {
    console.error('No Firebase credentials available. Please set up authentication.');
    throw new Error('Firebase Admin SDK requires authentication credentials');
  }
}

// Get Firestore and Storage instances
const db = admin.firestore();
const storage = admin.storage();

module.exports = { admin, db, storage };
