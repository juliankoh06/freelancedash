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
  ArrowLeft,
  FileText,
  Target
} from 'lucide-react';

const ClientInvitations = ({ user }) => {
  const navigate = useNavigate();
  const [invitedProjects, setInvitedProjects] = useState([]);
  const [invitationDetails, setInvitationDetails] = useState({});
  const [acceptedProjects, setAcceptedProjects] = useState([]);
  const [contracts, setContracts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'client') {
      navigate('/login');
      return;
    }
    fetchInvitedProjects();
    fetchAcceptedProjects();
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

  const handleAcceptInvitation = async (invitation) => {
    try {
      console.log('🔵 Accepting invitation:', invitation.token);
      const result = await invitationService.acceptInvitation(invitation.token, user.uid);
      
      if (result.success) {
        alert('✅ Invitation accepted! The contract has been generated and is ready for your signature.');
        await fetchInvitedProjects();
        await fetchAcceptedProjects();
        // Refresh the page to show the contract
        window.location.reload();
      } else {
        alert('Failed to accept invitation: ' + result.error);
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      alert('Error accepting invitation: ' + error.message);
    }
  };

  const fetchAcceptedProjects = async () => {
    try {
      // Fetch accepted invitations (which have contracts)
      const q = query(
        collection(db, 'invitations'),
        where('clientEmail', '==', user.email),
        where('status', '==', 'accepted')
      );
      const snapshot = await getDocs(q);
      const accepted = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAcceptedProjects(accepted);

      // Fetch contracts for accepted projects
      const contractsData = {};
      for (const invitation of accepted) {
        try {
          const contractQuery = query(
            collection(db, 'contracts'),
            where('projectId', '==', invitation.projectId)
          );
          const contractSnapshot = await getDocs(contractQuery);
          if (!contractSnapshot.empty) {
            const contractDoc = contractSnapshot.docs[0];
            contractsData[invitation.projectId] = {
              id: contractDoc.id,
              ...contractDoc.data()
            };
          }
        } catch (error) {
          console.error(`Error fetching contract for project ${invitation.projectId}:`, error);
        }
      }
      setContracts(contractsData);
    } catch (error) {
      console.error('Error fetching accepted projects:', error);
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
                      <button
                        onClick={() => handleAcceptInvitation(invitation)}
                        className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center flex items-center justify-center"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Accept Invitation
                      </button>
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

        {/* Accepted Projects - Contracts Pending Signature */}
        {acceptedProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-green-600" />
              Contracts Ready for Signature
            </h2>
            <div className="space-y-4">
              {acceptedProjects.map((invitation) => {
                const project = invitation.project;
                const contract = contracts[invitation.projectId];
                
                if (!contract) return null; // Skip if contract not loaded yet

                const isClientSigned = contract.clientSignature != null;

                return (
                  <div key={invitation.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">
                          {project?.title || 'Project Contract'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Freelancer: {invitation.freelancerName || 'N/A'}
                        </p>
                      </div>
                      {isClientSigned ? (
                        <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Signed
                        </span>
                      ) : (
                        <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                          Awaiting Signature
                        </span>
                      )}
                    </div>

                    {/* Contract Details */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Contract Overview</h4>
                      <p className="text-sm text-gray-700 mb-3">
                        {contract.scope || 'No scope description provided'}
                      </p>
                      
                      {/* Contract Terms */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div className="flex items-center text-sm">
                          <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                          <span className="text-gray-600">Rate:</span>
                          <span className="ml-2 font-medium">RM{contract.hourlyRate}/hr</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                          <span className="text-gray-600">Duration:</span>
                          <span className="ml-2 font-medium">
                            {contract.startDate && contract.endDate ? (
                              `${new Date(contract.startDate).toLocaleDateString()} - ${new Date(contract.endDate).toLocaleDateString()}`
                            ) : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Clock className="w-4 h-4 text-purple-600 mr-2" />
                          <span className="text-gray-600">Deposit:</span>
                          <span className="ml-2 font-medium">RM{contract.depositAmount || 0}</span>
                        </div>
                      </div>

                      {/* Payment Terms */}
                      {contract.paymentTerms && (
                        <div className="text-sm mb-3">
                          <span className="text-gray-600">Payment Terms: </span>
                          <span className="font-medium">{contract.paymentTerms}</span>
                        </div>
                      )}
                    </div>

                    {/* Milestones */}
                    {contract.milestones && contract.milestones.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                          <Target className="w-4 h-4 mr-2" />
                          Project Milestones ({contract.milestones.length})
                        </h4>
                        <div className="space-y-2">
                          {contract.milestones.map((milestone, index) => (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h5 className="font-medium text-gray-900">{milestone.name}</h5>
                                  {milestone.description && (
                                    <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                                  )}
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    RM{milestone.amount?.toFixed(2) || '0.00'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {milestone.percentage}% of total
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>Due: {milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString() : 'N/A'}</span>
                                <span className="px-2 py-1 bg-gray-100 rounded">
                                  Status: {milestone.status || 'Pending'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Signature Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          {contract.freelancerSignature ? (
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Freelancer signed on {new Date(contract.freelancerSignedAt).toLocaleDateString()}
                            </div>
                          ) : (
                            <span>Freelancer has not signed yet</span>
                          )}
                        </div>
                        
                        {!isClientSigned && (
                          <button
                            onClick={() => window.location.href = `/contracts/${contract.id}/review`}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Review & Sign Contract
                          </button>
                        )}
                      </div>
                      
                      {isClientSigned && (
                        <div className="mt-3 text-sm text-gray-600 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                          You signed this contract on {new Date(contract.clientSignedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ClientInvitations;
