// Enhanced Project Service with comprehensive error handling and validation
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase-config';
import { projectValidation, errorHandling, dataIntegrity } from '../utils/validation';

class ProjectService {
  constructor() {
    this.listeners = new Map(); // Track real-time listeners
  }

  // Enhanced project creation with validation
  async createProject(projectData, userId) {
    try {
      // Sanitize and validate data
      const sanitizedData = projectValidation.sanitizeProjectData(projectData);
      const validation = projectValidation.validateProjectData(sanitizedData);
      
      if (!validation.isValid) {
        throw new Error(errorHandling.handleValidationErrors(validation.errors));
      }

      // Add metadata
      const projectWithMetadata = {
        ...sanitizedData,
        freelancerId: userId,
        status: 'active',
        progress: 0,
        totalHours: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      // Create project with retry mechanism
      const result = await errorHandling.retryOperation(async () => {
        const docRef = await addDoc(collection(db, 'projects'), projectWithMetadata);
        return { id: docRef.id, ...projectWithMetadata };
      });

      // Log project creation
      console.log('Project created successfully:', result.id);
      
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

  // Enhanced project update with validation
  async updateProject(projectId, updateData, userId) {
    try {
      // Get current project to validate updates
      const currentProject = await this.getProjectById(projectId);
      if (!currentProject.success) {
        throw new Error('Project not found');
      }

      // Check if user has permission to update
      if (currentProject.data.freelancerId !== userId) {
        throw new Error('You do not have permission to update this project');
      }

      // Sanitize and validate update data
      const sanitizedData = projectValidation.sanitizeProjectData(updateData);
      const validation = projectValidation.validateProjectData(sanitizedData, true);
      
      if (!validation.isValid) {
        throw new Error(errorHandling.handleValidationErrors(validation.errors));
      }

      // Prepare update with metadata
      const updateWithMetadata = {
        ...sanitizedData,
        updatedAt: new Date(),
        version: (currentProject.data.version || 1) + 1
      };

      // Update project with retry mechanism
      await errorHandling.retryOperation(async () => {
        await updateDoc(doc(db, 'projects', projectId), updateWithMetadata);
      });

      console.log('Project updated successfully:', projectId);
      
      return {
        success: true,
        data: { id: projectId, ...updateWithMetadata }
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

  // Enhanced project deletion with cleanup
  async deleteProject(projectId, userId) {
    try {
      // Get current project to validate deletion
      const currentProject = await this.getProjectById(projectId);
      if (!currentProject.success) {
        throw new Error('Project not found');
      }

      // Check if user has permission to delete
      if (currentProject.data.freelancerId !== userId) {
        throw new Error('You do not have permission to delete this project');
      }

      // Delete associated tasks first
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      const taskDeletionPromises = tasksSnapshot.docs.map(taskDoc => 
        deleteDoc(doc(db, 'tasks', taskDoc.id))
      );
      
      await Promise.all(taskDeletionPromises);

      // Delete project
      await errorHandling.retryOperation(async () => {
        await deleteDoc(doc(db, 'projects', projectId));
      });

      console.log('Project and associated tasks deleted successfully:', projectId);
      
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
