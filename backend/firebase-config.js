const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Use the downloaded service account key file
  const serviceAccount = require('./freelancedash-58984-62cc3b0aad07.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin initialized with service account key file');
}

const db = admin.firestore();
const storage = admin.storage();

module.exports = { admin, db, storage };
