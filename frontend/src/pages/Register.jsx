import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'freelancer',
    address: '',
    company: ''
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('form'); // 'form' or 'otp'
  const [otp, setOtp] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ 
      ...form, 
      [name]: type === 'checkbox' ? checked : value 
    });
    setError('');
  };

  const validateForm = () => {
        const { username, fullName, email, password, confirmPassword, role, address } = form;

        if (!username || !fullName || !email || !password || !confirmPassword || !role) {
            setError('All required fields must be filled.');
            return false;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return false;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return false;
        }

        if (!email.includes('@') || !email.includes('.')) {
            setError('Please enter a valid email address.');
            return false;
        }

        return true;
    };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Send OTP to email
      const response = await axios.post('http://localhost:5000/api/auth/register-with-otp', {
        username: form.username,
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        address: form.address,
        company: form.role === 'client' ? form.company : undefined,
        country: form.country
      });

      if (response.data.success) {
        setStep('otp');
        setError('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/verify-registration-otp', {
        email: form.email,
        otp: otp,
        password: form.password
      });

      if (response.data.success) {
        alert('✅ Account created successfully! You can now log in.');
        navigate('/login');
      }
    } catch (err) {
      const errorData = err.response?.data;
      setError(errorData?.error || 'Verification failed. Please try again.');
      
      if (errorData?.attemptsLeft !== undefined) {
        setAttemptsLeft(errorData.attemptsLeft);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    setError('');
    setOtp('');

    try {
      await axios.post('http://localhost:5000/api/auth/register-with-otp', {
        username: form.username,
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        address: form.address,
        company: form.role === 'client' ? form.company : undefined,
        country: form.country
      });

      alert('✅ New verification code sent!');
      setAttemptsLeft(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToForm = () => {
    setStep('form');
    setOtp('');
    setError('');
    setAttemptsLeft(3);
  };

  // OTP Screen
  if (step === 'otp') {
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

          <p style={{ textAlign: 'center', color: '#28a745', fontSize: '14px', marginBottom: '10px', fontWeight: '500' }}>
            ✓ Verification code sent!
          </p>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '13px', marginBottom: '20px' }}>
            We've sent a 6-digit code to <strong>{form.email}</strong>
          </p>

          <form onSubmit={handleOTPSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="otp" style={{ textAlign: 'center' }}>Enter Verification Code</label>
            <input
              id="otp"
              name="otp"
              type="text"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
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
              disabled={isLoading}
              style={{
                marginTop: 20,
                padding: '10px 12px',
                fontSize: '14px',
                backgroundColor: isLoading ? '#ccc' : '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Verifying...' : 'Verify & Register'}
            </button>

            <button
              type="button"
              onClick={handleBackToForm}
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
              ← Back to registration
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Registration Form Screen
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        backgroundImage: 'url(/freelance.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '40px',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}
      >
        <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
          Create Account
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Role Selection */}
          <div>
            <label htmlFor="role" style={{ fontWeight: '500', marginBottom: '5px', display: 'block' }}>
              I am a: *
            </label>
            <select
              id="role"
              name="role"
              value={form.role}
              onChange={handleChange}
              style={{ 
                padding: '12px', 
                fontSize: '14px', 
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            >
              <option value="freelancer">Freelancer</option>
              <option value="client">Client</option>
            </select>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" style={{ fontWeight: '500', marginBottom: '5px', display: 'block' }}>
              Username *
            </label>
            <input
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Choose a unique username"
              style={{ 
                padding: '12px', 
                fontSize: '14px', 
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="fullName" style={{ fontWeight: '500', marginBottom: '5px', display: 'block' }}>
              Full Name *
            </label>
            <input
              id="fullName"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Your full legal name"
              style={{ 
                padding: '12px', 
                fontSize: '14px', 
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" style={{ fontWeight: '500', marginBottom: '5px', display: 'block' }}>
              Email Address *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="your.email@example.com"
              style={{ 
                padding: '12px', 
                fontSize: '14px', 
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          {/* Company (for clients only) */}
          {form.role === 'client' && (
            <div>
              <label htmlFor="company" style={{ fontWeight: '500', marginBottom: '5px', display: 'block' }}>
                Company Name
              </label>
              <input
                id="company"
                name="company"
                value={form.company}
                onChange={handleChange}
                placeholder="Your company name (optional)"
                style={{ 
                  padding: '12px', 
                  fontSize: '14px', 
                  width: '100%',
                  border: '1px solid #ddd',
                  borderRadius: '6px'
                }}
              />
            </div>
          )}

          {/* Address */}
          <div>
            <label htmlFor="address" style={{ fontWeight: '500', marginBottom: '5px', display: 'block' }}>
              Address
            </label>
            <textarea
              id="address"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Street address, city, state/province"
              rows="3"
              style={{ 
                padding: '12px', 
                fontSize: '14px', 
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: '6px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" style={{ fontWeight: '500', marginBottom: '5px', display: 'block' }}>
              Password *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 8 characters"
              style={{ 
                padding: '12px', 
                fontSize: '14px', 
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" style={{ fontWeight: '500', marginBottom: '5px', display: 'block' }}>
              Confirm Password *
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              style={{ 
                padding: '12px', 
                fontSize: '14px', 
                width: '100%',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          {error && (
            <div style={{ 
              color: '#dc3545', 
              backgroundColor: '#f8d7da', 
              border: '1px solid #f5c6cb',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '10px',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: '500',
              backgroundColor: isLoading ? '#6c757d' : '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              width: '100%',
              transition: 'background-color 0.2s'
            }}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
          Already have an account? <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
