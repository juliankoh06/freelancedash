import apiService from '../services/api';

export const projectsAPI = {
  // Get all projects
  async getAllProjects() {
    try {
      const response = await apiService.getProjects();
      return response.data;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  // Get projects by freelancer
  async getProjectsByFreelancer(freelancerId) {
    try {
      const response = await apiService.getProjectsByFreelancer(freelancerId);
      return response.data;
    } catch (error) {
      console.error('Error fetching freelancer projects:', error);
      throw error;
    }
  },

  // Get projects by client
  async getProjectsByClient(clientId) {
    try {
      const response = await apiService.getProjectsByClient(clientId);
      return response.data;
    } catch (error) {
      console.error('Error fetching client projects:', error);
      throw error;
    }
  },

  // Get projects by client email
  async getProjectsByClientEmail(clientEmail) {
    try {
      const response = await apiService.getProjectsByClientEmail(clientEmail);
      return response.data;
    } catch (error) {
      console.error('Error fetching client projects by email:', error);
      throw error;
    }
  },

  // Create a new project
  async createProject(projectData) {
    try {
      const response = await apiService.createProject(projectData);
      return response.data;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  },

  // Update a project
  async updateProject(projectId, updateData) {
    try {
      const response = await apiService.updateProject(projectId, updateData);
      return response.success;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  },

  // Delete a project
  async deleteProject(projectId) {
    try {
      const response = await apiService.deleteProject(projectId);
      return response.success;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }
};

export const tasksAPI = {
  // Get all tasks
  async getAllTasks() {
    try {
      const response = await apiService.getTasks();
      return response.data;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  },

  // Get tasks by project
  async getTasksByProject(projectId) {
    try {
      const response = await apiService.getTasks(projectId);
      return response.data;
    } catch (error) {
      console.error('Error fetching project tasks:', error);
      throw error;
    }
  },

  // Get tasks by assignee
  async getTasksByAssignee(assignedTo) {
    try {
      const response = await apiService.getTasks();
      return response.data.filter(task => task.assignedTo === assignedTo);
    } catch (error) {
      console.error('Error fetching assignee tasks:', error);
      throw error;
    }
  },

  // Create a new task
  async createTask(projectId, taskData) {
    try {
      const response = await apiService.createTask(projectId, taskData);
      return response.data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  // Update a task
  async updateTask(projectId, taskId, updateData) {
    try {
      const response = await apiService.updateTask(projectId, taskId, updateData);
      return response.success;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Delete a task
  async deleteTask(projectId, taskId) {
    try {
      const response = await apiService.deleteTask(projectId, taskId);
      return response.success;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }
};