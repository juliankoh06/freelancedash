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

// Import components
import Layout from './components/Layout';
import { auth } from './firebase-config';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
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
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Dashboard /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/dashboard" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Dashboard /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/project-tracking" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><ProjectTracking /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/projects" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Projects /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/invoices" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Invoices /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/clients" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Clients /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/transactions" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Transactions /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/finances" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Finances /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/settings" 
            element={isLoadingAuth ? null : (isAuthenticated ? <Layout user={currentUser}><Settings /></Layout> : <Navigate to="/login" />)} 
          />
          <Route 
            path="/login" 
            element={isLoadingAuth ? null : (!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />)} 
          />
          <Route 
            path="/register" 
            element={isLoadingAuth ? null : (!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />)} 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;



