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

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    console.log('🚀 App.js - Setting up auth listener');
    const startTime = performance.now();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const authTime = performance.now();
      console.log(`⏱️ Auth state changed in ${(authTime - startTime).toFixed(2)}ms`);
      
      if (user) {
        console.log('👤 User authenticated:', user.uid);
        const userFetchStart = performance.now();
        
        try {
          // Fetch user data from Firebase Firestore
          console.log('📡 Fetching user data from Firestore...');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userFetchTime = performance.now();
          console.log(`📡 User data fetched in ${(userFetchTime - userFetchStart).toFixed(2)}ms`);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('✅ User data found:', userData.role);
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              ...userData
            });
          } else {
            console.log('⚠️ User document not found in Firestore');
            setCurrentUser(user);
          }
        } catch (error) {
          console.error('❌ App.js - Error fetching user data:', error);
          setCurrentUser(user);
        }
      } else {
        console.log('👋 User logged out');
        setCurrentUser(null);
      }
      
      const totalTime = performance.now();
      console.log(`🏁 Auth flow completed in ${(totalTime - startTime).toFixed(2)}ms`);
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
                <Layout user={currentUser}><Dashboard /></Layout>
            ) : <Navigate to="/login" />)} 
          />
          <Route 
            path="/dashboard" 
            element={isLoadingAuth ? null : (isAuthenticated ? (
              currentUser?.role === 'client' ? 
                <Navigate to="/client-dashboard" /> : 
                <Layout user={currentUser}><Dashboard /></Layout>
            ) : <Navigate to="/login" />)} 
          />
          <Route 
            path="/project-tracking" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><ProjectTracking /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/projects" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Projects /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/invoices" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Invoices /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/clients" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Clients /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/transactions" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Transactions /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/finances" 
            element={isLoadingAuth ? null : (isAuthenticated && currentUser?.role !== 'client' ? <Layout user={currentUser}><Finances /></Layout> : <Navigate to={currentUser?.role === 'client' ? '/client-dashboard' : '/login'} />)} 
          />
          <Route 
            path="/settings" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Settings /></Layout> : <Navigate to="/login" />)} 
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
                console.log('🔍 ProjectProgress route triggered');
                console.log('🔍 isAuthenticated:', isAuthenticated);
                console.log('🔍 currentUser role:', currentUser?.role);
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



