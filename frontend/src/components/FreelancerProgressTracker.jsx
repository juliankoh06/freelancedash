import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase-config';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  MessageCircle, 
  Upload,
  Calendar,
  DollarSign,
  TrendingUp,
  Plus,
  Edit,
  Save,
  X
} from 'lucide-react';

const FreelancerProgressTracker = ({ project, onClose }) => {
  const [projectDetails, setProjectDetails] = useState(project);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('tasks');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    estimatedHours: '',
    priority: 'medium'
  });
  const [progressForm, setProgressForm] = useState({
    progress: '',
    notes: '',
    files: []
  });

  useEffect(() => {
    if (project?.id) {
      fetchProjectData();
    }
  }, [project?.id]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      
      // Fetch project tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', project.id),
        orderBy('createdAt', 'desc')
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTasks(tasksData);

    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const taskData = {
        ...taskForm,
        projectId: project.id,
        freelancerId: project.freelancerId,
        estimatedHours: parseFloat(taskForm.estimatedHours),
        timeSpent: 0,
        progress: 0,
        status: 'pending',
        priority: taskForm.priority,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'tasks'), taskData);
      
      // Reset form
      setTaskForm({
        title: '',
        description: '',
        estimatedHours: '',
        priority: 'medium'
      });
      setShowTaskForm(false);
      
      // Refresh tasks
      await fetchProjectData();
      
      alert('Task created successfully!');
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please try again.');
    }
  };

  const handleUpdateTask = async (taskId, updateData) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        ...updateData,
        updatedAt: new Date()
      });
      
      // Refresh tasks
      await fetchProjectData();
      
      alert('Task updated successfully!');
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    }
  };

  const handleLogProgress = async (e) => {
    e.preventDefault();
    try {
      if (!selectedTask) return;

      const progressData = {
        taskId: selectedTask.id,
        projectId: project.id,
        freelancerId: project.freelancerId,
        oldProgress: selectedTask.progress || 0,
        newProgress: parseInt(progressForm.progress),
        progressChange: parseInt(progressForm.progress) - (selectedTask.progress || 0),
        notes: progressForm.notes,
        updatedAt: new Date()
      };

      // Update task progress
      await updateDoc(doc(db, 'tasks', selectedTask.id), {
        progress: parseInt(progressForm.progress),
        status: parseInt(progressForm.progress) >= 100 ? 'completed' : 'in-progress',
        updatedAt: new Date()
      });

      // Create progress update record
      await addDoc(collection(db, 'progress_updates'), progressData);

      // Update project progress
      await updateProjectProgress();

      // Reset form
      setProgressForm({ progress: '', notes: '', files: [] });
      setShowProgressForm(false);
      setSelectedTask(null);
      
      // Refresh data
      await fetchProjectData();
      
      alert('Progress logged successfully! Client will be notified.');
    } catch (error) {
      console.error('Error logging progress:', error);
      alert('Failed to log progress. Please try again.');
    }
  };

  const updateProjectProgress = async () => {
    try {
      // Calculate overall project progress
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(task => task.status === 'completed').length;
      const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Update project
      await updateDoc(doc(db, 'projects', project.id), {
        progress: overallProgress,
        status: overallProgress >= 100 ? 'completed' : 'active',
        updatedAt: new Date()
      });

      // Update project details
      setProjectDetails(prev => ({
        ...prev,
        progress: overallProgress,
        status: overallProgress >= 100 ? 'completed' : 'active'
      }));
    } catch (error) {
      console.error('Error updating project progress:', error);
    }
  };

  const calculateProjectStats = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
    const totalHours = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
    const estimatedHours = tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      totalHours,
      estimatedHours,
      completionPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  };

  const stats = calculateProjectStats();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-center">Loading project data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{projectDetails.title}</h2>
              <p className="text-gray-600">Progress Tracking & Task Management</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Progress Overview */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Project Progress</h3>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">{stats.completionPercentage}%</span>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
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
                <div className="text-sm text-gray-600">Hours Logged</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.estimatedHours.toFixed(1)}h</div>
                <div className="text-sm text-gray-600">Estimated</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'tasks', name: 'Tasks', icon: CheckCircle },
                { id: 'progress', name: 'Log Progress', icon: TrendingUp },
                { id: 'time', name: 'Time Tracking', icon: Clock },
                { id: 'files', name: 'Files', icon: FileText },
                { id: 'communication', name: 'Client Communication', icon: MessageCircle }
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
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Project Tasks</h3>
                  <button
                    onClick={() => setShowTaskForm(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Task
                  </button>
                </div>

                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{task.title}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {task.status || 'Pending'}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setProgressForm({ progress: task.progress || 0, notes: '', files: [] });
                              setShowProgressForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Log Progress
                          </button>
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                        <span>Estimated: {task.estimatedHours}h</span>
                        <span>Logged: {task.timeSpent || 0}h</span>
                        <span>Progress: {task.progress || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
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

            {activeTab === 'progress' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Log Progress Update</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <form onSubmit={handleLogProgress} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Task
                      </label>
                      <select
                        value={selectedTask?.id || ''}
                        onChange={(e) => {
                          const task = tasks.find(t => t.id === e.target.value);
                          setSelectedTask(task);
                          setProgressForm({ 
                            progress: task?.progress || 0, 
                            notes: '', 
                            files: [] 
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select a task...</option>
                        {tasks.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title} ({task.progress || 0}%)
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedTask && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Progress Percentage
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={progressForm.progress}
                            onChange={(e) => setProgressForm(prev => ({ ...prev, progress: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Progress Notes
                          </label>
                          <textarea
                            value={progressForm.notes}
                            onChange={(e) => setProgressForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Describe what was accomplished..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24"
                          />
                        </div>

                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowProgressForm(false);
                              setSelectedTask(null);
                              setProgressForm({ progress: '', notes: '', files: [] });
                            }}
                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Log Progress
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'time' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Time Tracking</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Time tracking functionality will be implemented here</p>
                    <p className="text-sm">This will integrate with the existing time tracking system</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Project Files</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-center py-8 text-gray-500">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>File upload functionality is now available in Progress Updates</p>
                    <p className="text-sm">Go to the "Progress Updates" tab to attach files to your updates</p>
                    <button
                      onClick={() => setActiveTab('updates')}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Go to Progress Updates
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'communication' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Client Communication</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Communication system will be implemented here</p>
                    <p className="text-sm">Send messages and updates to the client</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Task Creation Modal */}
          {showTaskForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Create New Task</h3>
                  <button
                    onClick={() => setShowTaskForm(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Task Title
                    </label>
                    <input
                      type="text"
                      value={taskForm.title}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estimated Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={taskForm.estimatedHours}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, estimatedHours: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowTaskForm(false)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Task
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreelancerProgressTracker;
