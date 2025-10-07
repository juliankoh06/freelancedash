import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { 
  Clock, 
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
  ArrowLeft
} from 'lucide-react';

const ProjectProgress = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [freelancerName, setFreelancerName] = useState('Unknown');

  useEffect(() => {
    console.log('🔍 ProjectProgress useEffect triggered');
    console.log('🔍 projectId from params:', projectId);
    console.log('🔍 navigate function:', navigate);
    
    if (projectId) {
      console.log('🔍 Starting to fetch project data for ID:', projectId);
      fetchProjectData();
    } else {
      console.log('❌ No projectId found, redirecting to dashboard');
      navigate('/client-dashboard');
    }
  }, [projectId, navigate]);

  const fetchProjectData = async () => {
    try {
      console.log('🔍 fetchProjectData started for projectId:', projectId);
      setLoading(true);
      
      // Fetch project data
      console.log('🔍 Querying projects collection for ID:', projectId);
      const projectQuery = query(
        collection(db, 'projects'),
        where('__name__', '==', projectId)
      );
      const projectSnapshot = await getDocs(projectQuery);
      
      console.log('🔍 Project query result:', {
        empty: projectSnapshot.empty,
        size: projectSnapshot.size,
        docs: projectSnapshot.docs.length
      });
      
      if (projectSnapshot.empty) {
        console.log('❌ No project found with ID:', projectId);
        console.log('❌ Redirecting to client dashboard');
        navigate('/client-dashboard');
        return;
      }

      const projectData = { id: projectId, ...projectSnapshot.docs[0].data() };
      console.log('✅ Project data found:', projectData);
      setProject(projectData);

      // Fetch freelancer name
      if (projectData.freelancerId) {
        const freelancerQuery = query(
          collection(db, 'users'),
          where('__name__', '==', projectData.freelancerId)
        );
        const freelancerSnapshot = await getDocs(freelancerQuery);
        if (!freelancerSnapshot.empty) {
          setFreelancerName(freelancerSnapshot.docs[0].data().username || 'Unknown');
        }
      }
      
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
      console.error('❌ Error fetching project data:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      console.log('❌ Redirecting to client dashboard due to error');
      navigate('/client-dashboard');
    } finally {
      console.log('🔍 fetchProjectData completed, setting loading to false');
      setLoading(false);
    }
  };

  const calculateProjectStats = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
    const totalHours = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
    const estimatedHours = tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
    const currentCost = totalHours * (project?.hourlyRate || 0);
    const estimatedCost = estimatedHours * (project?.hourlyRate || 0);

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
    if (!newComment.trim()) return;

    try {
      // Create a client comment/feedback
      const commentData = {
        projectId: projectId,
        clientId: project?.clientId,
        clientEmail: project?.clientEmail,
        comment: newComment.trim(),
        type: 'client_feedback',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'project_comments'), commentData);
      setNewComment('');
      
      // Show success message
      alert('Comment sent successfully!');
    } catch (error) {
      console.error('Error sending comment:', error);
      alert('Failed to send comment. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project Not Found</h2>
          <p className="text-gray-600 mb-4">The project you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/client-dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const stats = calculateProjectStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/client-dashboard')}
                className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
                <p className="text-gray-600">Project Progress & Updates</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Freelancer: {freelancerName}</span>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">{stats.completionPercentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Overview */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Project Overview</h3>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{stats.completionPercentage}%</span>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${stats.completionPercentage}%` }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalTasks}</div>
              <div className="text-sm text-gray-600">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.totalHours.toFixed(1)}h</div>
              <div className="text-sm text-gray-600">Hours Worked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">${stats.currentCost.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Current Cost</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: Eye },
              { id: 'tasks', name: 'Tasks', icon: CheckCircle },
              { id: 'time', name: 'Time Tracking', icon: Clock },
              { id: 'updates', name: 'Progress Updates', icon: MessageCircle },
              { id: 'files', name: 'Files', icon: FileText },
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
                        {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Due Date:</span>
                      <span className="text-sm font-medium">
                        {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Priority:</span>
                      <span className={`text-sm font-medium px-2 py-1 rounded ${
                        project.priority === 'high' ? 'bg-red-100 text-red-800' :
                        project.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {project.priority || 'Medium'}
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
                      <span className="text-sm font-medium">${project.hourlyRate || 0}/hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Hours Worked:</span>
                      <span className="text-sm font-medium">{stats.totalHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Estimated Hours:</span>
                      <span className="text-sm font-medium">{stats.estimatedHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm font-semibold">Current Cost:</span>
                      <span className="text-sm font-bold text-green-600">${stats.currentCost.toFixed(2)}</span>
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

          {activeTab === 'time' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Time Tracking</h3>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {timeEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {entry.taskTitle}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {entry.hours.toFixed(1)}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {entry.date.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.status === 'completed' ? 'bg-green-100 text-green-800' :
                            entry.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

          {activeTab === 'files' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Project Files</h3>
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No files uploaded yet</p>
                <p className="text-sm">Files will appear here when the freelancer uploads them</p>
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
                        <span className="font-medium">{stats.totalHours.toFixed(1)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Hourly Rate:</span>
                        <span className="font-medium">${project.hourlyRate || 0}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Current Total:</span>
                        <span className="font-bold text-lg">${stats.currentCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Project Estimates</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Estimated Hours:</span>
                        <span className="font-medium">{stats.estimatedHours.toFixed(1)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Estimated Total:</span>
                        <span className="font-medium">${stats.estimatedCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Remaining Hours:</span>
                        <span className="font-medium">{(stats.estimatedHours - stats.totalHours).toFixed(1)}h</span>
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
      </div>
    </div>
  );
};

export default ProjectProgress;
