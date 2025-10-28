const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { userRegistrationSchema } = require('../validation/schemas');
const Joi = require('joi');
const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const { db, admin } = require('../firebase-admin');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

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

  const { username, fullName, email, role, address, country, company, firebaseUid } = value;

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
      country: country || '',
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

// Verify password and send OTP for login
router.post('/login-with-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Verify credentials with Firebase Auth
    try {
      // We can't directly verify password with admin SDK, but we can check if user exists
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Generate 6-digit OTP
      const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
      });

      // Store OTP with expiration (10 minutes) and temporarily store password for verification
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      otpStore.set(email, { otp, expiresAt, password });

      console.log(`📧 Attempting to send OTP to: ${email}`);
      console.log(`🔑 Generated OTP: ${otp}`);

      // Send OTP via email
      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: email,
        subject: 'Your Login Verification Code - FreelanceDash',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #667eea;">FreelanceDash Login Verification</h2>
            <p>Hello,</p>
            <p>A login attempt was made to your account. Please enter this verification code to complete your login:</p>
            <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; color: #667eea;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes. If you didn't attempt to log in, please secure your account immediately.</p>
            <p style="margin-top: 30px; color: #666;">Best regards,<br>FreelanceDash Team</p>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
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
    } catch (firebaseError) {
      console.error('Firebase error:', firebaseError);
      if (firebaseError.code === 'auth/user-not-found') {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to process login. Please try again.' });
  }
});

// Verify OTP for login (verifies both password and OTP)
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, password } = req.body;

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

    // Verify password matches the one stored during login attempt
    if (password && otpData.password !== password) {
      otpStore.delete(email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // OTP verified successfully
    otpStore.delete(email);

    // Get the Firebase user and create a custom token
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      
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

// Request password reset
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

      // Send reset link via email
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: email,
        subject: 'Password Reset Request - FreelanceDash',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #667eea;">Password Reset Request</h2>
            <p>Hello,</p>
            <p>You requested to reset your password for your FreelanceDash account.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 14px; word-break: break-all;">${resetLink}</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
            <p style="margin-top: 30px; color: #666;">Best regards,<br>FreelanceDash Team</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);

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
