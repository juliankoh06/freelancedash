import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const ClientProjectProgress = ({ user }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'client') {
      navigate('/login');
      return;
    }
    fetchClientProjects();
  }, []);

  const fetchClientProjects = async () => {
    try {
      console.log('🔍 Fetching projects for client:', user.email || user.uid);
      
      // Try fetching by email first (primary method for linking clients to projects)
      let response = await fetch(`http://localhost:5000/api/projects/client-email/${encodeURIComponent(user.email)}`);
      let data = await response.json();
      
      console.log('📊 Projects response:', data);
      
      // If API returns success structure, extract data
      let allProjects = [];
      if (data.success && data.data) {
        allProjects = data.data;
      } else if (Array.isArray(data)) {
        allProjects = data;
      }
      
      // Log all project statuses to debug
      console.log('📋 All projects with statuses:', allProjects.map(p => ({
        title: p.title,
        status: p.status,
        clientEmail: p.clientEmail
      })));
      
      // Filter to show only active and completed projects (not pending_contract, draft, etc.)
      // For now, show ALL projects to help debug
      setProjects(allProjects);
      console.log('✅ Showing projects:', allProjects.length);
      
    } catch (error) {
      console.error('❌ Error fetching projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'active':
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'pending_contract':
      case 'pending_invitation':
      case 'pending':
      case 'draft':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <FolderOpen className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'active':
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending_contract':
        return 'bg-orange-100 text-orange-800';
      case 'pending_invitation':
      case 'pending':
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending_contract':
        return 'Awaiting Contract';
      case 'pending_invitation':
        return 'Invitation Sent';
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'draft':
        return 'Draft';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Project Progress</h1>
        <p className="text-gray-600">Track the progress of your projects</p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-500">You don't have any projects yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    {getStatusIcon(project.status)}
                    <h3 className="ml-2 text-lg font-semibold text-gray-900">{project.title}</h3>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4 line-clamp-2">{project.description}</p>
                
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{project.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Start Date:</span>
                    <p className="font-medium">{new Date(project.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Due Date:</span>
                    <p className="font-medium">{new Date(project.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {project.freelancerName && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500">Assigned to:</span>
                    <p className="font-medium text-gray-900">{project.freelancerName}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientProjectProgress;
