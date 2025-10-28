const admin = require('firebase-admin');

class AuditLoggingService {
  constructor() {
    this.db = admin.firestore();
  }

  // Log audit events with comprehensive data
  async logEvent(eventType, data, userId, additionalData = {}) {
    try {
      const auditLog = {
        eventType,
        userId,
        data: {
          ...data,
          ...additionalData
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent || 'unknown',
        sessionId: data.sessionId || null,
        severity: this.getSeverityLevel(eventType),
        category: this.getCategory(eventType)
      };

      await this.db.collection('audit_logs').add(auditLog);
      
      // Log to console for development
      console.log(`[AUDIT] ${eventType}: ${userId}`, data);
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }

  // Log authentication events
  async logAuthEvent(eventType, userId, data = {}) {
    await this.logEvent(eventType, {
      ...data,
      category: 'authentication'
    }, userId);
  }

  // Log financial events
  async logFinancialEvent(eventType, userId, data = {}) {
    await this.logEvent(eventType, {
      ...data,
      category: 'financial'
    }, userId);
  }

  // Log project events
  async logProjectEvent(eventType, userId, data = {}) {
    await this.logEvent(eventType, {
      ...data,
      category: 'project'
    }, userId);
  }

  // Log data modification events
  async logDataModificationEvent(eventType, userId, data = {}) {
    await this.logEvent(eventType, {
      ...data,
      category: 'data_modification'
    }, userId);
  }

  // Get audit logs for a user
  async getUserAuditLogs(userId, limit = 100, startAfter = null) {
    try {
      let query = this.db.collection('audit_logs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (startAfter) {
        query = query.startAfter(startAfter);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching user audit logs:', error);
      throw error;
    }
  }

  // Get audit logs for a project
  async getProjectAuditLogs(projectId, limit = 100, startAfter = null) {
    try {
      let query = this.db.collection('audit_logs')
        .where('data.projectId', '==', projectId)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (startAfter) {
        query = query.startAfter(startAfter);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching project audit logs:', error);
      throw error;
    }
  }

  // Get audit logs by event type
  async getAuditLogsByEventType(eventType, limit = 100, startAfter = null) {
    try {
      let query = this.db.collection('audit_logs')
        .where('eventType', '==', eventType)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (startAfter) {
        query = query.startAfter(startAfter);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching audit logs by event type:', error);
      throw error;
    }
  }

  // Get severity level for event type
  getSeverityLevel(eventType) {
    const severityMap = {
      // Critical events
      'user_deleted': 'critical',
      'project_deleted': 'critical',
      'invoice_deleted': 'critical',
      'transaction_deleted': 'critical',
      
      // High severity events
      'user_created': 'high',
      'project_created': 'high',
      'invoice_created': 'high',
      'transaction_created': 'high',
      'milestone_completed': 'high',
      'project_completed': 'high',
      
      // Medium severity events
      'user_updated': 'medium',
      'project_updated': 'medium',
      'task_updated': 'medium',
      'progress_updated': 'medium',
      'time_tracking_started': 'medium',
      'time_tracking_stopped': 'medium',
      
      // Low severity events
      'user_login': 'low',
      'user_logout': 'low',
      'data_viewed': 'low'
    };

    return severityMap[eventType] || 'medium';
  }

  // Get category for event type
  getCategory(eventType) {
    const categoryMap = {
      // Authentication
      'user_login': 'authentication',
      'user_logout': 'authentication',
      'user_created': 'authentication',
      'user_updated': 'authentication',
      'user_deleted': 'authentication',
      
      // Project management
      'project_created': 'project',
      'project_updated': 'project',
      'project_deleted': 'project',
      'project_completed': 'project',
      'task_created': 'project',
      'task_updated': 'project',
      'task_deleted': 'project',
      'milestone_created': 'project',
      'milestone_updated': 'project',
      'milestone_completed': 'project',
      'progress_updated': 'project',
      
      // Financial
      'invoice_created': 'financial',
      'invoice_updated': 'financial',
      'invoice_deleted': 'financial',
      'invoice_approved': 'financial',
      'transaction_created': 'financial',
      'transaction_updated': 'financial',
      'transaction_deleted': 'financial',
      
      // Time tracking
      'time_tracking_started': 'time_tracking',
      'time_tracking_stopped': 'time_tracking',
      'time_tracking_paused': 'time_tracking',
      
      // Data modification
      'data_modified': 'data_modification',
      'data_viewed': 'data_modification'
    };

    return categoryMap[eventType] || 'general';
  }

  // Clean up old audit logs (run periodically)
  async cleanupOldLogs(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const oldLogsQuery = this.db.collection('audit_logs')
        .where('timestamp', '<', cutoffDate)
        .limit(1000);

      const snapshot = await oldLogsQuery.get();
      
      if (snapshot.empty) {
        return { deleted: 0 };
      }

      const batch = this.db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      
      console.log(`Cleaned up ${snapshot.docs.length} old audit logs`);
      return { deleted: snapshot.docs.length };
    } catch (error) {
      console.error('Error cleaning up old audit logs:', error);
      throw error;
    }
  }
}

module.exports = new AuditLoggingService();
