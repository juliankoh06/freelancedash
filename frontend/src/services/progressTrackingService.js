// Enhanced Progress Tracking Service with automatic client notifications
import { collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase-config';
import { projectValidation, errorHandling } from '../utils/validation';

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
      // Get all tasks for the project
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (tasks.length === 0) {
        return { success: true, data: { progress: 0 } };
      }

      // Calculate weighted average progress
      const totalWeight = tasks.reduce((sum, task) => sum + (task.estimatedHours || 1), 0);
      const weightedProgress = tasks.reduce((sum, task) => {
        const weight = task.estimatedHours || 1;
        const progress = task.progress || 0;
        return sum + (progress * weight);
      }, 0);

      const overallProgress = Math.round(weightedProgress / totalWeight);

      // Update project progress
      await updateDoc(doc(db, 'projects', projectId), {
        progress: overallProgress,
        updatedAt: new Date(),
        lastProgressUpdate: new Date()
      });

      // Check if project is completed
      if (overallProgress >= 100) {
        await this.completeProject(projectId);
      }

      return {
        success: true,
        data: { progress: overallProgress }
      };
    } catch (error) {
      console.error('Error updating project progress:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'updating project progress')
      };
    }
  }

  // Complete project and notify client
  async completeProject(projectId) {
    try {
      // Get project data
      const projectDoc = await getDocs(query(collection(db, 'projects'), where('__name__', '==', projectId)));
      if (projectDoc.empty) {
        throw new Error('Project not found');
      }

      const project = { id: projectId, ...projectDoc.docs[0].data() };

      // Update project status
      await updateDoc(doc(db, 'projects', projectId), {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      });

      // Send completion notification
      await this.sendProjectCompletionNotification(project);

      console.log(`Project completed: ${projectId}`);
      
      return {
        success: true,
        data: { id: projectId, status: 'completed' }
      };
    } catch (error) {
      console.error('Error completing project:', error);
      return {
        success: false,
        error: errorHandling.handleApiError(error, 'completing project')
      };
    }
  }

  // Send progress notification to client
  async sendProgressNotification(task, progressChange, userId) {
    try {
      if (!task.projectId) return;

      // Get project data
      const projectDoc = await getDocs(query(collection(db, 'projects'), where('__name__', '==', task.projectId)));
      if (projectDoc.empty) return;

      const project = { id: task.projectId, ...projectDoc.docs[0].data() };
      
      if (!project.clientEmail) return;

      // Get freelancer data
      const freelancerDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
      const freelancer = freelancerDoc.empty ? {} : freelancerDoc.docs[0].data();

      // Create progress update record
      const progressUpdate = {
        projectId: task.projectId,
        taskId: task.id,
        taskTitle: task.title,
        oldProgress: (task.progress || 0) - progressChange,
        newProgress: task.progress || 0,
        progressChange,
        updatedBy: userId,
        updatedAt: new Date(),
        clientEmail: project.clientEmail,
        freelancerName: freelancer.username || 'Freelancer',
        projectTitle: project.title
      };

      // Save progress update
      await addDoc(collection(db, 'progress_updates'), progressUpdate);

      // Send email notification (this would integrate with your email service)
      await this.sendProgressEmail(progressUpdate);

      console.log(`Progress notification sent for task: ${task.id}`);
    } catch (error) {
      console.error('Error sending progress notification:', error);
    }
  }

  // Send project completion notification
  async sendProjectCompletionNotification(project) {
    try {
      if (!project.clientEmail) return;

      // Get freelancer data
      const freelancerDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', project.freelancerId)));
      const freelancer = freelancerDoc.empty ? {} : freelancerDoc.docs[0].data();

      // Create completion notification
      const completionNotification = {
        projectId: project.id,
        projectTitle: project.title,
        completedAt: new Date(),
        clientEmail: project.clientEmail,
        freelancerName: freelancer.username || 'Freelancer',
        totalHours: project.totalHours || 0,
        totalAmount: (project.totalHours || 0) * (project.hourlyRate || 0)
      };

      // Save completion notification
      await addDoc(collection(db, 'completion_notifications'), completionNotification);

      // Send email notification
      await this.sendCompletionEmail(completionNotification);

      console.log(`Completion notification sent for project: ${project.id}`);
    } catch (error) {
      console.error('Error sending completion notification:', error);
    }
  }

  // Send progress email (placeholder - integrate with your email service)
  async sendProgressEmail(progressUpdate) {
    try {
      // This would integrate with your email service
      console.log('Sending progress email:', {
        to: progressUpdate.clientEmail,
        subject: `Progress Update: ${progressUpdate.projectTitle}`,
        taskTitle: progressUpdate.taskTitle,
        progressChange: progressUpdate.progressChange
      });

      // For now, just log the notification
      // In a real implementation, this would call your email API
    } catch (error) {
      console.error('Error sending progress email:', error);
    }
  }

  // Send completion email (placeholder - integrate with your email service)
  async sendCompletionEmail(completionNotification) {
    try {
      // This would integrate with your email service
      console.log('Sending completion email:', {
        to: completionNotification.clientEmail,
        subject: `Project Completed: ${completionNotification.projectTitle}`,
        totalHours: completionNotification.totalHours,
        totalAmount: completionNotification.totalAmount
      });

      // For now, just log the notification
      // In a real implementation, this would call your email API
    } catch (error) {
      console.error('Error sending completion email:', error);
    }
  }

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
