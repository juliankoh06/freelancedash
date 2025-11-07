const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const axios = require('axios');
const User = require('../models/User');
const { userRegistrationSchema, userOTPRegistrationSchema } = require('../validation/schemas');
const Joi = require('joi');
const otpGenerator = require('otp-generator');
const { db, admin } = require('../firebase-admin');
const { sendOTPEmail, sendPasswordResetEmail, sendPasswordResetOTPEmail } = require('../services/emailService');

// Store for temporary OTPs (In production, use Redis or a database)
const otpStore = new Map(); // { email: { otp, expiresAt } }
const resetTokenStore = new Map(); // { email: { token, expiresAt, userId } }

router.post('/register', async (req, res) => {
  // Validate input using Joi schema
  const { error, value } = userRegistrationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: error.details[0].message,
      field: error.details[0].path[0]
    });
  }

  const { username, fullName, email, role, address, company, firebaseUid } = value;

  try {
    // Check if username already exists (usernames must be unique across all roles)
    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check if email already exists (one email = one role in Firebase)
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ 
        error: 'This email is already registered. Please log in or use a different email.'
      });
    }

    // Create user document in Firestore 
    const userData = {
      username,
      fullName,
      email,
      role,
      address: address || '',
      company: role === 'client' ? (company || '') : '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // If firebaseUid is provided, use it as the document ID
    let newUser;
    if (firebaseUid) {
      const { db } = require('../firebase-admin');
      await db.collection('users').doc(firebaseUid).set(userData);
      
      // Set custom claim for role in Firebase Auth
      await admin.auth().setCustomUserClaims(firebaseUid, { role: role });
      
      newUser = { id: firebaseUid, ...userData };
    } else {
      newUser = await User.create(userData);
    }

    res.status(201).json({ 
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register with OTP verification - Step 1: Validate and send OTP
router.post('/register-with-otp', async (req, res) => {
  try {
    // Validate input
    const { error, value } = userOTPRegistrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message,
        field: error.details[0].path[0]
      });
    }

    const { username, fullName, email, role, address, company } = value;

    // Check if username already exists
    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check if email already exists in Firestore
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ 
        error: 'This email is already registered. Please log in.'
      });
    }

    // Check if email exists in Firebase Auth
    try {
      await admin.auth().getUserByEmail(email);
      return res.status(400).json({ 
        error: 'This email is already registered. Please log in.'
      });
    } catch (authError) {
      // Email doesn't exist in Firebase Auth - this is good!
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    // Generate 6-digit OTP
    const otp = otpGenerator.generate(6, { 
      digits: true, 
      lowerCaseAlphabets: false, 
      upperCaseAlphabets: false, 
      specialChars: false 
    });

    // Store OTP with registration data (expires in 5 minutes)
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(`registration:${email}`, {
      otp,
      expiresAt,
      attempts: 0,
      registrationData: {
        username,
        fullName,
        email,
        role,
        address: address || '',
        company: role === 'client' ? (company || '') : ''
      }
    });

    // Send OTP via email
    await sendOTPEmail(email, otp, fullName, 'registration');

    console.log(`✉️ Registration OTP sent to ${email}`);
    
    res.json({ 
      success: true,
      message: 'Verification code sent to your email',
      email: email
    });

  } catch (error) {
    console.error('Registration OTP error:', error);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

// Verify registration OTP - Step 2: Create account
router.post('/verify-registration-otp', async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, OTP, and password are required' });
    }

    // Get stored OTP data
    const otpKey = `registration:${email}`;
    const storedData = otpStore.get(otpKey);

    if (!storedData) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }

    // Check if OTP expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(otpKey);
      return res.status(400).json({ error: 'Verification code expired. Please register again.' });
    }

    // Check attempts
    if (storedData.attempts >= 3) {
      otpStore.delete(otpKey);
      return res.status(400).json({ error: 'Too many failed attempts. Please register again.' });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      otpStore.set(otpKey, storedData);
      return res.status(400).json({ 
        error: 'Invalid verification code. Please try again.',
        attemptsLeft: 3 - storedData.attempts
      });
    }

    // OTP is valid - Create Firebase Auth account
    let firebaseUser;
    try {
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        emailVerified: true // Email verified via OTP
      });
      firebaseUser = userRecord;
    } catch (authError) {
      console.error('Firebase Auth creation error:', authError);
      if (authError.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: 'This email is already registered.' });
      }
      throw authError;
    }

    // Create Firestore user document
    const userData = {
      ...storedData.registrationData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('users').doc(firebaseUser.uid).set(userData);

    // Set custom claim for role
    await admin.auth().setCustomUserClaims(firebaseUser.uid, { 
      role: userData.role 
    });

    // Clean up OTP store
    otpStore.delete(otpKey);

    console.log(`✅ User registered successfully: ${email}`);

    res.json({ 
      success: true,
      message: 'Account created successfully! You can now log in.',
      uid: firebaseUser.uid,
      email: email,
      role: userData.role
    });

  } catch (error) {
    console.error('Registration verification error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// Verify password and send OTP for login
router.post('/login-with-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Verify credentials with Firebase Auth
    try {
      // First, check if user exists
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Verify the password by attempting to generate a sign-in token
      // We need to use the Firebase REST API to verify password since Admin SDK can't do it
      const FIREBASE_AUTH_VERIFY_PASSWORD_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
      
      try {
        const verifyResponse = await axios.post(FIREBASE_AUTH_VERIFY_PASSWORD_URL, {
          email: email,
          password: password,
          returnSecureToken: true
        });
        
        // Password is correct - now generate and send OTP
        const otp = otpGenerator.generate(6, {
          upperCaseAlphabets: false,
          lowerCaseAlphabets: false,
          specialChars: false
        });

        // Store OTP with expiration (10 minutes)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        otpStore.set(email, { otp, expiresAt, uid: userRecord.uid });

        console.log(`📧 Attempting to send OTP to: ${email}`);
        console.log(`🔑 Generated OTP: ${otp}`);

        // Send OTP via email using centralized service
        try {
          await sendOTPEmail(email, otp);
          console.log(`✅ OTP email sent successfully to: ${email}`);
        } catch (emailError) {
          console.error('❌ Email sending failed:', emailError.message);
          // Still return success but log the OTP for development
          console.log(`⚠️ DEV MODE - Use this OTP: ${otp}`);
        }

        res.json({ 
          success: true, 
          message: 'Verification code sent to your email',
          ...(process.env.NODE_ENV === 'development' && { devOTP: otp }) // Only in dev mode
        });
      } catch (passwordError) {
        // Password verification failed
        console.error('Password verification failed:', passwordError.response?.data || passwordError.message);
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }
    } catch (firebaseError) {
      console.error('Firebase error:', firebaseError);
      if (firebaseError.code === 'auth/user-not-found') {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Failed to process login. Please try again.' });
  }
});

// Verify OTP for login (password already verified in previous step)
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const otpData = otpStore.get(email);

    if (!otpData) {
      return res.status(400).json({ error: 'OTP not found or expired. Please login again.' });
    }

    // Check if OTP has expired
    if (new Date() > otpData.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'OTP has expired. Please login again.' });
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    // OTP verified successfully - password was already verified in /login-with-password
    otpStore.delete(email);

    // Get the Firebase user and create a custom token
    try {
      // Use the stored UID from the password verification step
      const userRecord = await admin.auth().getUser(otpData.uid);
      
      // Get user's Firestore document to retrieve role
      const userDoc = await User.findById(userRecord.uid);
      if (!userDoc) {
        return res.status(404).json({ error: 'User profile not found' });
      }
      
      // Set custom claims for the user (ensures Firestore rules can access role)
      await admin.auth().setCustomUserClaims(userRecord.uid, { 
        role: userDoc.role 
      });
      
      // Create a custom token for this user with additional claims
      const customToken = await admin.auth().createCustomToken(userRecord.uid, {
        role: userDoc.role
      });
      
      res.json({ 
        success: true,
        message: 'Login successful',
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        role: userDoc.role,
        customToken: customToken
      });
    } catch (firebaseError) {
      console.error('Firebase error:', firebaseError);
      res.status(500).json({ error: 'Failed to authenticate user' });
    }
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Request password reset with OTP (recommended for localhost)
router.post('/forgot-password-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Generate 6-digit OTP
      const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
      });

      // Store OTP with expiration (10 minutes)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      otpStore.set(`reset:${email}`, { otp, expiresAt, userId: userRecord.uid });

      // Send OTP via email using dedicated password reset template
      await sendPasswordResetOTPEmail(email, otp);

      console.log(`📧 Password reset OTP sent to: ${email}`);
      console.log(`🔑 OTP: ${otp}`);

      res.json({ 
        success: true, 
        message: 'Verification code sent to your email',
        ...(process.env.NODE_ENV === 'development' && { devOTP: otp })
      });
    } catch (firebaseError) {
      // Don't reveal if email exists or not for security
      console.error('Firebase error:', firebaseError);
      if (firebaseError.code === 'auth/user-not-found') {
        return res.json({ 
          success: true, 
          message: 'If an account exists with that email, a verification code has been sent.' 
        });
      }
      return res.status(500).json({ success: false, error: 'Failed to process password reset request' });
    }
  } catch (err) {
    console.error('Password reset OTP error:', err);
    res.status(500).json({ success: false, error: 'Failed to send verification code' });
  }
});

