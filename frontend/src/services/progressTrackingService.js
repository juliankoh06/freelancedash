// Progress Tracking Service - uses backend API for all operations
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase-config';
import { errorHandling } from '../utils/validation';

class ProgressTrackingService {
  constructor() {
    this.progressListeners = new Map();
    this.notificationQueue = [];
  }

  // Track task progress with server-side validation
  async updateTaskProgress(taskId, progressData, userId) {
    try {
      // Send to backend for server-side validation
      const response = await fetch(`/api/progress/task/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify(progressData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task progress');
      }

      const result = await response.json();
      console.log(`Task progress updated with server validation: ${taskId}`);
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Error updating task progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get authentication token
  async getAuthToken() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    throw new Error('User not authenticated');
  }

  // Update overall project progress
  async updateProjectProgress(projectId) {
    try {
      // Call backend API to update project progress
      const response = await fetch(`/api/progress/project/${projectId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project progress');
      }

      const result = await response.json();
      console.log(`Project progress updated via backend: ${projectId}`);
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Error updating project progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Note: Project completion, notifications, and emails are now handled by the backend
  // These methods have been removed from the frontend to improve security and centralize business logic

  // Get progress history for a project
  async getProjectProgressHistory(projectId) {
    try {
      const progressQuery = query(
        collection(db, 'progress_updates'),
        where('projectId', '==', projectId)
      );
      
      const progressSnapshot = await getDocs(progressQuery);
      const progressHistory = progressSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return {
        success: true,
        data: progressHistory.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      };
    } catch (error) {
      console.error('Error fetching progress history:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'fetching progress history'),
        data: []
      };
    }
  }

  // Subscribe to real-time progress updates
  subscribeToProgressUpdates(projectId, callback) {
    try {
      const progressQuery = query(
        collection(db, 'progress_updates'),
        where('projectId', '==', projectId)
      );

      const unsubscribe = onSnapshot(progressQuery, (snapshot) => {
        const updates = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        callback({
          success: true,
          data: updates,
          changes: snapshot.docChanges()
        });
      }, (error) => {
        console.error('Progress subscription error:', error);
        callback({
          success: false,
          error: errorHandling.handleApiError(error, 'progress updates'),
          data: []
        });
      });

      this.progressListeners.set(projectId, unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up progress subscription:', error);
      callback({
        success: false,
        error: errorHandling.handleApiError(error, 'setting up progress updates'),
        data: []
      });
    }
  }

  // Cleanup progress listeners
  unsubscribeFromProgressUpdates(projectId) {
    const unsubscribe = this.progressListeners.get(projectId);
    if (unsubscribe) {
      unsubscribe();
      this.progressListeners.delete(projectId);
    }
  }

  // Cleanup all listeners
  cleanup() {
    this.progressListeners.forEach((unsubscribe) => unsubscribe());
    this.progressListeners.clear();
  }
}

// Export singleton instance
export default new ProgressTrackingService();
