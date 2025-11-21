const { admin, db } = require('../firebase-admin');

class TimeTrackingService {
  constructor() {
    this.db = db;
    this.activeSessions = new Map();
  }

  // Start time tracking with server-side validation
  async startTracking(taskId, projectId, userId) {
    try {
      // Validate task exists and user has access
      const taskDoc = await this.db.collection('tasks').doc(taskId).get();
      if (!taskDoc.exists) {
        throw new Error('Task not found');
      }

      const taskData = taskDoc.data();
      
      // Verify user has access to this project
      const projectDoc = await this.db.collection('projects').doc(projectId).get();
      const projectData = projectDoc.data();
      
      if (projectData.freelancerId !== userId) {
        throw new Error('Access denied: You can only track time for your own projects');
      }

      // Check if already tracking this task
      const existingSession = await this.getActiveSession(taskId, userId);
      if (existingSession) {
        throw new Error('Time tracking already active for this task');
      }

      // Create time tracking session
      const sessionData = {
        taskId,
        projectId,
        userId,
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        endTime: null,
        duration: 0,
        status: 'active',
        notes: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const sessionRef = await this.db.collection('time_sessions').add(sessionData);
      
      // Update task status
      await this.db.collection('tasks').doc(taskId).update({
        status: 'in-progress',
        trackingStartTime: admin.firestore.FieldValue.serverTimestamp(),
        currentSessionId: sessionRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Store active session
      this.activeSessions.set(`${taskId}_${userId}`, {
        sessionId: sessionRef.id,
        startTime: new Date()
      });

      // Log audit event
      await this.logAuditEvent('time_tracking_started', {
        taskId,
        projectId,
        userId,
        sessionId: sessionRef.id
      });

      return { success: true, sessionId: sessionRef.id };
    } catch (error) {
      console.error('Error starting time tracking:', error);
      throw error;
    }
  }

  // Stop time tracking with validation
  async stopTracking(taskId, userId, notes = '') {
    try {
      // Get active session
      const session = await this.getActiveSession(taskId, userId);
      if (!session) {
        throw new Error('No active time tracking session found');
      }

      const sessionDoc = await this.db.collection('time_sessions').doc(session.sessionId).get();
      const sessionData = sessionDoc.data();

      // Calculate total duration
      const startTime = sessionData.startTime.toDate();
      const endTime = new Date();
      const totalDuration = (endTime - startTime) / (1000 * 60 * 60); // Convert to hours

      // Validate duration is reasonable
      if (totalDuration > 12) {
        throw new Error('Time tracking session too long. Please contact support if this is correct.');
      }

      // Update session
      await this.db.collection('time_sessions').doc(session.sessionId).update({
        endTime: admin.firestore.FieldValue.serverTimestamp(),
        duration: totalDuration,
        status: 'completed',
        notes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update task with time spent
      const currentTimeSpent = sessionData.timeSpent || 0;
      const newTimeSpent = currentTimeSpent + totalDuration;

      await this.db.collection('tasks').doc(taskId).update({
        timeSpent: newTimeSpent,
        actualHours: newTimeSpent,
        trackingStartTime: null,
        currentSessionId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Remove from active sessions
      this.activeSessions.delete(`${taskId}_${userId}`);

      // Log audit event
      await this.logAuditEvent('time_tracking_stopped', {
        taskId,
        userId,
        sessionId: session.sessionId,
        duration: totalDuration
      });

      return { success: true, duration: totalDuration };
    } catch (error) {
      console.error('Error stopping time tracking:', error);
      throw error;
    }
  }


  // Get active session for a task and user
  async getActiveSession(taskId, userId) {
    const key = `${taskId}_${userId}`;
    return this.activeSessions.get(key);
  }

  // Validate time entry
  validateTimeEntry(timeEntry) {
    const errors = [];

    if (!timeEntry.startTime || !timeEntry.endTime) {
      errors.push('Start time and end time are required');
    } else {
      const start = new Date(timeEntry.startTime);
      const end = new Date(timeEntry.endTime);
      
      if (end <= start) {
        errors.push('End time must be after start time');
      }

      const duration = (end - start) / (1000 * 60 * 60); // hours
      if (duration > 12) {
        errors.push('Time entry cannot exceed 12 hours');
      }

      if (duration < 0) {
        errors.push('Invalid time entry duration');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Log audit events
  async logAuditEvent(eventType, data) {
    try {
      await this.db.collection('audit_logs').add({
        eventType,
        data,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: data.userId
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }
}

module.exports = new TimeTrackingService();
