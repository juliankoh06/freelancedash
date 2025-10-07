// Transaction Model
export class Transaction {
  constructor(data = {}) {
    this.id = data.id || null;
    this.projectId = data.projectId || null;
    this.projectTitle = data.projectTitle || '';
    this.clientId = data.clientId || null;
    this.clientEmail = data.clientEmail || '';
    this.freelancerId = data.freelancerId || null;
    this.freelancerName = data.freelancerName || '';
    
    // Transaction Details
    this.type = data.type || 'payment'; // payment, expense, refund, milestone
    this.amount = data.amount || 0;
    this.currency = data.currency || 'RM';
    this.description = data.description || '';
    this.status = data.status || 'pending'; // pending, paid, overdue, cancelled
    
    // Payment Details
    this.paymentMethod = data.paymentMethod || ''; // bank_transfer, paypal, stripe, etc.
    this.paymentReference = data.paymentReference || '';
    this.paidAt = data.paidAt || null;
    this.dueDate = data.dueDate || null;
    
    // Time Tracking Integration
    this.hoursWorked = data.hoursWorked || 0;
    this.hourlyRate = data.hourlyRate || 0;
    this.timePeriod = data.timePeriod || null; // { startDate, endDate }
    
    // Invoice Integration
    this.invoiceId = data.invoiceId || null;
    this.invoiceNumber = data.invoiceNumber || '';
    this.invoiceGenerated = data.invoiceGenerated || false;
    
    // Metadata
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.notes = data.notes || '';
    this.tags = data.tags || [];
  }

  // Calculate total amount including taxes
  getTotalAmount() {
    const taxRate = 0.06; // 6% GST
    const taxAmount = this.amount * taxRate;
    return this.amount + taxAmount;
  }

  // Check if transaction is overdue
  isOverdue() {
    if (this.status === 'paid' || this.status === 'cancelled') return false;
    if (!this.dueDate) return false;
    return new Date() > new Date(this.dueDate);
  }

  // Get status color for UI
  getStatusColor() {
    switch (this.status) {
      case 'paid': return 'green';
      case 'pending': return 'yellow';
      case 'overdue': return 'red';
      case 'cancelled': return 'gray';
      default: return 'gray';
    }
  }

  // Get status text for UI
  getStatusText() {
    if (this.isOverdue() && this.status === 'pending') {
      return 'Overdue';
    }
    return this.status.charAt(0).toUpperCase() + this.status.slice(1);
  }

  // Validate transaction data
  validate() {
    const errors = [];
    
    if (!this.projectId) errors.push('Project ID is required');
    if (!this.amount || this.amount <= 0) errors.push('Amount must be greater than 0');
    if (!this.description) errors.push('Description is required');
    if (!this.dueDate) errors.push('Due date is required');
    
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
      type: this.type,
      amount: this.amount,
      currency: this.currency,
      description: this.description,
      status: this.status,
      paymentMethod: this.paymentMethod,
      paymentReference: this.paymentReference,
      paidAt: this.paidAt,
      dueDate: this.dueDate,
      hoursWorked: this.hoursWorked,
      hourlyRate: this.hourlyRate,
      timePeriod: this.timePeriod,
      invoiceId: this.invoiceId,
      invoiceNumber: this.invoiceNumber,
      invoiceGenerated: this.invoiceGenerated,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      notes: this.notes,
      tags: this.tags
    };
  }

  // Create from Firebase document
  static fromFirebase(doc) {
    const data = doc.data();
    return new Transaction({
      id: doc.id,
      ...data
    });
  }
}

// Transaction Types
export const TRANSACTION_TYPES = {
  PAYMENT: 'payment',
  EXPENSE: 'expense',
  REFUND: 'refund',
  MILESTONE: 'milestone'
};

// Transaction Statuses
export const TRANSACTION_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled'
};

// Payment Methods
export const PAYMENT_METHODS = {
  BANK_TRANSFER: 'bank_transfer',
  PAYPAL: 'paypal',
  STRIPE: 'stripe',
  CASH: 'cash',
  CHECK: 'check'
};
