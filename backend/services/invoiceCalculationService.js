const { admin, db } = require('../firebase-admin');

class InvoiceCalculationService {
  constructor() {
    this.db = db;
  }

  // Server-side invoice calculation with validation
  async calculateInvoiceTotals(lineItems, taxRate = 0.06) {
    try {
      // Validate line items
      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        throw new Error('At least one line item is required');
      }

      let subtotal = 0;
      const validatedLineItems = [];

      for (const item of lineItems) {
        // Validate each line item
        if (!item.description || item.description.trim() === '') {
          throw new Error('Line item description is required');
        }
        
        const quantity = parseFloat(item.quantity);
        const rate = parseFloat(item.rate);
        
        if (isNaN(quantity) || quantity < 0) {
          throw new Error('Line item quantity cannot be negative');
        }
        
        if (isNaN(rate) || rate < 0) {
          throw new Error('Line item rate cannot be negative');
        }

        const amount = quantity * rate;
        subtotal += amount;

        validatedLineItems.push({
          description: item.description.trim(),
          quantity,
          rate,
          amount
        });
      }

      // Calculate tax and total
      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + taxAmount;

      return {
        subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimal places
        taxRate,
        taxAmount: Math.round(taxAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        lineItems: validatedLineItems
      };
    } catch (error) {
      console.error('Error calculating invoice totals:', error);
      throw error;
    }
  }

  // Validate invoice data
  async validateInvoiceData(invoiceData) {
    const errors = [];

    // Required fields validation
    // projectId is now optional for custom invoices
    if (!invoiceData.clientEmail) errors.push('Client email is required');
    if (!invoiceData.freelancerId) errors.push('Freelancer ID is required');
    if (!invoiceData.dueDate) errors.push('Due date is required');

    // Validate dates
    if (invoiceData.issueDate && invoiceData.dueDate) {
      const issueDate = new Date(invoiceData.issueDate);
      const dueDate = new Date(invoiceData.dueDate);
      
      if (dueDate <= issueDate) {
        errors.push('Due date must be after issue date');
      }
    }

    // Validate line items
    if (!invoiceData.lineItems || invoiceData.lineItems.length === 0) {
      errors.push('At least one line item is required');
    }

    // Validate project exists and user has access
    if (invoiceData.projectId) {
      try {
        const projectDoc = await this.db.collection('projects').doc(invoiceData.projectId).get();
        if (!projectDoc.exists) {
          errors.push('Project not found');
        } else {
          const projectData = projectDoc.data();
          if (projectData.freelancerId !== invoiceData.freelancerId) {
            errors.push('Access denied: You can only create invoices for your own projects');
          }
        }
      } catch (error) {
        errors.push('Error validating project access');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Create invoice with server-side validation
  async createInvoice(invoiceData) {
    try {
      // Validate invoice data
      const validation = await this.validateInvoiceData(invoiceData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Calculate totals server-side
      const calculations = await this.calculateInvoiceTotals(
        invoiceData.lineItems, 
        invoiceData.taxRate || 0.06
      );

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();

      // Create invoice document
      const invoice = {
        ...invoiceData,
        ...calculations,
        invoiceNumber,
        status: 'sent', // Set to 'sent' so payment button appears for clients
        requiresClientApproval: true,
        clientApproved: false,
        clientApprovedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('invoices').add(invoice);
      
      // Log audit trail
      await this.logAuditEvent('invoice_created', {
        invoiceId: docRef.id,
        projectId: invoiceData.projectId,
        freelancerId: invoiceData.freelancerId,
        totalAmount: calculations.totalAmount,
        totalHours: invoiceData.totalHours || 0
      });

      return {
        success: true,
        id: docRef.id,
        invoice: { ...invoice, id: docRef.id }
      };
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  // Generate unique invoice number
  async generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get count of invoices this month
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0);
    
    const snapshot = await this.db.collection('invoices')
      .where('createdAt', '>=', startOfMonth)
      .where('createdAt', '<=', endOfMonth)
      .get();
    
    const count = snapshot.size + 1;
    return `INV-${year}${month}-${String(count).padStart(4, '0')}`;
  }

  // Client approval for invoice
  async approveInvoice(invoiceId, clientId) {
    try {
      const invoiceDoc = await this.db.collection('invoices').doc(invoiceId).get();
      if (!invoiceDoc.exists) {
        throw new Error('Invoice not found');
      }

      const invoiceData = invoiceDoc.data();
      
      // Verify client has access to this invoice
      const projectDoc = await this.db.collection('projects').doc(invoiceData.projectId).get();
      const projectData = projectDoc.data();
      
      if (projectData.clientId !== clientId && projectData.clientEmail !== invoiceData.clientEmail) {
        throw new Error('Access denied: You can only approve invoices for your projects');
      }

      // Update invoice status
      await this.db.collection('invoices').doc(invoiceId).update({
        clientApproved: true,
        clientApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'approved',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log audit trail
      await this.logAuditEvent('invoice_approved', {
        invoiceId,
        projectId: invoiceData.projectId,
        clientId,
        totalAmount: invoiceData.totalAmount
      });

      return { success: true };
    } catch (error) {
      console.error('Error approving invoice:', error);
      throw error;
    }
  }

  // Log audit events
  async logAuditEvent(eventType, data) {
    try {
      await this.db.collection('audit_logs').add({
        eventType,
        data,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: data.freelancerId || data.clientId
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }
}

module.exports = InvoiceCalculationService;
