import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'freelancer' // Default role
  });

  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, email, password, confirmPassword, role } = form;

    if (!username || !email || !password || !confirmPassword || !role) {
      setError('All fields are required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const registerStartTime = performance.now();
    try {
      console.log('📝 Starting registration process...');
      
      console.log('👤 Creating Firebase user account...');
      const authStartTime = performance.now();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const authTime = performance.now();
      console.log(`✅ User account created in ${(authTime - authStartTime).toFixed(2)}ms`);
      
      if (auth.currentUser) {
        console.log('📝 Updating user profile...');
        const profileStartTime = performance.now();
        await updateProfile(auth.currentUser, { displayName: username });
        const profileTime = performance.now();
        console.log(`✅ Profile updated in ${(profileTime - profileStartTime).toFixed(2)}ms`);
      }
      
      console.log('💾 Saving user data to Firestore...');
      const firestoreStartTime = performance.now();
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email,
        username,
        role,
        createdAt: new Date().toISOString()
      });
      const firestoreTime = performance.now();
      console.log(`✅ User data saved in ${(firestoreTime - firestoreStartTime).toFixed(2)}ms`);

      const totalRegisterTime = performance.now();
      console.log(`🏁 Total registration time: ${(totalRegisterTime - registerStartTime).toFixed(2)}ms`);

      // Navigate based on role (App.js will handle fetching user data from Firebase)
      console.log(`🧭 Navigating to ${role === 'client' ? 'client' : 'freelancer'} dashboard...`);
      navigate(role === 'client' ? '/client-dashboard' : '/dashboard');
    } catch (err) {
      const errorTime = performance.now();
      console.error(`❌ Registration failed after ${(errorTime - registerStartTime).toFixed(2)}ms:`, err);
      setError(err.message || 'Registration failed.');
    }
  };

  return (
    <div
      style={{
                minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '30px',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
      >
        <h2 style={{ textAlign: 'center' }}>📝 Register</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            value={form.username}
            onChange={handleChange}
            style={{ padding: '8px', fontSize: '14px' }}
          />

          <label htmlFor="email" style={{ marginTop: 10 }}>Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            style={{ padding: '8px', fontSize: '14px' }}
          />

          <label htmlFor="role" style={{ marginTop: 10 }}>I am a:</label>
          <select
            id="role"
            name="role"
            value={form.role}
            onChange={handleChange}
            style={{ padding: '8px', fontSize: '14px' }}
          >
            <option value="freelancer">Freelancer</option>
            <option value="client">Client</option>
          </select>

          <label htmlFor="password" style={{ marginTop: 10 }}>Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            style={{ padding: '8px', fontSize: '14px' }}
          />

          <label htmlFor="confirmPassword" style={{ marginTop: 10 }}>Confirm Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            style={{ padding: '8px', fontSize: '14px' }}
          />

          {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}

          <button
            type="submit"
            style={{
              marginTop: 20,
              padding: '6px 12px',
              fontSize: '14px',
              backgroundColor: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100px',
              alignSelf: 'center'
            }}
          >
            Register
          </button>
        </form>

        <p style={{ marginTop: 15, textAlign: 'center', fontSize: '14px' }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
