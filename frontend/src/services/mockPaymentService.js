import { addDoc, collection, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase-config';

class MockPaymentService {
  constructor() {
    this.paymentsCollection = 'payments';
    this.invoicesCollection = 'invoices';
    this.contractsCollection = 'contracts';
  }

  getInvoiceAmount(invoiceData) {
    const amount = Number(invoiceData?.totalAmount ?? invoiceData?.total ?? invoiceData?.amount ?? 0);
    return isNaN(amount) ? 0 : amount;
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
            const invoiceAmount = this.getInvoiceAmount(invoiceData);
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

      const invoiceAmount = this.getInvoiceAmount(invoiceData);
      const lateFee = daysOverdue > gracePeriod
        ? invoiceAmount * feePercentage / 100
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

      const baseAmount = this.getInvoiceAmount(invoiceData);
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
        requiresClientApproval: false,
        clientApproved: true,
        clientApprovedAt: paidAtDate,
        updatedAt: new Date()
      });

      // Update or create corresponding transaction entry
      try {
        let transactionId = invoiceData.transactionId || null;
        let transactionDocRef = transactionId ? doc(db, 'transactions', transactionId) : null;

        if (!transactionId) {
          // Try locating by invoiceId
          const byInvoiceIdQuery = query(
            collection(db, 'transactions'),
            where('invoiceId', '==', invoiceData.id)
          );
          const byInvoiceIdSnapshot = await getDocs(byInvoiceIdQuery);

          if (!byInvoiceIdSnapshot.empty) {
            transactionDocRef = byInvoiceIdSnapshot.docs[0].ref;
            transactionId = byInvoiceIdSnapshot.docs[0].id;
          }
        }

        if (!transactionId && invoiceData.invoiceNumber) {
          // Fallback to invoice number look-up
          const byInvoiceNumberQuery = query(
            collection(db, 'transactions'),
            where('invoiceNumber', '==', invoiceData.invoiceNumber)
          );
          const byInvoiceNumberSnapshot = await getDocs(byInvoiceNumberQuery);

          if (!byInvoiceNumberSnapshot.empty) {
            transactionDocRef = byInvoiceNumberSnapshot.docs[0].ref;
            transactionId = byInvoiceNumberSnapshot.docs[0].id;
          }
        }

        const transactionUpdateData = {
          status: 'paid',
          amount: totalAmount,
          baseAmount,
          lateFee,
          paymentMethod: paymentData.paymentMethod,
          paymentId: paymentRef.id,
          paidAt: paidAtDate,
          invoiceId: invoiceData.id,
          invoiceNumber: invoiceData.invoiceNumber || null,
          updatedAt: new Date(),
        };

        if (transactionDocRef) {
          await updateDoc(transactionDocRef, transactionUpdateData);
        } else {
          await addDoc(collection(db, 'transactions'), {
            ...transactionUpdateData,
            clientId: invoiceData.clientId || 'N/A',
            clientEmail: invoiceData.clientEmail || '',
            freelancerId: invoiceData.freelancerId || 'N/A',
            freelancerName: invoiceData.freelancerName || '',
            projectId: invoiceData.projectId || 'N/A',
            projectTitle: invoiceData.projectTitle || invoiceData.invoiceNumber || 'Invoice Payment',
            description: `Payment for invoice ${invoiceData.invoiceNumber || invoiceData.id}`,
            currency: invoiceData.currency || 'RM',
            type: 'payment',
            createdAt: new Date(),
          });
        }
      } catch (transactionError) {
        console.error('Error syncing transaction record:', transactionError);
        // Continue without failing the payment if transaction sync fails
      }

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
