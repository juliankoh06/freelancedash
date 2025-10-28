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
import { getAuth } from 'firebase/auth';
import { db } from '../firebase-config';

class EnhancedTimeTrackingService {
  constructor() {
    this.activeSessions = new Map();
  }

  // Start time tracking with server-side validation
  async startTracking(taskId, projectId, userId) {
    try {
      console.log('🕒 Starting time tracking with server validation:', taskId);
      
      // Send to backend for server-side validation
      const response = await fetch(`/api/time-tracking/start/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ projectId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start time tracking');
      }

      const result = await response.json();
      
      // Store active session locally for UI updates
      this.activeSessions.set(taskId, {
        sessionId: result.data.sessionId,
        startTime: new Date()
      });

      console.log('✅ Time tracking started with server validation');
      return { success: true, sessionId: result.data.sessionId };
    } catch (error) {
      console.error('❌ Error starting time tracking:', error);
      throw error;
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

  // Stop time tracking with server-side validation
  async stopTracking(taskId, notes = '') {
    try {
      console.log('🕒 Stopping time tracking with server validation:', taskId);
      
      // Send to backend for server-side validation
      const response = await fetch(`/api/time-tracking/stop/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ notes })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stop time tracking');
      }

      const result = await response.json();
      
      // Remove from active sessions
      this.activeSessions.delete(taskId);

      console.log('✅ Time tracking stopped with server validation');
      return { 
        success: true, 
        duration: result.data.duration
      };
    } catch (error) {
      console.error('❌ Error stopping time tracking:', error);
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
