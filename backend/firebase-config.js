const admin = require('firebase-admin');

// Only initialize once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    storageBucket: 'freelancedash-58984.appspot.com',
  });
  console.log('✅ Firebase Admin initialized');
}

const db = admin.firestore();
const storage = admin.storage();
module.exports = { admin, db, storage };