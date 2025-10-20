const admin = require('firebase-admin');
require('dotenv').config();

let db = null;
let storage = null;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Use environment variables for service account credentials (more secure)
    const serviceAccount = {
      type: "service_account",
      project_id: "freelancedash-58984",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universe_domain: "googleapis.com"
    };
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'freelancedash-58984'
    });
    
    db = admin.firestore();
    storage = admin.storage();
    
    console.log('✅ Firebase Admin initialized with environment variables');
    console.log('   Project ID: freelancedash-58984');
    console.log('   Service Account:', serviceAccount.client_email);
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.error('⚠️  Please check your .env file has all required Firebase credentials');
    console.error('📝 Required variables:');
    console.error('   - FIREBASE_PRIVATE_KEY_ID');
    console.error('   - FIREBASE_PRIVATE_KEY');
    console.error('   - FIREBASE_CLIENT_EMAIL');
    console.error('   - FIREBASE_CLIENT_ID');
    console.error('   - FIREBASE_CLIENT_CERT_URL');
    console.error('');
    console.error('⚠️  Email features will be disabled until Firebase is properly configured.');
  }
}

module.exports = { admin, db, storage };
