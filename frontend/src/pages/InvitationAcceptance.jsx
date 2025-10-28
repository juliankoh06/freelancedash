import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';
import invitationService from '../services/invitationService';
import { CheckCircle, AlertCircle, User, Mail, Lock, Eye, EyeOff, X, AlertTriangle } from 'lucide-react';

const InvitationAcceptance = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [invitation, setInvitation] = useState(null);
  const [project, setProject] = useState(null);
  const [freelancer, setFreelancer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientExists, setClientExists] = useState(false);
  const [existingClient, setExistingClient] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthChoice, setShowAuthChoice] = useState(false);
  
  // Registration form state
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  // Login form state
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (token) {
      loadInvitationData();
    }
  }, [token]);

  // Check for existing authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && invitation) {
        // User is already logged in, check if they can accept this invitation
        handleExistingUserAcceptance(user);
      }
    });
    return unsubscribe;
  }, [invitation]);

  const loadInvitationData = async () => {
    try {
      setLoading(true);
      
      // Get invitation details
      const invitationResult = await invitationService.getInvitation(token);
      if (!invitationResult.success) {
        setError(invitationResult.error);
        return;
      }
      
      setInvitation(invitationResult.data);
      
      // Get project and freelancer details
      const projectResult = await invitationService.getProjectDetails(token);
      if (projectResult.success) {
        setProject(projectResult.data.project);
        setFreelancer(projectResult.data.freelancer);
      }
      
      // Check if client already exists
      const clientCheck = await invitationService.checkClientExists(invitationResult.data.clientEmail);
      if (clientCheck.success && clientCheck.exists) {
        setClientExists(true);
        setExistingClient(clientCheck.client);
        setLoginForm(prev => ({ ...prev, email: invitationResult.data.clientEmail }));
      }
      
    } catch (error) {
      console.error('Error loading invitation data:', error);
      setError('Failed to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  const handleExistingUserAcceptance = async (user) => {
    try {
      console.log('🔍 User already logged in, checking invitation acceptance...');
      console.log('👤 Current user email:', user.email);
      console.log('📧 Invitation email:', invitation.clientEmail);
      
      // Check if the logged-in user's email matches the invitation email
      if (user.email === invitation.clientEmail) {
        // Same user, can accept directly
        console.log('✅ Email matches, accepting invitation...');
        const acceptResult = await invitationService.acceptInvitation(token, user.uid);
        
        console.log('📊 Accept result:', acceptResult);
        
        if (acceptResult.success) {
          // Check if contract signature is required
          const responseData = acceptResult.data;
          console.log('📋 Response data:', responseData);
          
          // Always redirect to Client Invitations page where they can view and sign contracts
          console.log('✅ Invitation accepted, redirecting to invitations page to review contract');
          alert('✅ Invitation accepted successfully! Please review and sign the contract.');
          navigate('/client-invitations');
        } else {
          console.error('❌ Accept failed:', acceptResult.error);
          setError(acceptResult.error);
        }
      } else {
        // Different user, show choice
        console.log('⚠️ Email mismatch, showing auth choice');
        setShowAuthChoice(true);
      }
    } catch (error) {
      console.error('❌ Error handling existing user acceptance:', error);
      setError('Failed to process invitation for logged-in user');
    }
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    
    if (registrationForm.password !== registrationForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (registrationForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, registrationForm.email, registrationForm.password);
      const user = userCredential.user;
      
      // Create user profile
      await setDoc(doc(db, 'users', user.uid), {
        email: registrationForm.email,
        username: registrationForm.name,
        role: 'client',
        createdAt: new Date()
      });
      
      // Accept the invitation
      const acceptResult = await invitationService.acceptInvitation(token, user.uid);
      
      if (acceptResult.success) {
        // Check if contract signature is required
        const responseData = acceptResult.data;
        alert('✅ Invitation accepted successfully! Please review and sign the contract.');
        navigate('/client-invitations');
      } else {
        setError(acceptResult.error);
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleLogin = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      // Sign in the user
      const userCredential = await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      const user = userCredential.user;
      
      // Accept the invitation
      const acceptResult = await invitationService.acceptInvitation(token, user.uid);
      
      if (acceptResult.success) {
        // Check if contract signature is required
        const responseData = acceptResult.data;
        alert('✅ Invitation accepted successfully! Please review and sign the contract.');
        navigate('/client-invitations');
      } else {
        setError(acceptResult.error);
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to reject this invitation?\n\n` +
      `Project: ${project?.title || 'Unknown Project'}\n` +
      `This action cannot be undone and you will not be able to access the project.`
    );
    
    if (confirmed) {
      try {
        setIsProcessing(true);
        const rejectResult = await invitationService.rejectInvitation(token);
        
        if (rejectResult.success) {
          alert('Invitation rejected successfully. You will be redirected to the home page.');
          navigate('/');
        } else {
          setError(rejectResult.error);
        }
        
      } catch (error) {
        console.error('Reject error:', error);
        setError(error.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSwitchUser = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setShowAuthChoice(false);
      // The page will re-render and show login/registration forms
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out. Please try again.');
    }
  };

  const handleContinueAsCurrentUser = async () => {
    try {
      setIsProcessing(true);
      const acceptResult = await invitationService.acceptInvitation(token, currentUser.uid);
      
      if (acceptResult.success) {
        alert('✅ Invitation accepted successfully! Please review and sign the contract.');
        navigate('/client-invitations');
      } else {
        setError(acceptResult.error);
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setError('Failed to accept invitation');
    } finally {
      setIsProcessing(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }


  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Show auth choice if user is logged in but with different email
  if (showAuthChoice && currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Mismatch</h2>
          <p className="text-gray-600 mb-4">
            You're currently logged in as <strong>{currentUser.email}</strong>, but this invitation is for <strong>{invitation?.clientEmail}</strong>.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleSwitchUser}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Switch to {invitation?.clientEmail}
            </button>
            <button
              onClick={handleContinueAsCurrentUser}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Continue as {currentUser.email}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900">
            You're Invited!
          </h2>
          <p className="mt-2 text-gray-600">
            {freelancer?.username || 'A freelancer'} has invited you to collaborate on a project
          </p>
        </div>

        {/* Project Details */}
        {project && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Project Details</h3>
            </div>
            <div className="space-y-2 text-center">
              <p><span className="font-medium">Project:</span> {project.title}</p>
              <p><span className="font-medium">Freelancer:</span> {freelancer?.username || 'Unknown'}</p>
              <p><span className="font-medium">Hourly Rate:</span> RM{project.hourlyRate}/hour</p>
              <p><span className="font-medium">Status:</span> {project.status}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <div className="flex justify-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Existing Client Login */}
        {clientExists ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Welcome Back!</h3>
              <p className="text-gray-600">
                You already have an account. Please sign in to accept this invitation.
              </p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Signing In...' : 'Sign In & Accept Invitation'}
                </button>
                
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject Invitation
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* New Client Registration */
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Your Account</h3>
              <p className="text-gray-600">
                Create a free account to collaborate on this project and track progress.
              </p>
            </div>
            
            <form onSubmit={handleRegistration} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={registrationForm.name}
                    onChange={(e) => setRegistrationForm({...registrationForm, name: e.target.value})}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your full name"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={registrationForm.email}
                    onChange={(e) => setRegistrationForm({...registrationForm, email: e.target.value})}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={registrationForm.password}
                    onChange={(e) => setRegistrationForm({...registrationForm, password: e.target.value})}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Create a password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={registrationForm.confirmPassword}
                    onChange={(e) => setRegistrationForm({...registrationForm, confirmPassword: e.target.value})}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Creating Account...' : 'Create Account & Accept Invitation'}
                </button>
                
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject Invitation
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default InvitationAcceptance;
