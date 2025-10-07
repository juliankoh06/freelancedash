const express = require('express');
const router = express.Router();
const { db } = require('../firebase-config');

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
    const paymentRef = await db.collection('payments').add({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    res.json({ success: true, data: { id: paymentRef.id, ...req.body } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
