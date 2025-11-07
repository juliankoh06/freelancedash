const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');

// Get all payments
router.get('/', async (req, res) => {
  try {
    const { clientId } = req.query;
    
    let query = db.collection('payments');
    
    if (clientId) {
      query = query.where('clientId', '==', clientId);
    }
    
    const snapshot = await query.get();
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get payments by client ID
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const snapshot = await db.collection('payments').where('clientId', '==', clientId).get();
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new payment
router.post('/', async (req, res) => {
  try {
    const paymentData = req.body;
    const paymentRef = await db.collection('payments').add({
      ...paymentData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Send payment received email to freelancer
    await sendPaymentNotification(paymentData);
    
    res.json({ success: true, data: { id: paymentRef.id, ...paymentData } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send payment notification email (can be called separately)
router.post('/notify', async (req, res) => {
  try {
    const { invoiceId, paymentId } = req.body;
    
    let paymentData = {};
    
    // If paymentId provided, fetch payment data
    if (paymentId) {
      const paymentDoc = await db.collection('payments').doc(paymentId).get();
      if (paymentDoc.exists) {
        paymentData = paymentDoc.data();
      }
    }
    
    // If invoiceId provided, fetch invoice and use that
    if (invoiceId) {
      const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
      if (invoiceDoc.exists) {
        const invoice = invoiceDoc.data();
        paymentData = {
          ...paymentData,
          invoiceId: invoiceId,
          freelancerId: invoice.freelancerId,
          amount: invoice.paidAmount || invoice.totalAmount || invoice.total,
          clientId: invoice.clientId
        };
      }
    }
    
    await sendPaymentNotification(paymentData);
    
    res.json({ success: true, message: 'Payment notification sent' });
  } catch (error) {
    console.error('Error sending payment notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to send payment notification
async function sendPaymentNotification(paymentData) {
  try {
    const { sendPaymentReceivedEmail } = require('../services/emailService');
    
    // Fetch freelancer details
    let freelancerData = {};
    if (paymentData.freelancerId && paymentData.freelancerId !== 'N/A') {
      const freelancerDoc = await db.collection('users').doc(paymentData.freelancerId).get();
      if (freelancerDoc.exists) {
        const fData = freelancerDoc.data();
        freelancerData = {
          freelancerEmail: fData.email,
          freelancerName: fData.fullName || fData.username || 'Freelancer'
        };
      }
    }

    // Fetch invoice details if invoiceId provided
    let invoiceData = {};
    let clientData = {};
    if (paymentData.invoiceId && paymentData.invoiceId !== 'N/A') {
      const invoiceDoc = await db.collection('invoices').doc(paymentData.invoiceId).get();
      if (invoiceDoc.exists) {
        const iData = invoiceDoc.data();
        invoiceData = {
          invoiceNumber: iData.invoiceNumber,
          projectTitle: iData.projectTitle || 'Project'
        };
        
        // Fetch client name from invoice's clientId
        if (iData.clientId) {
          const clientDoc = await db.collection('users').doc(iData.clientId).get();
          if (clientDoc.exists) {
            const cData = clientDoc.data();
            clientData = {
              clientName: cData.fullName || cData.username || 'Client'
            };
          }
        }
      }
    }

    if (freelancerData.freelancerEmail) {
      await sendPaymentReceivedEmail({
        ...freelancerData,
        ...invoiceData,
        ...clientData,
        amount: paymentData.amount || paymentData.totalAmount,
        clientName: clientData.clientName || paymentData.clientName || 'Client',
        paymentDate: paymentData.createdAt || paymentData.paymentDate || new Date()
      });
      console.log('Payment received email sent to freelancer:', freelancerData.freelancerEmail);
    } else {
      console.log('No freelancer email found, skipping notification');
    }
  } catch (emailError) {
    console.error('Failed to send payment received email:', emailError);
  }
}

// Update payment
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('payments').doc(id).update({
      ...req.body,
      updatedAt: new Date()
    });
    
    res.json({ success: true, message: 'Payment updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete payment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('payments').doc(id).delete();
    
    res.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
