import React from 'react';
import { useParams } from 'react-router-dom';
import ClientDashboard from './ClientDashboard';

// Wrapper component that extracts projectId from URL and passes it to ClientDashboard
const ClientDashboardView = ({ user }) => {
  const { projectId } = useParams();

  return <ClientDashboard user={user} initialProjectId={projectId} />;
};

export default ClientDashboardView;
