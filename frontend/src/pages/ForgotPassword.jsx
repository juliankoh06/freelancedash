import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiService from '../services/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOTP = async (e) => {
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
      const response = await apiService.forgotPasswordOTP(email);
      if (response && response.success) {
        setOtpSent(true);
        setMessage('');
      } else {
        setError(response?.message || 'Failed to send verification code.');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!otp.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('All fields are required.');
      setIsSubmitting(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      setIsSubmitting(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiService.resetPasswordWithOTP(email, otp, newPassword);
      if (response && response.success) {
        setMessage('Password reset successfully! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(response?.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
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
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
      >
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Reset Password</h2>

        {message ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', color: '#28a745', marginBottom: '20px' }}>✓</div>
            <p style={{ color: '#28a745', fontSize: '16px', fontWeight: '500', marginBottom: '10px' }}>{message}</p>
          </div>
        ) : !otpSent ? (
          <>
            <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              Enter your email address and we'll send you a verification code.
            </p>

            <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column' }}>
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
                style={{ padding: '10px', fontSize: '14px', marginTop: '5px' }}
                required
                autoFocus
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
                {isSubmitting ? 'Sending...' : 'Send Verification Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={{ textAlign: 'center', color: '#28a745', fontSize: '14px', marginBottom: '10px', fontWeight: '500' }}>
              ✓ Verification code sent!
            </p>
            <p style={{ textAlign: 'center', color: '#666', fontSize: '13px', marginBottom: '20px' }}>
              We've sent a 6-digit code to <strong>{email}</strong>
            </p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="otp" style={{ textAlign: 'center', marginBottom: '5px' }}>Verification Code</label>
              <input
                id="otp"
                name="otp"
                type="text"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value);
                  setError('');
                }}
                placeholder="000000"
                style={{ 
                  padding: '12px', 
                  fontSize: '20px', 
                  textAlign: 'center', 
                  letterSpacing: '10px',
                  fontWeight: 'bold',
                  marginBottom: '15px'
                }}
                maxLength="6"
                required
                autoFocus
              />

              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                style={{ padding: '10px', fontSize: '14px', marginTop: '5px', marginBottom: '15px' }}
                required
              />

              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                style={{ padding: '10px', fontSize: '14px', marginTop: '5px' }}
                required
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
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtp('');
                  setNewPassword('');
                  setConfirmPassword('');
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
                ← Back to email
              </button>
            </form>
          </>
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

