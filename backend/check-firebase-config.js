require('dotenv').config();

console.log('\n🔍 Checking Firebase Configuration...\n');

const requiredVars = [
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_CLIENT_CERT_URL'
];

let allPresent = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: Present (${value.substring(0, 20)}...)`);
  } else {
    console.log(`❌ ${varName}: MISSING`);
    allPresent = false;
  }
});

console.log('\n' + '='.repeat(60));

if (allPresent) {
  console.log('✅ All Firebase credentials are present!');
  console.log('\nTrying to initialize Firebase Admin...\n');
  
  try {
    const admin = require('firebase-admin');
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
    
    console.log('✅ Firebase Admin initialized successfully!');
    console.log('   Project ID: freelancedash-58984');
    console.log('   Service Account:', serviceAccount.client_email);
    
    // Test Firestore connection
    const db = admin.firestore();
    db.collection('test').limit(1).get()
      .then(() => {
        console.log('✅ Firestore connection successful!');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌ Firestore connection failed:', err.message);
        process.exit(1);
      });
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
} else {
  console.log('❌ Some Firebase credentials are missing!');
  console.log('\n📝 To fix this:');
  console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
  console.log('2. Select your project: freelancedash-58984');
  console.log('3. Go to Project Settings > Service Accounts');
  console.log('4. Click "Generate New Private Key"');
  console.log('5. Download the JSON file');
  console.log('6. Copy the values to your .env file:');
  console.log('');
  console.log('   FIREBASE_PRIVATE_KEY_ID="xxx"');
  console.log('   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."');
  console.log('   FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@xxx.iam.gserviceaccount.com"');
  console.log('   FIREBASE_CLIENT_ID="xxx"');
  console.log('   FIREBASE_CLIENT_CERT_URL="https://www.googleapis.com/robot/v1/metadata/x509/..."');
  console.log('');
  process.exit(1);
}
