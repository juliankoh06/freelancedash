import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import invitationService from '../services/invitationService';
import { 
  CheckCircle, 
  X, 
  User, 
  Clock, 
  DollarSign,
  Calendar,
  TrendingUp,
  ArrowLeft
} from 'lucide-react';

const ClientInvitations = ({ user }) => {
  const navigate = useNavigate();
  const [invitedProjects, setInvitedProjects] = useState([]);
  const [invitationDetails, setInvitationDetails] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'client') {
      navigate('/login');
      return;
    }
    fetchInvitedProjects();
  }, [user, navigate]);

  const fetchInvitedProjects = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'invitations'),
        where('clientEmail', '==', user.email),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      const invitations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvitedProjects(invitations);

      // Fetch project and freelancer details
      const details = {};
      for (const invitation of invitations) {
        try {
          const projectDoc = await getDoc(doc(db, 'projects', invitation.projectId));
          const projectData = projectDoc.exists ? { id: projectDoc.id, ...projectDoc.data() } : null;
          
          const freelancerDoc = await getDoc(doc(db, 'users', invitation.freelancerId));
          const freelancerData = freelancerDoc.exists ? { id: freelancerDoc.id, ...freelancerDoc.data() } : null;
          
          details[invitation.id] = {
            project: projectData,
            freelancer: freelancerData
          };
        } catch (error) {
          console.error(`Error fetching details for invitation ${invitation.id}:`, error);
          details[invitation.id] = {
            project: null,
            freelancer: null
          };
        }
      }
      setInvitationDetails(details);
    } catch (error) {
      console.error('Error fetching invited projects:', error);
      setInvitedProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectInvitation = async (invitation) => {
    // Show native browser confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to reject this invitation?\n\n` +
      `Project: ${invitationDetails[invitation.id]?.project?.title || 'Unknown Project'}\n` +
      `This action cannot be undone and you will not be able to access the project.`
    );
    
    if (confirmed) {
      try {
        const result = await invitationService.rejectInvitation(invitation.token);
        if (result.success) {
          await fetchInvitedProjects();
          alert('Invitation rejected successfully');
        } else {
          alert('Failed to reject invitation: ' + result.error);
        }
      } catch (error) {
        console.error('Error rejecting invitation:', error);
        alert('Error rejecting invitation: ' + error.message);
      }
    }
  };


  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => navigate('/client-dashboard')}
              className="mr-4 p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Project Invitations</h1>
          </div>
          <p className="text-gray-600">
            You have {invitedProjects.length} pending invitation{invitedProjects.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Invitations List */}
        {invitedProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pending invitations</h3>
            <p className="text-gray-500">You don't have any pending project invitations at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitedProjects.map((invitation) => {
              const details = invitationDetails[invitation.id];
              const project = details?.project;
              const freelancer = details?.freelancer;

              return (
                <div key={invitation.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {project?.title || 'Project Invitation'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Invited by <span className="font-medium text-blue-600">
                              {freelancer?.username || freelancer?.email || 'Unknown Freelancer'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center text-sm text-gray-500 mb-1">
                          <Clock className="w-4 h-4 mr-1" />
                          Expires: {invitation.expiresAt?.toDate ?
                            new Date(invitation.expiresAt.toDate()).toLocaleDateString() :
                            'Unknown'
                          }
                        </div>
                        <div className="text-xs text-gray-400">
                          {invitation.expiresAt?.toDate ?
                            Math.ceil((invitation.expiresAt.toDate() - new Date()) / (1000 * 60 * 60 * 24)) + ' days left' :
                            ''
                          }
                        </div>
                      </div>
                    </div>

                    {/* Project Details Row */}
                    {project && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center text-sm">
                          <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                          <span className="text-gray-600">Rate:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            RM{project.hourlyRate || 'N/A'}/hour
                          </span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                          <span className="text-gray-600">Priority:</span>
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(project.priority)}`}>
                            {project.priority || 'Medium'}
                          </span>
                        </div>
                        <div className="flex items-center text-sm">
                          <TrendingUp className="w-4 h-4 text-purple-600 mr-2" />
                          <span className="text-gray-600">Status:</span>
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                            {project.status || 'Pending'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {project.description && (
                            <p className="truncate">{project.description}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      <a
                        href={`/invite/${invitation.token}`}
                        className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center flex items-center justify-center"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Accept Invitation
                      </a>
                      <button
                        onClick={() => handleRejectInvitation(invitation)}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};

export default ClientInvitations;
