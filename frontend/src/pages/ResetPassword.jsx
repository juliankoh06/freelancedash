import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import apiService from '../services/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    // Get token and email from URL query params
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    const emailParam = params.get('email');

    if (!tokenParam || !emailParam) {
      setError('Invalid or missing reset link. Please request a new password reset.');
      setTokenValid(false);
    } else {
      setToken(tokenParam);
      setEmail(emailParam);
      verifyToken(tokenParam, emailParam);
    }
  }, [location]);

  const verifyToken = async (tokenParam, emailParam) => {
    try {
      await apiService.verifyResetToken(tokenParam, emailParam);
      setTokenValid(true);
    } catch (err) {
      console.error('Token verification error:', err);
      setError(err.message || 'Invalid or expired reset link.');
      setTokenValid(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    if (!form.password || !form.confirmPassword) {
      setError('All fields are required.');
      setIsSubmitting(false);
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      setIsSubmitting(false);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }

    try {
      await apiService.resetPassword(token, email, form.password);
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tokenValid && error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundImage: 'url(/freelance.jpg) !important',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '350px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          <h2 style={{ textAlign: 'center', color: '#dc3545' }}>Invalid Reset Link</h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '20px' }}>
            {error}
          </p>
          <div style={{ textAlign: 'center' }}>
            <Link 
              to="/forgot-password" 
              style={{ 
                color: '#007bff', 
                textDecoration: 'none',
                marginRight: '20px'
              }}
            >
              Request New Reset Link
            </Link>
            <Link 
              to="/login" 
              style={{ 
                color: '#007bff', 
                textDecoration: 'none'
              }}
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (message) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundImage: 'url(/freelance.jpg) !important',
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
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            textAlign: 'center'
          }}
        >
          <div style={{ color: '#28a745', fontSize: '48px', marginBottom: '20px' }}>
            ✓
          </div>
          <p style={{ color: '#28a745', fontSize: '16px', marginBottom: '20px' }}>
            {message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'black',
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
        <h2 style={{ textAlign: 'center' }}>Reset Password</h2>

        <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '20px' }}>
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="password">New Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            style={{ padding: '8px', fontSize: '14px' }}
            required
          />

          <label htmlFor="confirmPassword" style={{ marginTop: 10 }}>Confirm New Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
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
              padding: '6px 12px',
              fontSize: '14px',
              backgroundColor: isSubmitting ? '#ccc' : '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              width: '150px',
              alignSelf: 'center'
            }}
          >
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: '14px' }}>
          <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

