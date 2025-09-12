const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin configuration
let app;
let db;
let storage;

try {
  // Try to load service account key file first
  const serviceAccountPath = path.join(__dirname, 'service-account-key.json');
  
  try {
    const serviceAccount = require(serviceAccountPath);
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "freelancedash-3442e",
      storageBucket: "freelancedash-3442e.firebasestorage.app"
    });
    console.log('✅ Firebase Admin initialized with service account key');
  } catch (keyError) {
    console.log('📁 Service account key not found, trying application default credentials...');
    
    // Fallback to application default credentials
    app = admin.initializeApp({
      projectId: "freelancedash-3442e",
      storageBucket: "freelancedash-3442e.firebasestorage.app"
    });
    console.log('✅ Firebase Admin initialized with application default credentials');
  }
  
  db = admin.firestore();
  storage = admin.storage();
  
} catch (error) {
  console.log('⚠️  Firebase Admin initialization failed:', error.message);
  console.log('📝 Please download your service account key from Firebase Console');
  console.log('🔧 Place it as "service-account-key.json" in the backend folder');
  
  // Create mock objects so the server doesn't crash
  db = {
    collection: () => ({
      add: () => Promise.resolve({ id: 'mock-id' }),
      get: () => Promise.resolve({ docs: [] }),
      doc: () => ({
        get: () => Promise.resolve({ exists: false }),
        set: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve()
      })
    })
  };
  
  storage = {
    bucket: () => ({
      file: () => ({
        save: () => Promise.resolve(),
        download: () => Promise.resolve()
      })
    })
  };
}

module.exports = { admin, db, storage };