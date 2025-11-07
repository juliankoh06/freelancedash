// Project Service - uses backend API for data operations, Firestore for real-time subscriptions
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase-config';
import { projectValidation, errorHandling } from '../utils/validation';

class ProjectService {
  constructor() {
    this.listeners = new Map(); // Track real-time listeners
  }

  // Get auth token for API calls
  async getAuthToken() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    throw new Error('User not authenticated');
  }

  // Enhanced project creation - calls backend API
  async createProject(projectData, userId) {
    try {
      // Client-side validation
      const sanitizedData = projectValidation.sanitizeProjectData(projectData);
      const validation = projectValidation.validateProjectData(sanitizedData);
      
      if (!validation.isValid) {
        throw new Error(errorHandling.handleValidationErrors(validation.errors));
      }

      // Call backend API
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          ...sanitizedData,
          freelancerId: userId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create project');
      }

      const result = await response.json();
      console.log('Project created successfully via backend:', result.id);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error creating project:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'creating project')
      };
    }
  }

  // Enhanced project update - calls backend API
  async updateProject(projectId, updateData, userId) {
    try {
      // Client-side validation
      const sanitizedData = projectValidation.sanitizeProjectData(updateData);
      const validation = projectValidation.validateProjectData(sanitizedData, true);
      
      if (!validation.isValid) {
        throw new Error(errorHandling.handleValidationErrors(validation.errors));
      }

      // Call backend API
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify(sanitizedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project');
      }

      const result = await response.json();
      console.log('Project updated successfully via backend:', projectId);
      
      return {
        success: true,
        data: { id: projectId, ...sanitizedData }
      };
    } catch (error) {
      console.error('Error updating project:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'updating project')
      };
    }
  }

  // Get project by ID with error handling
  async getProjectById(projectId) {
    try {
      const projectDoc = await getDocs(query(collection(db, 'projects'), where('__name__', '==', projectId)));
      
      if (projectDoc.empty) {
        return {
          success: false,
          error: 'Project not found'
        };
      }

      const projectData = projectDoc.docs[0].data();
      return {
        success: true,
        data: { id: projectId, ...projectData }
      };
    } catch (error) {
      console.error('Error fetching project:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'fetching project')
      };
    }
  }

  // Get projects by freelancer with enhanced error handling
  async getProjectsByFreelancer(freelancerId) {
    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('freelancerId', '==', freelancerId)
      );
      
      const projectsSnapshot = await getDocs(projectsQuery);
      const projects = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Validate data consistency
      const consistencyCheck = await dataIntegrity.validateProjectConsistency();
      if (!consistencyCheck.isValid) {
        console.warn('Data consistency issues detected:', consistencyCheck.issues);
      }

      return {
        success: true,
        data: projects
      };
    } catch (error) {
      console.error('Error fetching freelancer projects:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'fetching projects'),
        data: []
      };
    }
  }

  // Get projects by client email
  async getProjectsByClientEmail(clientEmail) {
    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('clientEmail', '==', clientEmail)
      );
      
      const projectsSnapshot = await getDocs(projectsQuery);
      const projects = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        success: true,
        data: projects
      };
    } catch (error) {
      console.error('Error fetching client projects:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'fetching client projects'),
        data: []
      };
    }
  }

  // Real-time project updates
  subscribeToProjects(freelancerId, callback) {
    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('freelancerId', '==', freelancerId)
      );

      const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
        const projects = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        callback({
          success: true,
          data: projects,
          changes: snapshot.docChanges()
        });
      }, (error) => {
        console.error('Real-time subscription error:', error);
        callback({
          success: false,
          error: errorHandling.handleApiError(error, 'real-time updates'),
          data: []
        });
      });

      // Store listener for cleanup
      this.listeners.set(freelancerId, unsubscribe);
      
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
      callback({
        success: false,
        error: errorHandling.handleApiError(error, 'setting up real-time updates'),
        data: []
      });
    }
  }

  // Cleanup real-time listeners
  unsubscribeFromProjects(freelancerId) {
    const unsubscribe = this.listeners.get(freelancerId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(freelancerId);
    }
  }

  // Enhanced project deletion - calls backend API
  async deleteProject(projectId, userId) {
    try {
      // Call backend API to delete project and associated data
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project');
      }

      const result = await response.json();
      console.log('Project deleted successfully via backend:', projectId);
      
      return {
        success: true,
        message: 'Project deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting project:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'deleting project')
      };
    }
  }

  // Get project statistics
  async getProjectStats(freelancerId) {
    try {
      const projectsResult = await this.getProjectsByFreelancer(freelancerId);
      if (!projectsResult.success) {
        return projectsResult;
      }

      const projects = projectsResult.data;
      const stats = {
        total: projects.length,
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        pending: projects.filter(p => p.status === 'pending').length,
        totalHours: projects.reduce((sum, p) => sum + (p.totalHours || 0), 0),
        totalEarnings: projects.reduce((sum, p) => sum + ((p.totalHours || 0) * (p.hourlyRate || 0)), 0)
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error calculating project stats:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'calculating stats'),
        data: {}
      };
    }
  }

  // Cleanup all listeners
  cleanup() {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
  }
}

// Export singleton instance
export default new ProjectService();
