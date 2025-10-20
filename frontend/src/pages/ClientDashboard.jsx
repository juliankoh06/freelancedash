import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, orderBy, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import apiService from '../services/api';
import ClientApprovalView from '../components/ClientApprovalView';
import { 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  MessageCircle, 
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Eye,
  Send,
  ArrowLeft,
  X
} from 'lucide-react';

const ClientDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [freelancerUsernames, setFreelancerUsernames] = useState({});
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [newComment, setNewComment] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);

  useEffect(() => {
    if (!user || user.role !== 'client') {
      navigate('/login');
      return;
    }
    fetchClientProjects();
    fetchPendingApprovals();
    fetchPendingInvitations();
  }, []);

  const fetchFreelancerUsername = async (freelancerId) => {
    try {
      if (!freelancerId) return 'Unknown';
      
      const userDoc = await getDoc(doc(db, 'users', freelancerId));
      if (userDoc.exists()) {
        return userDoc.data().username || 'Unknown';
      }
      return 'Unknown';
    } catch (error) {
      console.error('Error fetching freelancer username:', error);
      return 'Unknown';
    }
  };

  const fetchClientProjects = async () => {
    try {
      if (!user || !user.email) {
        setProjects([]);
        return;
      }

      // Set authentication token
      if (user.accessToken) {
        apiService.setToken(user.accessToken);
      }

      // Fetch projects by client email from API
      const response = await apiService.getProjectsByClientEmail(user.email);
      const allProjects = response.data || [];
      
      // Filter out completed and pending_approval projects (they go to Pending Approvals)
      const activeProjects = allProjects.filter(project => 
        project.status !== 'completed' && project.status !== 'pending_approval'
      );
      
      setProjects(activeProjects);

      // Fetch freelancer usernames for all projects
      const freelancerIds = [...new Set(activeProjects.map(project => project.freelancerId).filter(Boolean))];
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
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      // This would need to be implemented in the backend API
      // For now, we'll keep the direct Firestore access for completion requests
      // as this is a specific business logic that might not need API abstraction
      const q = query(
        collection(db, 'completion_requests'),
        where('clientEmail', '==', user?.email),
        where('status', '==', 'pending_approval')
      );
      const snapshot = await getDocs(q);
      const approvals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingApprovals(approvals);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      setPendingApprovals([]);
    }
  };

  const fetchPendingInvitations = async () => {
    try {
      if (!user?.email) {
        setPendingInvitations([]);
        return;
      }

      // Fetch projects that are pending approval for this client
      const q = query(
        collection(db, 'projects'),
        where('clientEmail', '==', user.email),
        where('status', '==', 'pending_approval')
      );
      const snapshot = await getDocs(q);
      const invitations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingInvitations(invitations);

      // Fetch freelancer usernames for pending invitations
      const freelancerIds = [...new Set(invitations.map(invitation => invitation.freelancerId).filter(Boolean))];
      const usernamePromises = freelancerIds.map(async (freelancerId) => {
        const username = await fetchFreelancerUsername(freelancerId);
        return { freelancerId, username };
      });
      
      const usernameResults = await Promise.all(usernamePromises);
      const usernameMap = {};
      usernameResults.forEach(({ freelancerId, username }) => {
        usernameMap[freelancerId] = username;
      });
      
      // Update freelancer usernames state
      setFreelancerUsernames(prev => ({ ...prev, ...usernameMap }));
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
      setPendingInvitations([]);
    }
  };

  const acceptProjectInvitation = async (projectId) => {
    try {
      // Update project status from pending_approval to active
      await updateDoc(doc(db, 'projects', projectId), {
        status: 'active',
        clientId: user.uid,
        updatedAt: new Date()
      });

      // Refresh data
      await fetchClientProjects();
      await fetchPendingInvitations();
      
      alert('✅ Project invitation accepted! The project is now active.');
    } catch (error) {
      console.error('Error accepting project invitation:', error);
      alert('Failed to accept project invitation. Please try again.');
    }
  };

  const rejectProjectInvitation = async (projectId) => {
    try {
      const confirmed = window.confirm('Are you sure you want to reject this project invitation? This action cannot be undone.');
      if (!confirmed) return;

      // Update project status to rejected
      await updateDoc(doc(db, 'projects', projectId), {
        status: 'rejected',
        clientId: user.uid,
        updatedAt: new Date()
      });

      // Refresh data
      await fetchPendingInvitations();
      
      alert('Project invitation rejected.');
    } catch (error) {
      console.error('Error rejecting project invitation:', error);
      alert('Failed to reject project invitation. Please try again.');
    }
  };




  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleViewProgress = async (project) => {
    setSelectedProject(project);
    setLoadingDetails(true);
    
    try {
      // Fetch detailed project data
      await fetchProjectDetails(project.id);
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };


  const fetchProjectDetails = async (projectId) => {
    try {
      // Fetch project tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTasks(tasksData);

      // Fetch progress updates
      const progressQuery = query(
        collection(db, 'progress_updates'),
        where('projectId', '==', projectId),
        orderBy('updatedAt', 'desc')
      );
      const progressSnapshot = await getDocs(progressQuery);
      const progressData = progressSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProgressUpdates(progressData);

      // Calculate time entries from tasks
      const timeEntriesData = tasksData
        .filter(task => task.timeSpent > 0)
        .map(task => ({
          id: task.id,
          taskTitle: task.title,
          hours: task.timeSpent,
          date: task.updatedAt?.toDate() || new Date(),
          status: task.status
        }));
      setTimeEntries(timeEntriesData);

    } catch (error) {
      console.error('Error fetching project details:', error);
    }
  };

  const calculateProjectStats = () => {
    if (!selectedProject) return {};
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
    const totalHours = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
    const estimatedHours = tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
    const currentCost = totalHours * (selectedProject.hourlyRate || 0);
    const estimatedCost = estimatedHours * (selectedProject.hourlyRate || 0);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      totalHours,
      estimatedHours,
      currentCost,
      estimatedCost,
      completionPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !selectedProject) return;

    try {
      const commentData = {
        projectId: selectedProject.id,
        clientId: selectedProject.clientId,
        clientEmail: selectedProject.clientEmail,
        comment: newComment.trim(),
        type: 'client_feedback',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'project_comments'), commentData);
      setNewComment('');
      alert('Comment sent successfully!');
    } catch (error) {
      console.error('Error sending comment:', error);
      alert('Failed to send comment. Please try again.');
    }
  };

  const handleViewApproval = (approval) => {
    setSelectedApproval(approval);
  };

  const handleBackFromApproval = () => {
    setSelectedApproval(null);
  };

  const stats = calculateProjectStats();

  return (
    <div className="p-6">
      {selectedApproval ? (
        // Show approval details when an approval is selected
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={handleBackFromApproval}
                className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Project Approval</h1>
                <p className="text-gray-600">Review and approve project completion</p>
              </div>
            </div>
          </div>
          <ClientApprovalView
            projectId={selectedApproval.projectId}
            user={user}
            onApprovalUpdate={() => {
              fetchPendingApprovals();
              fetchClientProjects();
              setSelectedApproval(null);
            }}
          />
        </div>
      ) : !selectedProject ? (
        // Show project list when no project is selected
        <>
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">My Projects</h1>
                <p className="text-gray-600">Track the progress of your projects</p>
              </div>
              <button
                onClick={() => navigate('/client-invitations')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium"
              >
                View Invitations
              </button>
            </div>
          </div>

          {/* Pending Invitations Section */}
          {pendingInvitations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Project Invitations</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-700 mb-4">
                  You have {pendingInvitations.length} project invitation{pendingInvitations.length > 1 ? 's' : ''} waiting for your approval. 
                  Accept these invitations to start collaborating on the projects.
                </p>
                <div className="space-y-4">
                  {pendingInvitations.map((project) => (
                    <div key={project.id} className="bg-white border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{project.title}</h3>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Freelancer:</span> {freelancerUsernames[project.freelancerId] || 'Unknown'}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Rate:</span> RM{project.hourlyRate}/hour
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Duration:</span> {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'} - {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'N/A'}
                            </p>
                            {project.description && (
                              <p className="text-sm text-gray-600 mt-2">{project.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 ml-4">
                          <button
                            onClick={() => rejectProjectInvitation(project.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => acceptProjectInvitation(project.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pending Approvals Section */}
          {pendingApprovals.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Approvals</h2>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Freelancer</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested Date</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendingApprovals.map((approval) => (
                        <tr key={approval.id} className="hover:bg-gray-50">
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {approval.freelancerName || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{approval.projectTitle}</div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-20 bg-gray-200 rounded-full h-2.5 mr-3">
                                <div 
                                  className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                                  style={{ width: `${approval.completionPercentage || 0}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-900 min-w-[3rem]">
                                {approval.completedTasks}/{approval.totalTasks} tasks
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {approval.completionPercentage || 0}% complete
                            </div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              RM{((approval.totalAmount || 0) * 1.06).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {approval.totalHours?.toFixed(2)}h × RM{approval.hourlyRate}/h
                            </div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-900">
                            {approval.requestedAt?.toDate ? 
                              new Date(approval.requestedAt.toDate()).toLocaleDateString() : 
                              'N/A'
                            }
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleViewApproval(approval)}
                              className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors duration-200 font-medium"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Projects Section */}
          {Array.isArray(projects) && projects.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Projects</h2>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Freelancer</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Array.isArray(projects) && projects.map(project => (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {freelancerUsernames[project.freelancerId] || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{project.title}</div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                              {project.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-md ${getPriorityColor(project.priority)}`}>
                              {project.priority || 'Medium'}
                            </span>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-900">
                            {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-900">
                            {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-900">
                            {project.hourlyRate ? `RM${project.hourlyRate}/hr` : 'N/A'}
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-20 bg-gray-200 rounded-full h-2.5 mr-3">
                                <div 
                                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                  style={{ width: `${project.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-900 min-w-[3rem]">{project.progress || 0}%</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleViewProgress(project)}
                              className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors duration-200 font-medium"
                            >
                              View Progress
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        // Show project progress details when a project is selected
        <div className="space-y-6">
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setSelectedProject(null)}
                className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{selectedProject.title}</h1>
                <p className="text-gray-600">Project Progress & Updates</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Freelancer: {freelancerUsernames[selectedProject.freelancerId] || 'Unknown'}</span>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">{stats.completionPercentage || 0}%</span>
              </div>
            </div>
          </div>

          {loadingDetails ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading project details...</p>
            </div>
          ) : (
            <>
              {/* Progress Overview */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Project Overview</h3>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">{stats.completionPercentage || 0}%</span>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${stats.completionPercentage || 0}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalTasks || 0}</div>
                    <div className="text-sm text-gray-600">Total Tasks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.completedTasks || 0}</div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{(stats.totalHours || 0).toFixed(1)}h</div>
                    <div className="text-sm text-gray-600">Hours Worked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">${(stats.currentCost || 0).toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Current Cost</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'overview', name: 'Overview', icon: Eye },
                    { id: 'tasks', name: 'Tasks', icon: CheckCircle },
                    { id: 'updates', name: 'Progress Updates', icon: MessageCircle },
                    { id: 'billing', name: 'Billing', icon: DollarSign }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {tab.name}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Project Timeline */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold mb-3 flex items-center">
                          <Calendar className="w-5 h-5 mr-2" />
                          Project Timeline
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Start Date:</span>
                            <span className="text-sm font-medium">
                              {selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Due Date:</span>
                            <span className="text-sm font-medium">
                              {selectedProject.dueDate ? new Date(selectedProject.dueDate).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Priority:</span>
                            <span className={`text-sm font-medium px-2 py-1 rounded ${
                              selectedProject.priority === 'high' ? 'bg-red-100 text-red-800' :
                              selectedProject.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {selectedProject.priority || 'Medium'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold mb-3 flex items-center">
                          <DollarSign className="w-5 h-5 mr-2" />
                          Financial Summary
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Hourly Rate:</span>
                            <span className="text-sm font-medium">${selectedProject.hourlyRate || 0}/hr</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Hours Worked:</span>
                            <span className="text-sm font-medium">{(stats.totalHours || 0).toFixed(1)}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Estimated Hours:</span>
                            <span className="text-sm font-medium">{(stats.estimatedHours || 0).toFixed(1)}h</span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="text-sm font-semibold">Current Cost:</span>
                            <span className="text-sm font-bold text-green-600">${(stats.currentCost || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Project Tasks</h3>
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">{task.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              task.status === 'completed' ? 'bg-green-100 text-green-800' :
                              task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {task.status || 'Pending'}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                          )}
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>Progress: {task.progress || 0}%</span>
                            <span>Hours: {task.timeSpent || 0}h / {task.estimatedHours || 0}h</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${task.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {activeTab === 'updates' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Progress Updates</h3>
                    <div className="space-y-4">
                      {progressUpdates.map((update) => (
                        <div key={update.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">{update.taskTitle}</h4>
                            <span className="text-sm text-gray-500">
                              {update.updatedAt?.toDate().toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>Progress: {update.oldProgress}% → {update.newProgress}%</span>
                            <span className="text-green-600">+{update.progressChange}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {activeTab === 'billing' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Billing Information</h3>
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium mb-3">Current Billing</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Hours Worked:</span>
                              <span className="font-medium">{(stats.totalHours || 0).toFixed(1)}h</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Hourly Rate:</span>
                              <span className="font-medium">${selectedProject.hourlyRate || 0}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                              <span className="font-semibold">Current Total:</span>
                              <span className="font-bold text-lg">${(stats.currentCost || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-3">Project Estimates</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Estimated Hours:</span>
                              <span className="font-medium">{(stats.estimatedHours || 0).toFixed(1)}h</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Estimated Total:</span>
                              <span className="font-medium">${(stats.estimatedCost || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Remaining Hours:</span>
                              <span className="font-medium">{((stats.estimatedHours || 0) - (stats.totalHours || 0)).toFixed(1)}h</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Client Feedback Section */}
              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Send Feedback</h3>
                <div className="flex space-x-4">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Ask a question or provide feedback..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={!newComment.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
};

export default ClientDashboard;