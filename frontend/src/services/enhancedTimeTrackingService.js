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
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'time_sessions'), sessionData);
      
      // Store active session
      this.activeSessions.set(taskId, {
        sessionId: docRef.id,
        startTime
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

      // Update session
      await updateDoc(doc(db, 'time_sessions', session.sessionId), {
        endTime,
        duration,
        notes,
        status: 'completed',
        updatedAt: new Date()
      });

      // Update task with total time (use duration, not activeTime, to match live timer)
      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDocs(query(collection(db, 'tasks'), where('__name__', '==', taskId)));
      const currentTimeSpent = taskDoc.docs[0]?.data()?.timeSpent || 0;
      
      await updateDoc(taskRef, {
        timeSpent: currentTimeSpent + duration, // Use total duration to match live timer
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
        duration: duration
      };
    } catch (error) {
      console.error('❌ Error stopping enhanced time tracking:', error);
      throw error;
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
    const totalTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);

    // Peak hours analysis
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, time: 0 }));
    sessions.forEach(session => {
      const hour = new Date(session.startTime).getHours();
      hourlyData[hour].time += session.duration || 0;
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
      dailyData[date].time += session.duration || 0;
      dailyData[date].sessions += 1;
    });

    return {
      totalSessions,
      totalTime: Math.round(totalTime * 100) / 100,
      peakHour: peakHour.hour,
      peakHourTime: Math.round(peakHour.time * 100) / 100,
      dailyData: Object.values(dailyData).sort((a, b) => new Date(a.date) - new Date(b.date)),
      hourlyData
    };
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
