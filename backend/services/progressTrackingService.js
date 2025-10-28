const admin = require('firebase-admin');

class ProgressTrackingService {
  constructor() {
    this.db = admin.firestore();
  }

  // Update task progress with verification and audit trail
  async updateTaskProgress(taskId, progressData, userId) {
    try {
      // Validate progress data
      const validation = this.validateProgressData(progressData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Get current task data
      const taskDoc = await this.db.collection('tasks').doc(taskId).get();
      if (!taskDoc.exists) {
        throw new Error('Task not found');
      }

      const currentTask = { id: taskId, ...taskDoc.data() };
      
      // Verify user has access to this task
      const projectDoc = await this.db.collection('projects').doc(currentTask.projectId).get();
      const projectData = projectDoc.data();
      
      if (projectData.freelancerId !== userId && projectData.clientId !== userId) {
        throw new Error('Access denied: You can only update progress for your own projects');
      }

      // Calculate progress change
      const oldProgress = currentTask.progress || 0;
      const newProgress = parseInt(progressData.progress) || 0;
      const progressChange = newProgress - oldProgress;

      // Validate progress change is reasonable
      if (Math.abs(progressChange) > 50) {
        throw new Error('Progress change too large. Please contact support if this is correct.');
      }

      // Create progress update with verification
      const progressUpdate = {
        taskId,
        projectId: currentTask.projectId,
        oldProgress,
        newProgress,
        progressChange,
        notes: progressData.notes || '',
        evidence: progressData.evidence || '',
        files: progressData.files || [],
        updatedBy: userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        verified: false,
        verificationNotes: '',
        verifiedBy: null,
        verifiedAt: null
      };

      // Add to progress updates collection
      const progressUpdateRef = await this.db.collection('progress_updates').add(progressUpdate);

      // Update task with metadata
      const updateData = {
        progress: newProgress,
        status: newProgress >= 100 ? 'completed' : 'in-progress',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastProgressUpdate: admin.firestore.FieldValue.serverTimestamp(),
        progressHistory: admin.firestore.FieldValue.arrayUnion({
          from: oldProgress,
          to: newProgress,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: userId,
          progressUpdateId: progressUpdateRef.id
        })
      };

      await this.db.collection('tasks').doc(taskId).update(updateData);

      // Update project progress
      await this.updateProjectProgress(currentTask.projectId);

      // Log audit event
      await this.logAuditEvent('progress_updated', {
        taskId,
        projectId: currentTask.projectId,
        userId,
        oldProgress,
        newProgress,
        progressUpdateId: progressUpdateRef.id
      });

      // Send notification if significant progress change
      if (Math.abs(progressChange) >= 10) {
        await this.sendProgressNotification(currentTask, progressChange, userId);
      }

      return {
        success: true,
        data: { id: taskId, ...updateData, progressUpdateId: progressUpdateRef.id }
      };
    } catch (error) {
      console.error('Error updating task progress:', error);
      throw error;
    }
  }

  // Verify progress update (for clients)
  async verifyProgressUpdate(progressUpdateId, clientId, verificationNotes = '') {
    try {
      const progressUpdateDoc = await this.db.collection('progress_updates').doc(progressUpdateId).get();
      if (!progressUpdateDoc.exists) {
        throw new Error('Progress update not found');
      }

      const progressUpdate = progressUpdateDoc.data();
      
      // Verify client has access to this project
      const projectDoc = await this.db.collection('projects').doc(progressUpdate.projectId).get();
      const projectData = projectDoc.data();
      
      if (projectData.clientId !== clientId) {
        throw new Error('Access denied: You can only verify progress for your own projects');
      }

      // Update progress update with verification
      await this.db.collection('progress_updates').doc(progressUpdateId).update({
        verified: true,
        verificationNotes,
        verifiedBy: clientId,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log audit event
      await this.logAuditEvent('progress_verified', {
        progressUpdateId,
        projectId: progressUpdate.projectId,
        clientId,
        verificationNotes
      });

      return { success: true };
    } catch (error) {
      console.error('Error verifying progress update:', error);
      throw error;
    }
  }

  // Update overall project progress
  async updateProjectProgress(projectId) {
    try {
      // Get all tasks for the project
      const tasksSnapshot = await this.db.collection('tasks')
        .where('projectId', '==', projectId)
        .get();

      if (tasksSnapshot.empty) {
        return { success: true, data: { progress: 0 } };
      }

      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate weighted average progress
      const totalWeight = tasks.reduce((sum, task) => sum + (task.estimatedHours || 1), 0);
      const weightedProgress = tasks.reduce((sum, task) => {
        const weight = task.estimatedHours || 1;
        const progress = task.progress || 0;
        return sum + (progress * weight);
      }, 0);

      const overallProgress = Math.round(weightedProgress / totalWeight);

      // Update project progress
      await this.db.collection('projects').doc(projectId).update({
        progress: overallProgress,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastProgressUpdate: admin.firestore.FieldValue.serverTimestamp()
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
      throw error;
    }
  }

  // Complete project and notify client
  async completeProject(projectId) {
    try {
      await this.db.collection('projects').doc(projectId).update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log audit event
      await this.logAuditEvent('project_completed', {
        projectId,
        completedAt: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('Error completing project:', error);
      throw error;
    }
  }

  // Validate progress data
  validateProgressData(progressData) {
    const errors = [];

    if (!progressData.progress || isNaN(progressData.progress)) {
      errors.push('Progress percentage is required and must be a number');
    } else {
      const progress = parseInt(progressData.progress);
      if (progress < 0 || progress > 100) {
        errors.push('Progress must be between 0 and 100');
      }
    }

    if (progressData.notes && progressData.notes.length > 1000) {
      errors.push('Notes cannot exceed 1000 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Send progress notification
  async sendProgressNotification(task, progressChange, userId) {
    try {
      // This would integrate with email service
      console.log(`Progress notification: Task ${task.id} changed by ${progressChange}%`);
    } catch (error) {
      console.error('Error sending progress notification:', error);
    }
  }

  // Log audit events
  async logAuditEvent(eventType, data) {
    try {
      await this.db.collection('audit_logs').add({
        eventType,
        data,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: data.userId || data.clientId
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }
}

module.exports = new ProgressTrackingService();
