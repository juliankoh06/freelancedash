import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Play, 
  Pause, 
  Square,
  Check
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import AddTaskModal from '../components/AddTaskModal';
import EditTaskModal from '../components/EditTaskModal';

const ProjectTracking = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('time-tracking');
  const [billableHours, setBillableHours] = useState(true);
  const [loading, setLoading] = useState(false);
  const [trackingStates, setTrackingStates] = useState({});
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [allProjects, setAllProjects] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, []);


  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm]);

  const fetchProjects = async () => {
    try {
      const [projectsSnapshot, tasksSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'projects'))),
        getDocs(query(collection(db, 'tasks')))
      ]);
      
      // Process projects
      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        tasks: []
      }));
      
      // Process tasks and group them by projectId
      const tasksByProject = {};
      tasksSnapshot.docs.forEach(taskDoc => {
        const task = { id: taskDoc.id, ...taskDoc.data() };
        const projectId = task.projectId;
        
        if (!tasksByProject[projectId]) {
          tasksByProject[projectId] = [];
        }
        tasksByProject[projectId].push(task);
      });
      
      // Assign tasks to their respective projects
      projectsData.forEach(project => {
        project.tasks = tasksByProject[project.id] || [];
      });
      
      // Also create standalone tasks (tasks without projects)
      const standaloneTasks = tasksByProject[''] || tasksByProject[null] || [];
      if (standaloneTasks.length > 0) {
        projectsData.push({
          id: 'standalone',
          title: 'Unassigned Tasks',
          clientName: 'General',
          tasks: standaloneTasks
        });
      }
      
      setProjects(projectsData);
      setAllProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
      setAllProjects([]);
    }
  };

  const filterProjects = () => {
    if (!searchTerm) {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(project =>
        project.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.tasks?.some(task => 
          task.title?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      setFilteredProjects(filtered);
    }
  };

  const toggleTracking = async (taskId) => {
    const currentState = trackingStates[taskId];
    const newState = currentState === 'running' ? 'paused' : 'running';
    
    setTrackingStates(prev => ({
      ...prev,
      [taskId]: newState
    }));

    // Update task status in database
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newState === 'running' ? 'in-progress' : 'paused',
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const finishTask = async (taskId) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      });
      
      // Refresh projects
      fetchProjects();
    } catch (error) {
      console.error('Error finishing task:', error);
    }
  };

  const handleAddTask = async (taskData) => {
    try {
      // Validate required fields
      if (!taskData.title || !taskData.estimatedHours || !taskData.hourlyRate) {
        alert('Please fill in all required fields (Title, Estimated Hours, Hourly Rate)');
        return;
      }
      
      const taskRef = await addDoc(collection(db, 'tasks'), {
        ...taskData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      setShowAddTaskModal(false);
      await fetchProjects();
    } catch (error) {
      console.error('Error adding task:', error);
      alert(`Failed to save task: ${error.message}`);
    }
  };


  const handleEditTask = async (taskId, taskData) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        ...taskData,
        updatedAt: new Date()
      });
      
      setShowEditTaskModal(false);
      setSelectedTask(null);
      fetchProjects(); // Refresh the projects list
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleEditTaskClick = (task) => {
    setSelectedTask(task);
    setShowEditTaskModal(true);
  };

  const formatCurrency = (amount, currency = 'RM') => {
    return `${currency}${amount}`;
  };

  const getTrackingIcon = (taskId) => {
    const state = trackingStates[taskId];
    if (state === 'running') {
      return <Pause className="w-4 h-4" />;
    }
    return <Play className="w-4 h-4" />;
  };

  const getTrackingButtonClass = (taskId) => {
    const state = trackingStates[taskId];
    return state === 'running' 
      ? 'bg-orange-500 hover:bg-orange-600 text-white' 
      : 'bg-green-500 hover:bg-green-600 text-white';
  };



  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('time-tracking')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'time-tracking'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Filter className="w-4 h-4 mr-2" />
          Time Tracking
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'projects'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Filter className="w-4 h-4 mr-2" />
          Projects
        </button>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Projects"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowAddTaskModal(true)}
            className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Tasks
          </button>
          <button 
            onClick={() => {
              if (filteredProjects.length > 0 && filteredProjects[0].tasks?.length > 0) {
                handleEditTaskClick(filteredProjects[0].tasks[0]);
              }
            }}
            className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Tasks
          </button>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={billableHours}
              onChange={(e) => setBillableHours(e.target.checked)}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">Billable Hours</span>
          </label>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name/Business
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hourly Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contracted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start/Pause
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Finish
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjects.length === 0 ? (
                // Show one empty row with a call-to-action to add a task when there are no projects
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="space-y-3">
                      <p className="text-gray-500">No projects yet. You can still add tasks and assign them to a project later.</p>
                      <button
                        onClick={() => setShowAddTaskModal(true)}
                        className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                      >
                        Add Your First Task
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  (project.tasks && project.tasks.length > 0 ? project.tasks : [{}]).map((task, taskIndex) => (
                    <tr key={`${project.id}-${task.id || 'new'}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {project.clientName || 'Client Name'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {project.clientType || 'Business Type'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.title || 'Project Title'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {task.title || (
                          <button
                            onClick={() => setShowAddTaskModal(true)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Add a task
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(task.hourlyRate || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {task.actualHours || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {task.estimatedHours || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleTracking(task.id)}
                          className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${getTrackingButtonClass(task.id)}`}
                        >
                          {getTrackingIcon(task.id)}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditTaskClick(task)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => finishTask(task.id)}
                            className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition-colors"
                          >
                            Finish
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onSave={handleAddTask}
        projects={allProjects}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        isOpen={showEditTaskModal}
        onClose={() => {
          setShowEditTaskModal(false);
          setSelectedTask(null);
        }}
        onSave={handleEditTask}
        task={selectedTask}
        projects={allProjects}
      />
    </div>
  );
};

export default ProjectTracking;
