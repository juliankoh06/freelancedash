import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase-config';
import { createUserWithEmailAndPassword } from 'firebase/auth';

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
      // Step 1: Create Firebase Authentication account
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const firebaseUser = userCredential.user;

      // Step 2: Create Firestore user document via backend
      const registrationData = {
        username: form.username,
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        address: form.address,
        company: form.role === 'client' ? form.company : undefined,
        firebaseUid: firebaseUser.uid
      };

      await axios.post('http://localhost:5000/api/auth/register', registrationData);
      alert('✅ Registered successfully! You can now log in.');
      navigate('/login');
    } catch (err) {
      // Handle Firebase Auth errors
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError(err.response?.data?.error || err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

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
