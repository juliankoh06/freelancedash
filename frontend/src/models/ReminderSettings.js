// Payment Reminder Settings Model
export class ReminderSettings {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null; 
    this.projectId = data.projectId || null; 
    
    // Reminder Configuration
    this.enabled = data.enabled !== undefined ? data.enabled : true;
    
    // Before Due Date Reminders
    this.beforeDueReminders = data.beforeDueReminders !== undefined 
      ? data.beforeDueReminders 
      : [7, 3, 1]; 
    
    // Overdue Reminders
    this.overdueReminders = data.overdueReminders !== undefined
      ? data.overdueReminders
      : [1, 3, 7, 14, 30]; 
    
    // Warning escalation
    this.sendWarningAt = data.sendWarningAt || 14; // Days overdue before sending warning
    this.sendFinalNoticeAt = data.sendFinalNoticeAt || 30; // Days overdue before final notice
    
    // Email customization
    this.reminderEmailSubject = data.reminderEmailSubject || 'Payment Reminder: Invoice {invoiceNumber}';
    this.warningEmailSubject = data.warningEmailSubject || 'Payment Warning: Invoice {invoiceNumber} is Overdue';
    this.finalNoticeSubject = data.finalNoticeSubject || 'Final Notice: Invoice {invoiceNumber} - Immediate Action Required';
    
    // Custom message templates
    this.customReminderMessage = data.customReminderMessage || '';
    this.customWarningMessage = data.customWarningMessage || '';
    this.customFinalNoticeMessage = data.customFinalNoticeMessage || '';
    
    // Additional options
    this.ccFreelancer = data.ccFreelancer !== undefined ? data.ccFreelancer : false;
    this.pauseRemindersOnWeekends = data.pauseRemindersOnWeekends !== undefined 
      ? data.pauseRemindersOnWeekends 
      : false;
    
    // Metadata
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Get reminder type based on days from due date
  getReminderType(daysFromDue) {
    if (daysFromDue < 0) {
      // Before due date
      return 'upcoming';
    } else if (daysFromDue < this.sendWarningAt) {
      // Overdue but before warning threshold
      return 'overdue';
    } else if (daysFromDue < this.sendFinalNoticeAt) {
      // Past warning threshold
      return 'warning';
    } else {
      // Past final notice threshold
      return 'final_notice';
    }
  }

  // Check if reminder should be sent for given days from due
  shouldSendReminder(daysFromDue) {
    if (!this.enabled) return false;

    if (daysFromDue < 0) {
      // Before due date - check if absolute value is in beforeDueReminders
      return this.beforeDueReminders.includes(Math.abs(daysFromDue));
    } else {
      // After due date - check if in overdueReminders
      return this.overdueReminders.includes(daysFromDue);
    }
  }

  // Get email subject based on reminder type
  getEmailSubject(invoiceNumber, reminderType) {
    let template = this.reminderEmailSubject;
    
    if (reminderType === 'warning') {
      template = this.warningEmailSubject;
    } else if (reminderType === 'final_notice') {
      template = this.finalNoticeSubject;
    }
    
    return template.replace('{invoiceNumber}', invoiceNumber);
  }

  // Get custom message based on reminder type
  getCustomMessage(reminderType) {
    if (reminderType === 'warning') {
      return this.customWarningMessage;
    } else if (reminderType === 'final_notice') {
      return this.customFinalNoticeMessage;
    }
    return this.customReminderMessage;
  }

  // Validate settings
  validate() {
    const errors = [];
    
    if (!this.userId) errors.push('User ID is required');
    if (!Array.isArray(this.beforeDueReminders)) errors.push('Before due reminders must be an array');
    if (!Array.isArray(this.overdueReminders)) errors.push('Overdue reminders must be an array');
    if (this.sendWarningAt < 0) errors.push('Warning threshold must be positive');
    if (this.sendFinalNoticeAt <= this.sendWarningAt) {
      errors.push('Final notice threshold must be greater than warning threshold');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Convert to Firebase document
  toFirebase() {
    return {
      userId: this.userId,
      projectId: this.projectId,
      enabled: this.enabled,
      beforeDueReminders: this.beforeDueReminders,
      overdueReminders: this.overdueReminders,
      sendWarningAt: this.sendWarningAt,
      sendFinalNoticeAt: this.sendFinalNoticeAt,
      reminderEmailSubject: this.reminderEmailSubject,
      warningEmailSubject: this.warningEmailSubject,
      finalNoticeSubject: this.finalNoticeSubject,
      customReminderMessage: this.customReminderMessage,
      customWarningMessage: this.customWarningMessage,
      customFinalNoticeMessage: this.customFinalNoticeMessage,
      ccFreelancer: this.ccFreelancer,
      pauseRemindersOnWeekends: this.pauseRemindersOnWeekends,
      createdAt: this.createdAt,
      updatedAt: new Date()
    };
  }

  // Create from Firebase document
  static fromFirebase(doc) {
    const data = doc.data();
    return new ReminderSettings({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
    });
  }
}

// Reminder Types
export const REMINDER_TYPES = {
  UPCOMING: 'upcoming',
  OVERDUE: 'overdue',
  WARNING: 'warning',
  FINAL_NOTICE: 'final_notice'
};

// Default reminder configurations
export const DEFAULT_REMINDER_CONFIG = {
  enabled: true,
  beforeDueReminders: [7, 3, 1],
  overdueReminders: [1, 3, 7, 14, 30],
  sendWarningAt: 14,
  sendFinalNoticeAt: 30,
  ccFreelancer: false,
  pauseRemindersOnWeekends: false
};

export default ReminderSettings;
