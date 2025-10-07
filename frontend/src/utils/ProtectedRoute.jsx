import React from 'react';
import { Navigate } from 'react-router-dom';

export const ProtectedRoute = ({ element: Component, allowedRole, user }) => {
  if (!user) {
    console.log('No user found, redirecting to login');
    return <Navigate to="/login" />;
  }

  if (allowedRole && user.role !== allowedRole) {
    console.log(`User role ${user.role} does not match required role ${allowedRole}`);
    return <Navigate to={user.role === 'client' ? '/client-dashboard' : '/freelancer-dashboard'} />;
  }

  console.log(`Rendering protected route for ${user.role}`);
  return Component;
};