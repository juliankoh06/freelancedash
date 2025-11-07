import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  onSnapshot 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase-config';
import { Invoice, INVOICE_STATUSES } from '../models/Invoice';

class InvoiceService {
  constructor() {
    this.collectionName = 'invoices';
  }

  // Create a new invoice with server-side validation
  async createInvoice(invoiceData) {
    try {
      // Send to backend for server-side validation and calculation
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify(invoiceData)
      });

      if (!response.ok) {
        // Try to parse JSON error, but fall back to text when server returns HTML or plain text
        let errText = null;
        try {
          const errorData = await response.json();
          errText = errorData.error || JSON.stringify(errorData);
        } catch (parseErr) {
          try {
            errText = await response.text();
          } catch (tErr) {
            errText = `HTTP ${response.status} ${response.statusText}`;
          }
        }
        throw new Error(errText || `Failed to create invoice (status ${response.status})`);
      }

      const result = await response.json();
      console.log('✅ Invoice created with server validation:', result.data);
      return { success: true, id: result.data.id, invoice: result.data };
    } catch (error) {
      console.error('❌ Error creating invoice:', error);
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

  // Create invoice from transaction
  async createInvoiceFromTransaction(transaction, project, freelancer, client) {
    try {
      console.log('🔍 Creating invoice from transaction:', transaction);
      
      const invoice = Invoice.fromTransaction(transaction, project, freelancer, client);
      const result = await this.createInvoice(invoice);
      
      if (result.success) {
        // Update transaction with invoice reference
        await this.updateTransactionInvoiceReference(transaction.id, result.id, invoice.invoiceNumber);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error creating invoice from transaction:', error);
      throw error;
    }
  }

  // Update transaction with invoice reference
  async updateTransactionInvoiceReference(transactionId, invoiceId, invoiceNumber) {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'transactions', transactionId), {
        invoiceId: invoiceId,
        invoiceNumber: invoiceNumber,
        invoiceGenerated: true,
        updatedAt: new Date()
      });
      console.log('✅ Transaction updated with invoice reference');
    } catch (error) {
      console.error('❌ Error updating transaction with invoice reference:', error);
    }
  }

  // Get invoices for a specific project
  async getProjectInvoices(projectId) {
    try {
      console.log('🔍 Fetching invoices for project:', projectId);
      
      let snapshot;
      
      // Try with orderBy first (requires index)
      try {
        const q = query(
          collection(db, this.collectionName),
          where('projectId', '==', projectId),
          orderBy('createdAt', 'desc')
        );
        snapshot = await getDocs(q);
      } catch (orderByError) {
        // If orderBy fails (missing index), fall back to basic query
        if (orderByError.code === 'failed-precondition') {
          console.warn('⚠️ Index missing, fetching without sort:', orderByError.message);
          const q = query(
            collection(db, this.collectionName),
            where('projectId', '==', projectId)
          );
          snapshot = await getDocs(q);
        } else {
          throw orderByError;
        }
      }
      
      const invoices = snapshot.docs.map(doc => 
        Invoice.fromFirebase(doc)
      );
      
      // Sort manually if we used the fallback query
      if (!snapshot.empty && invoices.length > 0) {
        const firstDoc = snapshot.docs[0];
        const firstData = firstDoc.data();
        // If createdAt exists but we couldn't use orderBy, sort manually
        if (firstData.createdAt) {
          invoices.sort((a, b) => {
            const getTime = (date) => {
              if (!date) return 0;
              // Handle Firestore Timestamp
              if (date.toMillis && typeof date.toMillis === 'function') return date.toMillis();
              // Handle Date object
              if (date instanceof Date) return date.getTime();
              // Handle string
              if (typeof date === 'string') return new Date(date).getTime();
              // Handle number
              if (typeof date === 'number') return date;
              return 0;
            };
            return getTime(b.createdAt) - getTime(a.createdAt); // Descending
          });
        }
      }
      
      console.log('✅ Fetched project invoices:', invoices.length);
      return { success: true, invoices };
    } catch (error) {
      console.error('❌ Error fetching project invoices:', error);
      throw error;
    }
  }

  // Get invoices for a freelancer
  async getFreelancerInvoices(freelancerId) {
    try {
      console.log('🔍 Fetching invoices for freelancer:', freelancerId);
      
      const q = query(
        collection(db, this.collectionName),
        where('freelancerId', '==', freelancerId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const invoices = snapshot.docs.map(doc => 
        Invoice.fromFirebase(doc)
      );
      
      console.log('✅ Fetched freelancer invoices:', invoices.length);
      return { success: true, invoices };
    } catch (error) {
      console.error('❌ Error fetching freelancer invoices:', error);
      throw error;
    }
  }


  // Get invoices for a client
  async getClientInvoices(clientId) {
    try {
      console.log('🔍 Fetching invoices for client:', clientId);
      
      const q = query(
        collection(db, this.collectionName),
        where('clientId', '==', clientId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const invoices = snapshot.docs.map(doc => 
        Invoice.fromFirebase(doc)
      );
      
      console.log('✅ Fetched client invoices:', invoices.length);
      return { success: true, invoices };
    } catch (error) {
      console.error('❌ Error fetching client invoices:', error);
      throw error;
    }
  }

  // Update invoice status
  async updateInvoiceStatus(invoiceId, status, paymentData = {}) {
    try {
      console.log('🔍 Updating invoice status:', { invoiceId, status, paymentData });
      
      const updateData = {
        status,
        updatedAt: new Date(),
        ...paymentData
      };

      if (status === INVOICE_STATUSES.PAID) {
        updateData.paidDate = new Date();
      } else if (status === INVOICE_STATUSES.SENT) {
        updateData.sentAt = new Date();
      }

      await updateDoc(doc(db, this.collectionName, invoiceId), updateData);
      
      console.log('✅ Invoice status updated');
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating invoice status:', error);
      throw error;
    }
  }

  // Delete invoice
  async deleteInvoice(invoiceId) {
    try {
      console.log('🔍 Deleting invoice:', invoiceId);
      
      await deleteDoc(doc(db, this.collectionName, invoiceId));
      
      console.log('✅ Invoice deleted');
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting invoice:', error);
      throw error;
    }
  }

  // Get invoice statistics
  async getInvoiceStats(userId, userType = 'freelancer') {
    try {
      console.log('🔍 Fetching invoice stats for:', { userId, userType });
      
      const fieldName = userType === 'freelancer' ? 'freelancerId' : 'clientId';
      const q = query(
        collection(db, this.collectionName),
        where(fieldName, '==', userId)
      );
      
      const snapshot = await getDocs(q);
      const invoices = snapshot.docs.map(doc => 
        Invoice.fromFirebase(doc)
      );
      
      const stats = {
        total: invoices.length,
        draft: invoices.filter(i => i.status === INVOICE_STATUSES.DRAFT).length,
        sent: invoices.filter(i => i.status === INVOICE_STATUSES.SENT).length,
        paid: invoices.filter(i => i.status === INVOICE_STATUSES.PAID).length,
        overdue: invoices.filter(i => i.isOverdue()).length,
        totalAmount: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
        paidAmount: invoices
          .filter(i => i.status === INVOICE_STATUSES.PAID)
          .reduce((sum, i) => sum + i.totalAmount, 0),
        pendingAmount: invoices
          .filter(i => i.status === INVOICE_STATUSES.SENT)
          .reduce((sum, i) => sum + i.totalAmount, 0)
      };
      
      console.log('✅ Invoice stats calculated:', stats);
      return { success: true, stats };
    } catch (error) {
      console.error('❌ Error fetching invoice stats:', error);
      throw error;
    }
  }

  // Generate PDF (placeholder - would integrate with actual PDF generation)
  async generateInvoicePDF(invoiceId) {
    try {
      console.log('🔍 Generating PDF for invoice:', invoiceId);
      
      // This would integrate with a PDF generation service
      // For now, we'll just mark it as generated
      await updateDoc(doc(db, this.collectionName, invoiceId), {
        pdfGenerated: true,
        pdfUrl: `https://example.com/invoices/${invoiceId}.pdf`,
        updatedAt: new Date()
      });
      
      console.log('✅ Invoice PDF generated');
      return { success: true, pdfUrl: `https://example.com/invoices/${invoiceId}.pdf` };
    } catch (error) {
      console.error('❌ Error generating invoice PDF:', error);
      throw error;
    }
  }

  // Send invoice email via backend API
  async sendInvoiceEmail(invoiceId) {
    try {
      console.log('🔍 Sending invoice email for:', invoiceId);

      // Get invoice data first
      const invoiceDoc = await getDoc(doc(db, this.collectionName, invoiceId));
      if (!invoiceDoc.exists()) {
        throw new Error('Invoice not found');
      }

      const invoiceData = { id: invoiceDoc.id, ...invoiceDoc.data() };

      // Generate PDF for attachment using FileReader for base64
      let pdfAttachment = null;
      try {
        const { InvoicePDFGenerator } = await import('../utils/pdfGenerator');
        const pdfGenerator = new InvoicePDFGenerator();
        const pdfBlob = pdfGenerator.generatePDFBlob(invoiceData);

        // Convert blob to base64 using FileReader
        pdfAttachment = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            // reader.result is a data URL: "data:application/pdf;base64,..."
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError);
        // Continue without PDF attachment
        pdfAttachment = null;
      }

      const response = await fetch('http://localhost:5000/api/email/send-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoiceId,
          clientEmail: invoiceData.clientEmail,
          invoiceData: {
            invoiceNumber: invoiceData.invoiceNumber,
            projectTitle: invoiceData.projectTitle,
            issueDate: invoiceData.issueDate,
            dueDate: invoiceData.dueDate,
            clientName: invoiceData.clientName,
            freelancerName: invoiceData.freelancerName,
            lineItems: invoiceData.lineItems,
            subtotal: invoiceData.subtotal,
            taxAmount: invoiceData.taxAmount,
            totalAmount: invoiceData.totalAmount,
            currency: invoiceData.currency,
            paymentTerms: invoiceData.paymentTerms,
            notes: invoiceData.notes,
            terms: invoiceData.terms,
            pdfAttachment: pdfAttachment
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        // Update invoice status in Firestore
        await updateDoc(doc(db, this.collectionName, invoiceId), {
          status: INVOICE_STATUSES.SENT,
          sentAt: new Date(),
          emailMessageId: result.messageId,
          updatedAt: new Date()
        });

        console.log('✅ Invoice email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('❌ Error sending invoice email:', error);
      throw error;
    }
  }

  // Send follow-up email for unpaid invoices
  async sendFollowUpEmail(invoiceId, followUpType = 'reminder') {
    try {
      console.log('🔍 Sending follow-up email for:', invoiceId, 'Type:', followUpType);
      
      // Get invoice data first
      const invoiceDoc = await getDoc(doc(db, this.collectionName, invoiceId));
      if (!invoiceDoc.exists()) {
        throw new Error('Invoice not found');
      }
      
      const invoiceData = { id: invoiceDoc.id, ...invoiceDoc.data() };
      
      // Call backend follow-up email API
      const response = await fetch('http://localhost:5000/api/email/send-followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoiceId,
          clientEmail: invoiceData.clientEmail,
          followUpType: followUpType,
          invoiceData: {
            invoiceNumber: invoiceData.invoiceNumber,
            projectTitle: invoiceData.projectTitle,
            total: invoiceData.totalAmount,
            dueDate: invoiceData.dueDate,
            clientName: invoiceData.clientName,
            freelancerName: invoiceData.freelancerName
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Follow-up email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
      } else {
        throw new Error(result.error || 'Failed to send follow-up email');
      }
    } catch (error) {
      console.error('❌ Error sending follow-up email:', error);
      throw error;
    }
  }

  // Check and send follow-up emails for unpaid invoices
  async checkUnpaidInvoices(freelancerId) {
    try {
      console.log('🔍 Checking unpaid invoices for freelancer:', freelancerId);
      
      const response = await fetch('http://localhost:5000/api/email/check-unpaid-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          freelancerId: freelancerId
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Unpaid invoice check completed:', result.message);
        return { success: true, message: result.message };
      } else {
        throw new Error(result.error || 'Failed to check unpaid invoices');
      }
    } catch (error) {
      console.error('❌ Error checking unpaid invoices:', error);
      throw error;
    }
  }

  // Listen to real-time invoice updates
  subscribeToInvoices(userId, userType = 'freelancer', callback) {
    console.log('🔍 Subscribing to invoices for:', { userId, userType });
    
    const fieldName = userType === 'freelancer' ? 'freelancerId' : 'clientId';
    const q = query(
      collection(db, this.collectionName),
      where(fieldName, '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const invoices = snapshot.docs.map(doc => 
        Invoice.fromFirebase(doc)
      );
      callback(invoices);
    });
  }
}

const invoiceService = new InvoiceService();
export default invoiceService;
