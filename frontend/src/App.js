import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Projects from './pages/Projects';
import Invoices from './pages/Invoices';
import Clients from './pages/Clients';
import ProjectTracking from './pages/ProjectTracking';
import Transactions from './pages/Transactions';
import Finances from './pages/Finances';
import Settings from './pages/Settings';
import ClientDashboard from './pages/ClientDashboard';
import ClientInvitations from './pages/ClientInvitations';
import ClientTransactions from './pages/ClientTransactions';
import ClientPayments from './pages/ClientPayments';
import ProjectProgress from './pages/ProjectProgress';
import InvitationAcceptance from './pages/InvitationAcceptance';

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
        const userFetchStart = performance.now();
        
        try {
          // Fetch user data from Firebase Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userFetchTime = performance.now();
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Get the Firebase ID token for API authentication
            const token = await user.getIdToken();
            
            const userWithToken = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              accessToken: token,
              ...userData
            };
            
            // Set token in API service
            apiService.setToken(token);
            
            setCurrentUser(userWithToken);
          } else {
            setCurrentUser(user);
          }
        } catch (error) {
          console.error('❌ App.js - Error fetching user data:', error);
          setCurrentUser(user);
        }
      } else {
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
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Transactions user={currentUser} /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
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
            path="/client-dashboard" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? <Layout user={currentUser}><ClientDashboard user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/client-invitations" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? <Layout user={currentUser}><ClientInvitations user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/client-transactions" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? <Layout user={currentUser}><ClientTransactions user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/client-payments" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? <Layout user={currentUser}><ClientPayments user={currentUser} /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/project-progress/:projectId" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role === 'client' ? (
              (() => {
                return <ProjectProgress />;
              })()
            ) : <Navigate to="/login" />)} 
          />
          
          {/* Invitation Route - No authentication required */}
          <Route 
            path="/invite/:token" 
            element={<InvitationAcceptance />} 
          />
          
          <Route 
            path="/login" 
            element={isLoadingAuth ? null : (!isAuthenticated ? <Login /> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/dashboard'} />)} 
          />
          <Route 
            path="/register" 
            element={isLoadingAuth ? null : (!isAuthenticated ? <Register /> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/dashboard'} />)} 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;



