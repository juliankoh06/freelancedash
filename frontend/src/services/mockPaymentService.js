import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase-config';

class MockPaymentService {
  constructor() {
    this.paymentsCollection = 'payments';
    this.transactionsCollection = 'transactions';
    this.invoicesCollection = 'invoices';
  }

  // Process mock payment
  async processPayment(paymentData, invoiceData) {
    try {
      // Validate invoice data
      if (!invoiceData || !invoiceData.id) {
        throw new Error('Invalid invoice data provided');
      }

      // Ensure we have a valid paidAt date
      const paidAtDate = paymentData.paidAt instanceof Date ? paymentData.paidAt : new Date();

      // Ensure we have valid payment details
      const paymentDetails = paymentData.details || paymentData.paymentDetails || {};
      
      // 1. Create payment record
      const paymentRecord = {
        invoiceId: invoiceData.id,
        invoiceNumber: invoiceData.invoiceNumber || 'N/A',
        projectId: invoiceData.projectId || 'N/A',
        projectTitle: invoiceData.projectTitle || 'Untitled Project',
        clientId: invoiceData.clientId || 'N/A',
        clientEmail: invoiceData.clientEmail || 'N/A',
        freelancerId: invoiceData.freelancerId || 'N/A',
        freelancerName: invoiceData.freelancerName || 'N/A',
        amount: paymentData.amount,
        currency: invoiceData.currency || 'RM',
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentId || paymentData.reference || 'N/A',
        status: 'completed',
        paidAt: paidAtDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: `Mock payment via ${paymentData.paymentMethod}`,
        paymentDetails: paymentDetails
      };

      const paymentRef = await addDoc(collection(db, this.paymentsCollection), paymentRecord);

      // 2. Update invoice status to paid
      await updateDoc(doc(db, this.invoicesCollection, invoiceData.id), {
        status: 'paid',
        paidDate: paidAtDate,
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentId || paymentData.reference || 'N/A',
        updatedAt: new Date()
      });

      // 3. Create or update transaction record
      const transactionData = {
        projectId: invoiceData.projectId || 'N/A',
        projectTitle: invoiceData.projectTitle || 'Untitled Project',
        clientId: invoiceData.clientId || 'N/A',
        clientEmail: invoiceData.clientEmail || 'N/A',
        freelancerId: invoiceData.freelancerId || 'N/A',
        freelancerName: invoiceData.freelancerName || 'N/A',
        type: 'payment',
        amount: paymentData.amount,
        currency: invoiceData.currency || 'RM',
        description: `Payment for invoice ${invoiceData.invoiceNumber || 'N/A'}`,
        status: 'paid',
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentId || paymentData.reference || 'N/A',
        paidAt: paidAtDate,
        dueDate: invoiceData.dueDate,
        invoiceId: invoiceData.id,
        invoiceNumber: invoiceData.invoiceNumber || 'N/A',
        invoiceGenerated: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: `Mock payment processed via ${paymentData.paymentMethod}`,
        tags: ['mock-payment', 'invoice-payment']
      };

      const transactionRef = await addDoc(collection(db, this.transactionsCollection), transactionData);

      // 4. Update project status if all invoices are paid
      await this.updateProjectStatusIfFullyPaid(invoiceData.projectId);

      return {
        success: true,
        paymentId: paymentRef.id,
        transactionId: transactionRef.id,
        message: 'Payment processed successfully'
      };

    } catch (error) {
      console.error('Error processing mock payment:', error);
      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }

  // Update project status if all invoices are paid
  async updateProjectStatusIfFullyPaid(projectId) {
    try {
      // This would check if all invoices for the project are paid
      // For now, we'll just log this functionality
      console.log('Checking if project is fully paid:', projectId);
      // Implementation would query all invoices for the project
      // and update project status if all are paid
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  }

  // Get payment history for a client
  async getClientPayments(clientId) {
    try {
      const { getDocs, query, collection, where, orderBy } = await import('firebase/firestore');
      
      const q = query(
        collection(db, this.paymentsCollection),
        where('clientId', '==', clientId),
        orderBy('paidAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return { success: true, payments };
    } catch (error) {
      console.error('Error fetching client payments:', error);
      throw error;
    }
  }

  // Get payment history for a freelancer
  async getFreelancerPayments(freelancerId) {
    try {
      const { getDocs, query, collection, where, orderBy } = await import('firebase/firestore');
      
      const q = query(
        collection(db, this.paymentsCollection),
        where('freelancerId', '==', freelancerId),
        orderBy('paidAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return { success: true, payments };
    } catch (error) {
      console.error('Error fetching freelancer payments:', error);
      throw error;
    }
  }

  // Get payment statistics
  async getPaymentStats(userId, userType = 'client') {
    try {
      const payments = userType === 'client' 
        ? await this.getClientPayments(userId)
        : await this.getFreelancerPayments(userId);

      if (!payments.success) {
        throw new Error('Failed to fetch payments');
      }

      const totalPayments = payments.payments.length;
      const totalAmount = payments.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const completedPayments = payments.payments.filter(p => p.status === 'completed').length;
      const pendingPayments = payments.payments.filter(p => p.status === 'pending').length;

      return {
        success: true,
        stats: {
          totalPayments,
          totalAmount,
          completedPayments,
          pendingPayments,
          averageAmount: totalPayments > 0 ? totalAmount / totalPayments : 0
        }
      };
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      throw error;
    }
  }
}

export default new MockPaymentService();
