import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ProjectTracking from './ProjectTracking';

// Fetch the projectId from the URL and passes it to ProjectTracking
const ProjectTrackingView = () => {
  const { projectId } = useParams();
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  useEffect(() => {
    setSelectedProjectId(projectId);
  }, [projectId]);

  return <ProjectTracking selectedProjectId={selectedProjectId} />;
};

export default ProjectTrackingView;
