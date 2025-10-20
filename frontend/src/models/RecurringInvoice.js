// Recurring Invoice Model
export class RecurringInvoice {
  constructor(data = {}) {
    this.id = data.id || null;
    this.projectId = data.projectId || null;
    this.projectTitle = data.projectTitle || '';
    this.clientId = data.clientId || null;
    this.clientEmail = data.clientEmail || '';
    this.freelancerId = data.freelancerId || null;
    this.freelancerName = data.freelancerName || '';
    
    // Recurring Settings
    this.frequency = data.frequency || 'monthly'; // weekly, biweekly, monthly, quarterly
    this.amount = data.amount || 0;
    this.currency = data.currency || 'RM';
    this.description = data.description || '';
    
    // Schedule
    this.startDate = data.startDate || new Date();
    this.endDate = data.endDate || null; // null = indefinite
    this.nextInvoiceDate = data.nextInvoiceDate || new Date();
    this.lastInvoiceDate = data.lastInvoiceDate || null;
    
    // Status
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.isPaused = data.isPaused || false;
    
    // Generated Invoices
    this.generatedInvoices = data.generatedInvoices || []; // Array of invoice IDs
    this.totalInvoicesGenerated = data.totalInvoicesGenerated || 0;
    
    // Invoice Template
    this.invoiceTemplate = data.invoiceTemplate || {
      paymentTerms: 'Net 30',
      notes: '',
      terms: 'Payment is due within 30 days of invoice date.',
      lineItems: []
    };
    
    // Metadata
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Calculate next invoice date based on frequency
  calculateNextInvoiceDate(fromDate = null) {
    const baseDate = fromDate ? new Date(fromDate) : new Date(this.nextInvoiceDate);
    const nextDate = new Date(baseDate);
    
    switch (this.frequency) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 1);
    }
    
    return nextDate;
  }

  // Check if invoice should be generated today
  shouldGenerateInvoice() {
    if (!this.isActive || this.isPaused) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(this.nextInvoiceDate);
    nextDate.setHours(0, 0, 0, 0);
    
    // Check if we've passed the next invoice date
    if (today >= nextDate) {
      // Check if we've reached end date
      if (this.endDate) {
        const endDate = new Date(this.endDate);
        endDate.setHours(0, 0, 0, 0);
        return today <= endDate;
      }
      return true;
    }
    
    return false;
  }

  // Get frequency label
  getFrequencyLabel() {
    switch (this.frequency) {
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      default: return 'Monthly';
    }
  }

  // Get status color
  getStatusColor() {
    if (!this.isActive) return 'gray';
    if (this.isPaused) return 'yellow';
    return 'green';
  }

  // Get status text
  getStatusText() {
    if (!this.isActive) return 'Inactive';
    if (this.isPaused) return 'Paused';
    return 'Active';
  }

  // Validate recurring invoice data
  validate() {
    const errors = [];
    
    if (!this.projectId) errors.push('Project ID is required');
    if (!this.clientId) errors.push('Client ID is required');
    if (!this.freelancerId) errors.push('Freelancer ID is required');
    if (!this.amount || this.amount <= 0) errors.push('Amount must be greater than 0');
    if (!this.frequency) errors.push('Frequency is required');
    if (!this.startDate) errors.push('Start date is required');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Convert to Firebase document
  toFirebase() {
    return {
      projectId: this.projectId,
      projectTitle: this.projectTitle,
      clientId: this.clientId,
      clientEmail: this.clientEmail,
      freelancerId: this.freelancerId,
      freelancerName: this.freelancerName,
      frequency: this.frequency,
      amount: this.amount,
      currency: this.currency,
      description: this.description,
      startDate: this.startDate,
      endDate: this.endDate,
      nextInvoiceDate: this.nextInvoiceDate,
      lastInvoiceDate: this.lastInvoiceDate,
      isActive: this.isActive,
      isPaused: this.isPaused,
      generatedInvoices: this.generatedInvoices,
      totalInvoicesGenerated: this.totalInvoicesGenerated,
      invoiceTemplate: this.invoiceTemplate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Create from Firebase document
  static fromFirebase(doc) {
    const data = doc.data();
    return new RecurringInvoice({
      id: doc.id,
      ...data
    });
  }
}

// Recurring Frequencies
export const RECURRING_FREQUENCIES = {
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly'
};
