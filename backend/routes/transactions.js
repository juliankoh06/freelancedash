const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { db } = require('../firebase-config');

// Get transactions by client ID
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { clientId, freelancerId } = req.query;
    
    if (!clientId && !freelancerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either clientId or freelancerId is required' 
      });
    }

    let transactionsQuery = db.collection('transactions');
    
    if (clientId) {
      // Ensure client can only access their own transactions
      if (req.user.role === 'client' && req.user.uid !== clientId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      transactionsQuery = transactionsQuery.where('clientId', '==', clientId);
    }
    
    if (freelancerId) {
      // Ensure freelancer can only access their own transactions
      if (req.user.role === 'freelancer' && req.user.uid !== freelancerId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      transactionsQuery = transactionsQuery.where('freelancerId', '==', freelancerId);
    }

    const transactionsSnapshot = await transactionsQuery.get();
    const transactions = transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const transactionDoc = await db.collection('transactions').doc(id).get();
    
    if (!transactionDoc.exists) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    const transaction = { id: transactionDoc.id, ...transactionDoc.data() };
    
    // Ensure user can only access their own transactions
    if (req.user.role === 'client' && transaction.clientId !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (req.user.role === 'freelancer' && transaction.freelancerId !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new transaction
router.post('/', authenticateToken, authorizeRole(['freelancer']), async (req, res) => {
  try {
    const transactionData = {
      ...req.body,
      freelancerId: req.user.uid,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const transactionRef = await db.collection('transactions').add(transactionData);
    
    res.status(201).json({ 
      success: true, 
      data: { id: transactionRef.id, ...transactionData } 
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update transaction
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const transactionDoc = await db.collection('transactions').doc(id).get();
    
    if (!transactionDoc.exists) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    const transaction = transactionDoc.data();
    
    // Ensure user can only update their own transactions
    if (req.user.role === 'freelancer' && transaction.freelancerId !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    await db.collection('transactions').doc(id).update(updateData);
    
    res.json({ 
      success: true, 
      data: { id, ...transaction, ...updateData } 
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete transaction
router.delete('/:id', authenticateToken, authorizeRole(['freelancer']), async (req, res) => {
  try {
    const { id } = req.params;
    const transactionDoc = await db.collection('transactions').doc(id).get();
    
    if (!transactionDoc.exists) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    const transaction = transactionDoc.data();
    
    // Ensure freelancer can only delete their own transactions
    if (transaction.freelancerId !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    await db.collection('transactions').doc(id).delete();
    
    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
