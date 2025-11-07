import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ClientDashboard from './ClientDashboard';

// Fetch the projectId from the URL and passes it to ClientDashboard
const ClientProjectProgressView = ({ user }) => {
  const { projectId } = useParams();
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  useEffect(() => {
    setSelectedProjectId(projectId);
  }, [projectId]);

  return <ClientDashboard user={user} initialProjectId={selectedProjectId} />;
};

export default ClientProjectProgressView;
