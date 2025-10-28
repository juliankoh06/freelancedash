import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Email is required.');
      setIsSubmitting(false);
      return;
    }

    try {
      await apiService.forgotPassword(email);
      setMessage('If an account exists with that email, a password reset link has been sent.');
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
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
          maxWidth: '350px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
      >
        <h2 style={{ textAlign: 'center' }}>Reset Password</h2>

        {!message ? (
          <>
            <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
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
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#28a745', marginBottom: '20px' }}>
              ✓
            </div>
            <p style={{ color: '#28a745', fontSize: '14px', marginBottom: '20px' }}>{message}</p>
            <p style={{ fontSize: '12px', color: '#666' }}>
              Please check your email inbox and follow the instructions to reset your password.
            </p>
          </div>
        )}

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: '14px' }}>
          <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

