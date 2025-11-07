import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Projects from './pages/Projects';
import Invoices from './pages/Invoices';
import Clients from './pages/Clients';
import ProjectTracking from './pages/ProjectTracking';
import ProjectTrackingView from './pages/ProjectTrackingView';
import Transactions from './pages/Transactions';
import Finances from './pages/Finances';
import Settings from './pages/Settings';
import ClientDashboard from './pages/ClientDashboard';
import ClientDashboardView from './pages/ClientDashboardView';
import ClientProjectProgressView from './pages/ClientProjectProgressView';
import ClientInvitations from './pages/ClientInvitations';
import ClientPayments from './pages/ClientPayments';
import InvitationAcceptance from './pages/InvitationAcceptance';
import ContractReview from './pages/ContractReview';

// Import components
import Layout from './components/Layout';
import { auth, db } from './firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import apiService from './services/api';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
        const startTime = performance.now();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const authTime = performance.now();
      
      if (user) {
        console.log('✅ Firebase Auth State Changed - User logged in:', {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified
        });
        
        const userFetchStart = performance.now();
        
        try {
          console.log('📥 Fetching user document from Firestore...');
          // Fetch user data from Firebase Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userFetchTime = performance.now();
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('✅ User document found:', {
              role: userData.role,
              username: userData.username,
              email: userData.email
            });
            
            // Get the Firebase ID token for API authentication (force refresh)
            const token = await user.getIdToken(true);
            console.log('🔑 Firebase ID token obtained');
            
            const userWithToken = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              accessToken: token,
              ...userData
            };
            
            // Set token in API service
            apiService.setToken(token);
            console.log('✅ Token set in API service');
            
            // Set up token refresh interval (refresh every 50 minutes)
            if (apiService.tokenRefreshInterval) {
              clearInterval(apiService.tokenRefreshInterval);
            }
            
            apiService.tokenRefreshInterval = setInterval(async () => {
              try {
                const newToken = await user.getIdToken(true);
                apiService.setToken(newToken);
                console.log('🔄 Token refreshed automatically');
              } catch (error) {
                console.error('❌ Token refresh failed:', error);
                // If refresh fails, user will need to log in again
                clearInterval(apiService.tokenRefreshInterval);
              }
            }, 50 * 60 * 1000); // 50 minutes
            
            setCurrentUser(userWithToken);
            console.log('✅ Authentication complete - User state updated');
          } else {
            console.warn('⚠️ User document not found in Firestore for uid:', user.uid);
            setCurrentUser(user);
          }
        } catch (error) {
          console.error('❌ App.js - Error fetching user data:', error);
          setCurrentUser(user);
        }
      } else {
        console.log('🔓 Firebase Auth State Changed - User logged out');
        // Clear token and refresh interval when user logs out
        apiService.clearToken();
        setCurrentUser(null);
      }
      
      const totalTime = performance.now();
      setIsLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  const isAuthenticated = !!currentUser;

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/project/:projectId/tracking" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><ProjectTrackingView /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/" 
            element={isLoadingAuth ? null : (isAuthenticated ? (
              currentUser?.role === 'client' ? 
                <Layout user={currentUser}><ClientDashboard user={currentUser} /></Layout> : 
                <Layout user={currentUser}><Dashboard user={currentUser} /></Layout>
            ) : <Navigate to="/login" />)} 
          />
          <Route 
            path="/dashboard" 
            element={isLoadingAuth ? null : (isAuthenticated ? (
              currentUser?.role === 'client' ? 
                <Navigate to="/client-dashboard" /> : 
                <Layout user={currentUser}><Dashboard user={currentUser} /></Layout>
            ) : <Navigate to="/login" />)} 
          />
          <Route 
            path="/project-tracking" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><ProjectTracking user={currentUser} /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/projects" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Projects user={currentUser} /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/invoices" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Invoices user={currentUser} /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/clients" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Clients user={currentUser} /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/transactions" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Transactions user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/finances" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Finances user={currentUser} /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/settings" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Settings user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          
          {/* Client Routes */}
          <Route 
            path="/client/project/:projectId/progress" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? <Layout user={currentUser}><ClientProjectProgressView user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/client-dashboard" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? <Layout user={currentUser}><ClientDashboard user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/client-invitations" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? <Layout user={currentUser}><ClientInvitations user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/client-payments" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? <Layout user={currentUser}><ClientPayments user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/project-progress/:projectId" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? <Layout user={currentUser}><ClientDashboardView user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          
          {/* Invitation Route - No authentication required */}
          <Route 
            path="/invite/:token" 
            element={<InvitationAcceptance />} 
          />
          
          {/* Contract Review Route - Authentication required */}
          <Route 
            path="/contracts/:contractId/review" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><ContractReview /></Layout> : <Navigate to="/login" />)} 
          />
          
          <Route 
            path="/login" 
            element={isLoadingAuth ? null : (!isAuthenticated ? <Login /> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/dashboard'} />)} 
          />
          <Route 
            path="/register" 
            element={isLoadingAuth ? null : (!isAuthenticated ? <Register /> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/dashboard'} />)} 
          />
          <Route 
            path="/forgot-password" 
            element={isLoadingAuth ? null : (!isAuthenticated ? <ForgotPassword /> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/dashboard'} />)} 
          />
          <Route 
            path="/reset-password" 
            element={<ResetPassword />} 
          />
          <Route 
            path="/payment" 
            element={<Navigate to="/client-payments" />} 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;



