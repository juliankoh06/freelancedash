const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase-config');

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    // Sign in with Firebase Auth
    const userCredential = await admin.auth().signInWithEmailAndPassword(email, password);
    
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(userCredential.user.uid).get();
    const userData = userDoc.data();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User data not found' });
    }

    // Return user data including role
    res.json({ 
      user: {
        id: userCredential.user.uid,
        username: userData.username,
        email: userData.email,
        role: userData.role
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Registration route
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, role } = req.body;

    if (!['freelancer', 'client'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username
    });

    // Save additional user data in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      username,
      email,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