// Reset password with OTP
router.post('/reset-password-otp', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const otpKey = `reset:${email}`;
    const otpData = otpStore.get(otpKey);

    if (!otpData) {
      return res.status(400).json({ error: 'OTP not found or expired. Please request a new one.' });
    }

    // Check if OTP has expired
    if (new Date() > otpData.expiresAt) {
      otpStore.delete(otpKey);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    // Update password using Firebase Admin SDK
    try {
      await admin.auth().updateUser(otpData.userId, {
        password: newPassword
      });

      // Clear OTP
      otpStore.delete(otpKey);

      console.log(`✅ Password reset successfully for: ${email}`);

      res.json({ 
        success: true,
        message: 'Password reset successfully' 
      });
    } catch (updateError) {
      console.error('Password update error:', updateError);
      res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// Request password reset (link-based - for production)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Generate reset token
      const resetToken = otpGenerator.generate(32, {
        upperCaseAlphabets: true,
        lowerCaseAlphabets: true,
        specialChars: false
      });

      // Store reset token with expiration (1 hour)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      resetTokenStore.set(email, { token: resetToken, expiresAt, userId: userRecord.uid });

      // Send reset link via email using centralized service
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      await sendPasswordResetEmail(email, resetLink);

      res.json({ 
        success: true, 
        message: 'Password reset link sent to your email' 
      });
    } catch (firebaseError) {
      // Don't reveal if email exists or not for security
      console.error('Firebase error:', firebaseError);
      if (firebaseError.code === 'auth/user-not-found') {
        // Return success even if user doesn't exist to prevent email enumeration
        return res.json({ 
          success: true, 
          message: 'If an account exists with that email, a password reset link has been sent.' 
        });
      }
      return res.status(500).json({ error: 'Failed to process password reset request' });
    }
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Failed to send password reset email' });
  }
});

// Verify reset token and get user info
router.post('/verify-reset-token', async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Token and email are required' });
    }

    const resetData = resetTokenStore.get(email);

    if (!resetData) {
      return res.status(400).json({ error: 'Reset token not found or expired' });
    }

    // Check if token has expired
    if (new Date() > resetData.expiresAt) {
      resetTokenStore.delete(email);
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    // Verify token
    if (resetData.token !== token) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Token is valid
    res.json({ 
      success: true,
      message: 'Token verified',
      userId: resetData.userId
    });
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(500).json({ error: 'Failed to verify reset token' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return res.status(400).json({ error: 'Token, email, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const resetData = resetTokenStore.get(email);

    if (!resetData) {
      return res.status(400).json({ error: 'Reset token not found or expired' });
    }

    // Check if token has expired
    if (new Date() > resetData.expiresAt) {
      resetTokenStore.delete(email);
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    // Verify token
    if (resetData.token !== token) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Update password using Firebase Admin SDK
    try {
      await admin.auth().updateUser(resetData.userId, {
        password: newPassword
      });

      // Clear reset token
      resetTokenStore.delete(email);

      res.json({ 
        success: true,
        message: 'Password reset successfully' 
      });
    } catch (updateError) {
      console.error('Password update error:', updateError);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
