import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { Archive, RefreshCw, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';

const ClientArchive = ({ user }) => {
  const navigate = useNavigate();
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freelancerUsernames, setFreelancerUsernames] = useState({});

  useEffect(() => {
    if (!user || user.role !== 'client') {
      navigate('/login');
      return;
    }

    // Real-time listener for archived projects
    const q = query(
      collection(db, 'projects'),
      where('clientEmail', '==', user.email),
      where('clientVisible', '==', false)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const projects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setArchivedProjects(projects);

      // Fetch freelancer usernames
      const freelancerIds = [...new Set(projects.map((p) => p.freelancerId).filter(Boolean))];
      const usernamePromises = freelancerIds.map(async (freelancerId) => {
        const username = await fetchFreelancerUsername(freelancerId);
        return { freelancerId, username };
      });
      const usernameResults = await Promise.all(usernamePromises);
      const usernameMap = {};
      usernameResults.forEach(({ freelancerId, username }) => {
        usernameMap[freelancerId] = username;
      });
      setFreelancerUsernames(usernameMap);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, navigate]);

  const fetchFreelancerUsername = async (freelancerId) => {
    try {
      if (!freelancerId) return 'Unknown';
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', freelancerId)));
      if (!userDoc.empty) {
        return userDoc.docs[0].data().username || 'Unknown';
      }
      return 'Unknown';
    } catch (error) {
      console.error('Error fetching freelancer username:', error);
      return 'Unknown';
    }
  };

  const handleRestoreProject = async (projectId) => {
    try {
      const confirmed = window.confirm(
        'Are you sure you want to restore this project? It will appear in your active projects list.'
      );
      if (!confirmed) return;

      await updateDoc(doc(db, 'projects', projectId), {
        clientVisible: true,
        restoredByClientAt: new Date(),
        updatedAt: new Date(),
      });

      alert('✅ Project restored successfully.');
    } catch (error) {
      console.error('Error restoring project:', error);
      alert('Failed to restore project. Please try again.');
    }
  };

  const handleDeleteProject = async (projectId, projectTitle) => {
    try {
      const confirmed = window.confirm(
        `⚠️ WARNING: Are you sure you want to permanently delete "${projectTitle}"?\n\nThis action CANNOT be undone. All project data, tasks, and history will be permanently removed.`
      );
      if (!confirmed) return;

      const doubleConfirm = window.confirm(
        `This is your last chance. Type "DELETE" in the next prompt to confirm permanent deletion.`
      );
      if (!doubleConfirm) return;

      const finalConfirm = prompt('Type "DELETE" (in capitals) to confirm:');
      if (finalConfirm !== 'DELETE') {
        alert('Deletion cancelled. Text did not match.');
        return;
      }

      await deleteDoc(doc(db, 'projects', projectId));
      alert('🗑️ Project permanently deleted.');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading archived projects...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center mb-2">
              <Archive className="w-6 h-6 text-gray-600 mr-2" />
              <h1 className="text-2xl font-semibold text-gray-900">Archived Projects</h1>
            </div>
            <p className="text-gray-600">
              Manage your archived projects. You can restore them or permanently delete them.
            </p>
          </div>
          <button
            onClick={() => navigate('/client-dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </button>
        </div>
      </div>

      {archivedProjects.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Archive className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Archived Projects</h3>
          <p className="text-gray-500">
            You haven't archived any projects yet. Archived projects will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-yellow-50 border-b border-yellow-100">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Warning:</strong> Permanently deleting a project will remove all associated data
                including tasks, milestones, and history. This action cannot be undone.
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Freelancer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archived Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {archivedProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {freelancerUsernames[project.freelancerId] || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{project.title}</div>
                      {project.description && (
                        <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {project.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {project.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {project.archivedByClientAt
                        ? new Date(
                            project.archivedByClientAt.toDate
                              ? project.archivedByClientAt.toDate()
                              : project.archivedByClientAt
                          ).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleRestoreProject(project.id)}
                          className="flex items-center text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-md transition-colors duration-200"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Restore
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id, project.title)}
                          className="flex items-center text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-md transition-colors duration-200"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientArchive;
