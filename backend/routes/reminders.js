const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const paymentReminderService = require('../services/paymentReminderService');

// Manually trigger reminder processing (for testing or manual runs)
router.post('/process', async (req, res) => {
  try {
    console.log('📨 Manually triggering payment reminder processing...');
    const result = await paymentReminderService.processReminders();
    res.json(result);
  } catch (error) {
    console.error('Error processing reminders:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get reminder settings for a user
router.get('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { projectId } = req.query;

    let query = db.collection('reminder_settings')
      .where('userId', '==', userId);

    if (projectId) {
      query = query.where('projectId', '==', projectId);
    } else {
      query = query.where('projectId', '==', null);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      // Return default settings
      res.json({
        success: true,
        data: {
          userId,
          projectId: projectId || null,
          enabled: true,
          beforeDueReminders: [7, 3, 1],
          overdueReminders: [1, 3, 7, 14, 30],
          sendWarningAt: 14,
          sendFinalNoticeAt: 30,
          reminderEmailSubject: 'Payment Reminder: Invoice {invoiceNumber}',
          warningEmailSubject: 'Payment Warning: Invoice {invoiceNumber} is Overdue',
          finalNoticeSubject: 'Final Notice: Invoice {invoiceNumber} - Immediate Action Required',
          customReminderMessage: '',
          customWarningMessage: '',
          customFinalNoticeMessage: '',
          ccFreelancer: false,
          pauseRemindersOnWeekends: false
        }
      });
    } else {
      const settingsDoc = snapshot.docs[0];
      res.json({
        success: true,
        data: {
          id: settingsDoc.id,
          ...settingsDoc.data()
        }
      });
    }
  } catch (error) {
    console.error('Error fetching reminder settings:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create or update reminder settings
router.post('/settings', async (req, res) => {
  try {
    const settingsData = req.body;
    
    // Validate required fields
    if (!settingsData.userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Check if settings already exist
    let query = db.collection('reminder_settings')
      .where('userId', '==', settingsData.userId);

    if (settingsData.projectId) {
      query = query.where('projectId', '==', settingsData.projectId);
    } else {
      query = query.where('projectId', '==', null);
    }

    const existingSnapshot = await query.get();

    let result;
    if (existingSnapshot.empty) {
      // Create new settings
      result = await db.collection('reminder_settings').add({
        ...settingsData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Reminder settings created:', result.id);
    } else {
      // Update existing settings
      const docId = existingSnapshot.docs[0].id;
      await db.collection('reminder_settings').doc(docId).update({
        ...settingsData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      result = { id: docId };
      console.log('✅ Reminder settings updated:', docId);
    }

    res.json({ 
      success: true, 
      id: result.id,
      message: 'Reminder settings saved successfully' 
    });
  } catch (error) {
    console.error('Error saving reminder settings:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Toggle reminder enabled/disabled
router.patch('/settings/:settingsId/toggle', async (req, res) => {
  try {
    const { settingsId } = req.params;
    const { enabled } = req.body;

    await db.collection('reminder_settings').doc(settingsId).update({
      enabled: enabled !== undefined ? enabled : true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Reminders ${enabled ? 'enabled' : 'disabled'}:`, settingsId);
    res.json({ 
      success: true, 
      message: `Reminders ${enabled ? 'enabled' : 'disabled'} successfully` 
    });
  } catch (error) {
    console.error('Error toggling reminder settings:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get reminder history for an invoice
router.get('/history/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const remindersSnapshot = await db.collection('payment_reminders')
      .where('invoiceId', '==', invoiceId)
      .orderBy('sentAt', 'desc')
      .get();

    const reminders = remindersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sentAt: doc.data().sentAt?.toDate ? doc.data().sentAt.toDate() : doc.data().sentAt
    }));

    res.json({ 
      success: true, 
      data: reminders 
    });
  } catch (error) {
    console.error('Error fetching reminder history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all reminders sent by a user
router.get('/history/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    // First get all invoices for this user
    const invoicesSnapshot = await db.collection('invoices')
      .where('freelancerId', '==', userId)
      .get();

    const invoiceIds = invoicesSnapshot.docs.map(doc => doc.id);

    if (invoiceIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Then get reminders for these invoices
    // Note: Firestore 'in' query supports max 10 items, so we need to batch
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < invoiceIds.length; i += batchSize) {
      const batch = invoiceIds.slice(i, i + batchSize);
      const batchQuery = db.collection('payment_reminders')
        .where('invoiceId', 'in', batch)
        .orderBy('sentAt', 'desc')
        .limit(parseInt(limit));
      
      batches.push(batchQuery.get());
    }

    const results = await Promise.all(batches);
    const reminders = [];
    
    results.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        reminders.push({
          id: doc.id,
          ...doc.data(),
          sentAt: doc.data().sentAt?.toDate ? doc.data().sentAt.toDate() : doc.data().sentAt
        });
      });
    });

    // Sort by date descending
    reminders.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    res.json({ 
      success: true, 
      data: reminders.slice(0, parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching user reminder history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send a manual reminder for a specific invoice
router.post('/send-manual', async (req, res) => {
  try {
    const { invoiceId, reminderType = 'reminder' } = req.body;

    // Get invoice
    const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invoice not found' 
      });
    }

    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() };

    // Get user's reminder settings
    const settingsSnapshot = await db.collection('reminder_settings')
      .where('userId', '==', invoice.freelancerId)
      .where('projectId', '==', null)
      .limit(1)
      .get();

    let settings = {};
    if (!settingsSnapshot.empty) {
      settings = settingsSnapshot.docs[0].data();
    } else {
      // Use default settings
      settings = {
        reminderEmailSubject: 'Payment Reminder: Invoice {invoiceNumber}',
        warningEmailSubject: 'Payment Warning: Invoice {invoiceNumber} is Overdue',
        finalNoticeSubject: 'Final Notice: Invoice {invoiceNumber}',
        customReminderMessage: '',
        customWarningMessage: '',
        customFinalNoticeMessage: '',
        ccFreelancer: false
      };
    }

    // Calculate days from due date
    const dueDate = invoice.dueDate.toDate ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
    const today = new Date();
    const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    // Send reminder
    const result = await paymentReminderService.sendReminder(
      invoice, 
      settings, 
      reminderType, 
      daysDiff
    );

    if (result.success) {
      res.json({ 
        success: true, 
        messageId: result.messageId,
        message: 'Manual reminder sent successfully' 
      });
    } else {
      throw new Error(result.error || 'Failed to send reminder');
    }
  } catch (error) {
    console.error('Error sending manual reminder:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
