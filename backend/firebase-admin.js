const admin = require('firebase-admin');

if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universe_domain: 'googleapis.com'
    };
    credential = admin.credential.cert(serviceAccount);
  } else {
    credential = admin.credential.applicationDefault();
  }

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'freelancedash-58984.appspot.com';
  admin.initializeApp({ credential, storageBucket });
  console.log(' Firebase Admin initialized with bucket:', storageBucket);
}

const db = admin.firestore();
const storage = admin.storage();

module.exports = { admin, db, storage };


