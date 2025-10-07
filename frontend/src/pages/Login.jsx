import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loginStartTime = performance.now();
    console.log('🔐 Starting login process...');

    try {
      console.log('📧 Attempting Firebase authentication...');
      const authStartTime = performance.now();
      const userCredential = await signInWithEmailAndPassword(auth, form.email, form.password);
      const authTime = performance.now();
      console.log(`✅ Firebase auth completed in ${(authTime - authStartTime).toFixed(2)}ms`);
      
      // Get user data from Firestore
      console.log('📡 Fetching user data from Firestore...');
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      console.log('📡 User document reference:', userDocRef.path);
      
      const userDoc = await getDoc(userDocRef);
      const userFetchTime = performance.now();
      console.log(`📡 User data fetched in ${(userFetchTime - authTime).toFixed(2)}ms`);
      console.log('📡 User document exists:', userDoc.exists());
      
      if (!userDoc.exists()) {
        throw new Error('User data not found');
      }

      const userData = userDoc.data();
      console.log('✅ User data from Firestore:', userData);
      console.log('👤 User role:', userData.role);
      
      const totalLoginTime = performance.now();
      console.log(`🏁 Total login time: ${(totalLoginTime - loginStartTime).toFixed(2)}ms`);
      
      // Navigate based on role (App.js will handle fetching user data from Firebase)
      console.log(`🧭 Navigating to ${userData.role === 'client' ? 'client' : 'freelancer'} dashboard...`);
      navigate(userData.role === 'client' ? '/client-dashboard' : '/freelancer-dashboard');
    } catch (err) {
      const errorTime = performance.now();
      console.error(`❌ Login failed after ${(errorTime - loginStartTime).toFixed(2)}ms:`, err);
      setError(err.message || 'Login failed. Please check your credentials.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '350px',
        width: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <h2 style={{ textAlign: 'center' }}>FREELANCEDASH</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            style={{ padding: '8px', fontSize: '14px' }}
          />

          <label htmlFor="password" style={{ marginTop: 10 }}>Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
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
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '90px',
              alignSelf: 'center'
            }}
          >
            {isSubmitting ? '...' : 'Login'}
          </button>
        </form>

        <p style={{ marginTop: 15, textAlign: 'center', fontSize: '14px' }}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
