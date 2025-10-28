import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase-config';
import apiService from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!form.email.trim() || !form.password.trim()) {
      setError('Email and password are required.');
      setIsSubmitting(false);
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Send password to backend, which will verify and send OTP
      await apiService.loginWithPassword(form.email, form.password);
      setOtpSent(true);
      setError('');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOTPVerify = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!form.otp.trim()) {
      setError('OTP is required.');
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('🔐 Verifying OTP for:', form.email);
      const response = await apiService.verifyOTP(form.email, form.otp, form.password);
      console.log('✅ OTP verification response:', response);
      
      // Sign in with the custom token from Firebase
      if (response.customToken) {
        console.log('🔑 Signing in with custom token...');
        await signInWithCustomToken(auth, response.customToken);
        console.log('✅ Successfully signed in with Firebase');
        
        // Store user role in localStorage for easy access
        if (response.role) {
          localStorage.setItem('userRole', response.role);
          console.log('✅ User role stored:', response.role);
        }
        
        // Navigate to appropriate dashboard based on role
        if (response.role === 'client') {
          console.log(' Redirecting to client dashboard...');
          navigate('/client-dashboard');
        } else if (response.role === 'freelancer') {
          console.log(' Redirecting to freelancer dashboard...');
          navigate('/');
        } else {
          console.log(' Redirecting to default dashboard...');
          navigate('/');
        }
      } else {
        console.error(' No custom token received');
        setError('Authentication failed. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(' OTP verification error:', err);
      setError(err.message || 'Invalid OTP. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    if (otpSent) {
      await handleOTPVerify(e);
    } else {
      await handlePasswordSubmit(e);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundImage: 'url(/freelance.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '30px',
          borderRadius: '8px',
          maxWidth: '350px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
      >
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>FREELANCEDASH</h2>

        {!otpSent ? (
          <>
            <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Enter your credentials to login
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                style={{ padding: '8px', fontSize: '14px' }}
                required
              />

              <label htmlFor="password" style={{ marginTop: 10 }}>Password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                style={{ padding: '8px', fontSize: '14px' }}
                required
              />

              {error && <p style={{ color: 'red', marginTop: 10, fontSize: '14px' }}>{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: 20,
                  padding: '10px 12px',
                  fontSize: '14px',
                  backgroundColor: isSubmitting ? '#ccc' : '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'Verifying...' : 'Continue'}
              </button>

              <Link 
                to="/forgot-password" 
                style={{ 
                  marginTop: '15px', 
                  textAlign: 'center', 
                  fontSize: '12px', 
                  color: '#007bff',
                  textDecoration: 'none'
                }}
              >
                Forgot Password?
              </Link>
            </form>
          </>
        ) : (
          <>
            <p style={{ textAlign: 'center', color: '#28a745', fontSize: '14px', marginBottom: '10px', fontWeight: '500' }}>
              ✓ Verification code sent!
            </p>
            <p style={{ textAlign: 'center', color: '#666', fontSize: '13px', marginBottom: '20px' }}>
              We've sent a 6-digit code to <strong>{form.email}</strong>
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="otp" style={{ textAlign: 'center' }}>Enter Verification Code</label>
              <input
                id="otp"
                name="otp"
                type="text"
                value={form.otp}
                onChange={handleChange}
                placeholder="000000"
                style={{ 
                  padding: '12px', 
                  fontSize: '20px', 
                  textAlign: 'center', 
                  letterSpacing: '10px',
                  fontWeight: 'bold',
                  marginTop: '10px'
                }}
                maxLength="6"
                required
                autoFocus
              />

              {error && <p style={{ color: 'red', marginTop: 10, fontSize: '14px', textAlign: 'center' }}>{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: 20,
                  padding: '10px 12px',
                  fontSize: '14px',
                  backgroundColor: isSubmitting ? '#ccc' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Login'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setForm({ ...form, otp: '' });
                  setError('');
                }}
                style={{
                  marginTop: 10,
                  padding: '8px',
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                  color: '#666',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                ← Back to login
              </button>
            </form>
          </>
        )}

        <p style={{ marginTop: 15, textAlign: 'center', fontSize: '14px' }}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
