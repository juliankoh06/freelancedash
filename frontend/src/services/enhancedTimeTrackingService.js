import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  orderBy,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase-config';

class EnhancedTimeTrackingService {
  constructor() {
    this.activeSessions = new Map();
    this.idleThreshold = 5 * 60 * 1000; // 5 minutes
    this.lastActivity = Date.now();
  }

  // Start time tracking with enhanced features
  async startTracking(taskId, projectId, userId) {
    try {
      console.log('🕒 Starting enhanced time tracking for task:', taskId);
      console.log('🕒 Project ID:', projectId);
      console.log('🕒 User ID:', userId);
      
      if (!projectId) {
        throw new Error('Project ID is required for time tracking');
      }
      
      if (!userId) {
        throw new Error('User ID is required for time tracking');
      }
      
      const sessionId = `${taskId}_${Date.now()}`;
      const startTime = new Date();
      
      // Create time tracking session
      const sessionData = {
        taskId,
        projectId,
        userId,
        sessionId,
        startTime,
        endTime: null,
        duration: 0,
        status: 'active',
        idleTime: 0,
        productivityScore: 0,
        category: 'work', // Will be auto-categorized
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'time_sessions'), sessionData);
      
      // Store active session
      this.activeSessions.set(taskId, {
        sessionId: docRef.id,
        startTime,
        lastActivity: Date.now(),
        idleTime: 0
      });

      // Update task status
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'in-progress',
        trackingStartTime: startTime,
        currentSessionId: docRef.id,
        updatedAt: new Date()
      });

      console.log('✅ Enhanced time tracking started');
      return { success: true, sessionId: docRef.id };
    } catch (error) {
      console.error('❌ Error starting enhanced time tracking:', error);
      throw error;
    }
  }

  // Stop time tracking with analytics
  async stopTracking(taskId, notes = '') {
    try {
      console.log('🕒 Stopping enhanced time tracking for task:', taskId);
      
      const session = this.activeSessions.get(taskId);
      if (!session) {
        throw new Error('No active session found for this task');
      }

      const endTime = new Date();
      const duration = (endTime - session.startTime) / 1000 / 60 / 60; // hours
      const idleTime = session.idleTime / 1000 / 60 / 60; // hours
      const activeTime = duration - idleTime;

      // Calculate productivity score
      const productivityScore = this.calculateProductivityScore(activeTime, idleTime);

      // Update session
      await updateDoc(doc(db, 'time_sessions', session.sessionId), {
        endTime,
        duration,
        idleTime,
        activeTime,
        productivityScore,
        notes,
        status: 'completed',
        updatedAt: new Date()
      });

      // Update task with total time
      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDocs(query(collection(db, 'tasks'), where('__name__', '==', taskId)));
      const currentTimeSpent = taskDoc.docs[0]?.data()?.timeSpent || 0;
      
      await updateDoc(taskRef, {
        timeSpent: currentTimeSpent + activeTime,
        status: 'paused',
        trackingStartTime: null,
        currentSessionId: null,
        updatedAt: new Date()
      });

      // Remove from active sessions
      this.activeSessions.delete(taskId);

      console.log('✅ Enhanced time tracking stopped');
      return { 
        success: true, 
        duration: activeTime,
        productivityScore,
        idleTime 
      };
    } catch (error) {
      console.error('❌ Error stopping enhanced time tracking:', error);
      throw error;
    }
  }

  // Pause tracking due to idle detection
  async pauseTracking(taskId, reason = 'idle') {
    try {
      const session = this.activeSessions.get(taskId);
      if (!session) return;

      const now = Date.now();
      const idleTime = now - session.lastActivity;
      session.idleTime += idleTime;
      session.lastActivity = now;

      // Update session with idle time
      await updateDoc(doc(db, 'time_sessions', session.sessionId), {
        idleTime: session.idleTime,
        status: 'paused',
        pauseReason: reason,
        updatedAt: new Date()
      });

      console.log('⏸️ Time tracking paused due to:', reason);
    } catch (error) {
      console.error('❌ Error pausing time tracking:', error);
    }
  }

  // Resume tracking after activity
  async resumeTracking(taskId) {
    try {
      const session = this.activeSessions.get(taskId);
      if (!session) return;

      session.lastActivity = Date.now();

      await updateDoc(doc(db, 'time_sessions', session.sessionId), {
        status: 'active',
        pauseReason: null,
        updatedAt: new Date()
      });

      console.log('▶️ Time tracking resumed');
    } catch (error) {
      console.error('❌ Error resuming time tracking:', error);
    }
  }

  // Get time tracking analytics
  async getTimeAnalytics(userId, projectId = null, timeRange = 'week') {
    try {
      console.log('📊 Fetching time analytics:', { userId, projectId, timeRange });
      
      const startDate = this.getStartDate(timeRange);
      let q = query(
        collection(db, 'time_sessions'),
        where('userId', '==', userId),
        where('createdAt', '>=', startDate),
        orderBy('createdAt', 'desc')
      );

      if (projectId) {
        q = query(q, where('projectId', '==', projectId));
      }

      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return this.calculateAnalytics(sessions);
    } catch (error) {
      console.error('❌ Error fetching time analytics:', error);
      throw error;
    }
  }

  // Calculate productivity score
  calculateProductivityScore(activeTime, idleTime) {
    if (activeTime === 0) return 0;
    
    const efficiency = activeTime / (activeTime + idleTime);
    const baseScore = Math.min(efficiency * 100, 100);
    
    // Bonus for longer focused sessions
    const focusBonus = Math.min(activeTime * 5, 20);
    
    return Math.round(Math.min(baseScore + focusBonus, 100));
  }

  // Get start date based on time range
  getStartDate(timeRange) {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'quarter':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  // Calculate analytics from sessions
  calculateAnalytics(sessions) {
    const totalSessions = sessions.length;
    const totalTime = sessions.reduce((sum, session) => sum + (session.activeTime || 0), 0);
    const totalIdleTime = sessions.reduce((sum, session) => sum + (session.idleTime || 0), 0);
    const avgProductivity = sessions.length > 0 ? 
      sessions.reduce((sum, session) => sum + (session.productivityScore || 0), 0) / sessions.length : 0;

    // Peak hours analysis
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, time: 0 }));
    sessions.forEach(session => {
      const hour = new Date(session.startTime).getHours();
      hourlyData[hour].time += session.activeTime || 0;
    });

    const peakHour = hourlyData.reduce((max, hour) => 
      hour.time > max.time ? hour : max
    );

    // Daily breakdown
    const dailyData = {};
    sessions.forEach(session => {
      const date = new Date(session.startTime).toLocaleDateString();
      if (!dailyData[date]) {
        dailyData[date] = { date, time: 0, sessions: 0 };
      }
      dailyData[date].time += session.activeTime || 0;
      dailyData[date].sessions += 1;
    });

    return {
      totalSessions,
      totalTime: Math.round(totalTime * 100) / 100,
      totalIdleTime: Math.round(totalIdleTime * 100) / 100,
      avgProductivity: Math.round(avgProductivity),
      peakHour: peakHour.hour,
      peakHourTime: Math.round(peakHour.time * 100) / 100,
      dailyData: Object.values(dailyData).sort((a, b) => new Date(a.date) - new Date(b.date)),
      hourlyData,
      efficiency: totalTime > 0 ? Math.round((totalTime / (totalTime + totalIdleTime)) * 100) : 0
    };
  }

  // Update activity timestamp
  updateActivity(taskId) {
    const session = this.activeSessions.get(taskId);
    if (session) {
      session.lastActivity = Date.now();
    }
    this.lastActivity = Date.now();
  }

  // Check for idle sessions
  checkIdleSessions() {
    const now = Date.now();
    this.activeSessions.forEach((session, taskId) => {
      const timeSinceActivity = now - session.lastActivity;
      if (timeSinceActivity > this.idleThreshold) {
        this.pauseTracking(taskId, 'idle');
      }
    });
  }

  // Get active sessions
  getActiveSessions() {
    return Array.from(this.activeSessions.entries()).map(([taskId, session]) => ({
      taskId,
      sessionId: session.sessionId,
      startTime: session.startTime,
      duration: (Date.now() - session.startTime) / 1000 / 60 / 60
    }));
  }
}

export default new EnhancedTimeTrackingService();
