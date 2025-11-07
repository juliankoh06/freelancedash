import { addDoc, collection, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase-config';

class MockPaymentService {
  constructor() {
    this.paymentsCollection = 'payments';
    this.invoicesCollection = 'invoices';
    this.contractsCollection = 'contracts';
  }

  // Calculate late fee based on contract policy or custom invoice policy
  async calculateLateFee(invoiceData, paidAtDate) {
    try {
      if (!invoiceData.dueDate) {
        return { isLate: false, lateFee: 0, daysOverdue: 0 };
      }

      const dueDate = invoiceData.dueDate.toDate ? invoiceData.dueDate.toDate() : new Date(invoiceData.dueDate);
      const daysOverdue = Math.floor((paidAtDate - dueDate) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        return { isLate: false, lateFee: 0, daysOverdue: 0 };
      }

      const isContractedInvoice = !!invoiceData.projectId;

      // Custom invoice
      if (!isContractedInvoice) {
        const defaultLateFeePolicy = invoiceData.lateFeePolicy || 'No late fees applied';
        let lateFee = 0;

        if (defaultLateFeePolicy.toLowerCase().includes('no late fee')) {
          return { isLate: true, lateFee: 0, daysOverdue, policy: defaultLateFeePolicy };
        }

        const percentMatch = defaultLateFeePolicy.match(/(\d+\.?\d*)%/);
        const daysMatch = defaultLateFeePolicy.match(/after (\d+) days?/i);

        if (percentMatch) {
          const feePercentage = parseFloat(percentMatch[1]);
          const gracePeriod = daysMatch ? parseInt(daysMatch[1]) : 0;
          if (daysOverdue > gracePeriod) {
            const invoiceAmount = invoiceData.total || invoiceData.amount || 0;
            lateFee = (invoiceAmount * feePercentage) / 100;
          }
        }

        return { isLate: true, lateFee: Math.round(lateFee * 100) / 100, daysOverdue };
      }

      // Contracted invoice
      const contractQuery = query(
        collection(db, this.contractsCollection),
        where('projectId', '==', invoiceData.projectId)
      );
      const contractSnapshot = await getDocs(contractQuery);

      if (contractSnapshot.empty) {
        return { isLate: true, lateFee: 0, daysOverdue };
      }

      const contract = contractSnapshot.docs[0].data();
      const lateFeePolicy = contract.lateFeePolicy || 'No late fees applied';

      if (lateFeePolicy.toLowerCase().includes('no late fee')) {
        return { isLate: true, lateFee: 0, daysOverdue };
      }

      const percentMatch = lateFeePolicy.match(/(\d+\.?\d*)%/);
      const daysMatch = lateFeePolicy.match(/after (\d+) days?/i);

      if (!percentMatch) {
        return { isLate: true, lateFee: 0, daysOverdue };
      }

      const feePercentage = parseFloat(percentMatch[1]);
      const gracePeriod = daysMatch ? parseInt(daysMatch[1]) : 0;

      const lateFee = daysOverdue > gracePeriod
        ? (invoiceData.total || invoiceData.amount || 0) * feePercentage / 100
        : 0;

      return { isLate: true, lateFee: Math.round(lateFee * 100) / 100, daysOverdue };

    } catch (error) {
      console.error('Error calculating late fee:', error);
      return { isLate: false, lateFee: 0, daysOverdue: 0 };
    }
  }

  // Process mock payment
  async processPayment(paymentData, invoiceData) {
    try {
      if (!invoiceData || !invoiceData.id) throw new Error('Invalid invoice data');

      const paidAtDate = paymentData.paidAt instanceof Date ? paymentData.paidAt : new Date();
      const lateFeeInfo = await this.calculateLateFee(invoiceData, paidAtDate);

      const baseAmount = paymentData.amount;
      const lateFee = lateFeeInfo.lateFee || 0;
      const totalAmount = baseAmount + lateFee;

      // Payment document with only essential fields
      const paymentRecord = {
        invoiceId: invoiceData.id,
        projectId: invoiceData.projectId || 'N/A',
        clientId: invoiceData.clientId || 'N/A',
        freelancerId: invoiceData.freelancerId || 'N/A',
        baseAmount,
        lateFee,
        amount: totalAmount,
        status: 'completed',
        paymentMethod: paymentData.paymentMethod,
        isLatePayment: lateFeeInfo.isLate || false,
        daysOverdue: lateFeeInfo.daysOverdue || 0,
        createdAt: new Date()
      };

      const paymentRef = await addDoc(collection(db, this.paymentsCollection), paymentRecord);

      // Update invoice
      await updateDoc(doc(db, this.invoicesCollection, invoiceData.id), {
        status: 'paid',
        paidDate: paidAtDate,
        paidAmount: totalAmount,
        lateFeeApplied: lateFee,
        isLatePayment: lateFeeInfo.isLate || false,
        daysOverdue: lateFeeInfo.daysOverdue || 0,
        paymentMethod: paymentData.paymentMethod,
        updatedAt: new Date()
      });

      // Send payment notification email to freelancer
      try {
        const response = await fetch('http://localhost:5000/api/payments/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId: invoiceData.id,
            paymentId: paymentRef.id
          })
        });
        
        if (response.ok) {
          console.log('Payment notification email sent to freelancer');
        } else {
          console.error('Failed to send payment notification email');
        }
      } catch (emailError) {
        console.error('Error sending payment notification:', emailError);
        // Don't fail the payment if email fails
      }

      return {
        success: true,
        paymentId: paymentRef.id,
        totalAmount,
        lateFeeInfo,
        message: 'Payment processed successfully'
      };

    } catch (error) {
      console.error('Error processing payment:', error);
      throw new Error(`Payment failed: ${error.message}`);
    }
  }




}

const mockPaymentService = new MockPaymentService();
export default mockPaymentService;
