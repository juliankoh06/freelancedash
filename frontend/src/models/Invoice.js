// Invoice Model
export class Invoice {
  constructor(data = {}) {
    this.id = data.id || null;
    this.invoiceNumber = data.invoiceNumber || '';
    this.projectId = data.projectId || null;
    this.projectTitle = data.projectTitle || '';
    
    // Client Information
    this.clientId = data.clientId || null;
    this.clientEmail = data.clientEmail || '';
    this.clientName = data.clientName || '';
    this.clientAddress = data.clientAddress || '';
    
    // Freelancer Information
    this.freelancerId = data.freelancerId || null;
    this.freelancerName = data.freelancerName || '';
    this.freelancerEmail = data.freelancerEmail || '';
    this.freelancerAddress = data.freelancerAddress || '';
    this.freelancerPhone = data.freelancerPhone || '';
    this.freelancerBusinessNumber = data.freelancerBusinessNumber || '';
    
    // Invoice Details
    this.status = data.status || 'draft'; // draft, sent, paid, overdue, cancelled
    this.issueDate = data.issueDate || new Date();
    this.dueDate = data.dueDate || null;
    this.paidDate = data.paidDate || null;
    
    // Financial Details
    this.subtotal = data.subtotal || 0;
    this.taxRate = data.taxRate || 0.06; // 6% GST
    this.taxAmount = data.taxAmount || 0;
    this.totalAmount = data.totalAmount || 0;
    this.currency = data.currency || 'RM';
    
    // Line Items
    this.lineItems = data.lineItems || [];
    
    // Payment Information
    this.paymentTerms = data.paymentTerms || 'Net 30';
    this.paymentMethod = data.paymentMethod || '';
    this.paymentReference = data.paymentReference || '';
    
    // Notes and Terms
    this.notes = data.notes || '';
    this.terms = data.terms || 'Payment is due within 30 days of invoice date.';
    
    // File Information
    this.pdfUrl = data.pdfUrl || '';
    this.pdfGenerated = data.pdfGenerated || false;
    
    // Metadata
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.sentAt = data.sentAt || null;
    this.reminderSentAt = data.reminderSentAt || null;
  }

  // Calculate totals
  calculateTotals() {
    this.subtotal = this.lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    this.taxAmount = this.subtotal * this.taxRate;
    this.totalAmount = this.subtotal + this.taxAmount;
    return {
      subtotal: this.subtotal,
      taxAmount: this.taxAmount,
      totalAmount: this.totalAmount
    };
  }

  // Add line item
  addLineItem(item) {
    this.lineItems.push({
      id: Date.now().toString(),
      description: item.description || '',
      quantity: item.quantity || 1,
      rate: item.rate || 0,
      amount: (item.quantity || 1) * (item.rate || 0),
      ...item
    });
    this.calculateTotals();
  }

  // Remove line item
  removeLineItem(itemId) {
    this.lineItems = this.lineItems.filter(item => item.id !== itemId);
    this.calculateTotals();
  }

  // Generate invoice number
  generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.invoiceNumber = `INV-${year}${month}-${random}`;
    return this.invoiceNumber;
  }

  // Check if invoice is overdue
  isOverdue() {
    if (this.status === 'paid' || this.status === 'cancelled') return false;
    if (!this.dueDate) return false;
    return new Date() > new Date(this.dueDate);
  }

  // Get status color for UI
  getStatusColor() {
    switch (this.status) {
      case 'paid': return 'green';
      case 'sent': return 'blue';
      case 'draft': return 'gray';
      case 'overdue': return 'red';
      case 'cancelled': return 'gray';
      default: return 'gray';
    }
  }

  // Get status text for UI
  getStatusText() {
    if (this.isOverdue() && this.status === 'sent') {
      return 'Overdue';
    }
    return this.status.charAt(0).toUpperCase() + this.status.slice(1);
  }

  // Validate invoice data
  validate() {
    const errors = [];
    
    if (!this.clientId) errors.push('Client ID is required');
    if (!this.freelancerId) errors.push('Freelancer ID is required');
    if (!this.projectId) errors.push('Project ID is required');
    if (!this.dueDate) errors.push('Due date is required');
    if (this.lineItems.length === 0) errors.push('At least one line item is required');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Convert to Firebase document
  toFirebase() {
    return {
      invoiceNumber: this.invoiceNumber,
      projectId: this.projectId,
      projectTitle: this.projectTitle,
      clientId: this.clientId,
      clientEmail: this.clientEmail,
      clientName: this.clientName,
      clientAddress: this.clientAddress,
      freelancerId: this.freelancerId,
      freelancerName: this.freelancerName,
      freelancerEmail: this.freelancerEmail,
      freelancerAddress: this.freelancerAddress,
      freelancerPhone: this.freelancerPhone,
      freelancerBusinessNumber: this.freelancerBusinessNumber,
      status: this.status,
      issueDate: this.issueDate,
      dueDate: this.dueDate,
      paidDate: this.paidDate,
      subtotal: this.subtotal,
      taxRate: this.taxRate,
      taxAmount: this.taxAmount,
      totalAmount: this.totalAmount,
      currency: this.currency,
      lineItems: this.lineItems,
      paymentTerms: this.paymentTerms,
      paymentMethod: this.paymentMethod,
      paymentReference: this.paymentReference,
      notes: this.notes,
      terms: this.terms,
      pdfUrl: this.pdfUrl,
      pdfGenerated: this.pdfGenerated,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      sentAt: this.sentAt,
      reminderSentAt: this.reminderSentAt
    };
  }

  // Create from Firebase document
  static fromFirebase(doc) {
    const data = doc.data();
    return new Invoice({
      id: doc.id,
      ...data
    });
  }

  // Create from transaction
  static fromTransaction(transaction, project, freelancer, client) {
    const invoice = new Invoice({
      projectId: transaction.projectId,
      projectTitle: transaction.projectTitle,
      clientId: transaction.clientId,
      clientEmail: transaction.clientEmail,
      clientName: client?.displayName || client?.email || 'Client',
      freelancerId: transaction.freelancerId,
      freelancerName: freelancer?.displayName || 'Freelancer',
      freelancerEmail: freelancer?.email || '',
      dueDate: transaction.dueDate,
      subtotal: transaction.amount,
      currency: transaction.currency
    });

    // Add line item from transaction
    invoice.addLineItem({
      description: transaction.description,
      quantity: transaction.hoursWorked || 1,
      rate: transaction.hourlyRate || transaction.amount
    });

    invoice.generateInvoiceNumber();
    return invoice;
  }
}

// Invoice Statuses
export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled'
};

// Payment Terms
export const PAYMENT_TERMS = {
  NET_15: 'Net 15',
  NET_30: 'Net 30',
  NET_45: 'Net 45',
  NET_60: 'Net 60',
  DUE_ON_RECEIPT: 'Due on Receipt'
};
