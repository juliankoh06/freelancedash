// Transaction Model
export class Transaction {
  constructor(data = {}) {
    this.id = data.id || null;

    // Basic Info
    this.projectTitle = data.projectTitle || '';
    this.clientEmail = data.clientEmail || '';
    this.freelancerName = data.freelancerName || '';

    // Transaction Details
    this.amount = data.amount || 0;
    this.status = data.status || 'pending'; // pending, paid, overdue

    // Payment Info
    this.paymentMethod = data.paymentMethod || '';
    this.paidAt = data.paidAt || null;

    // Invoice Info (optional)
    this.invoiceNumber = data.invoiceNumber || '';

    // Timestamps
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Check if transaction is overdue
  isOverdue() {
    if (this.status === 'paid') return false;
    return false; // simplified; can add dueDate logic if needed
  }

  // Get status color for UI
  getStatusColor() {
    switch (this.status) {
      case 'paid': return 'green';
      case 'pending': return 'yellow';
      case 'overdue': return 'red';
      default: return 'gray';
    }
  }

  // Convert to Firebase document
  toFirebase() {
    return {
      projectTitle: this.projectTitle,
      clientEmail: this.clientEmail,
      freelancerName: this.freelancerName,
      amount: this.amount,
      currency: this.currency,
      description: this.description,
      status: this.status,
      paymentMethod: this.paymentMethod,
      paidAt: this.paidAt,
      invoiceNumber: this.invoiceNumber,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
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
  REFUND: 'refund',
  WITHDRAWAL: 'withdrawal',
  DEPOSIT: 'deposit',
  ADJUSTMENT: 'adjustment',
};

// Transaction Statuses
export const TRANSACTION_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PROCESSING: 'processing',
};
