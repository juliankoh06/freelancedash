const express = require('express');
const router = express.Router();
const { db } = require('../firebase-config');

// Get freelancer stats
router.get('/stats', async (req, res) => {
  try {
    const { freelancerId } = req.query;

    if (!freelancerId) {
      return res.status(400).json({ error: 'Freelancer ID is required' });
    }

    // Get projects count
    const projectsSnapshot = await db.collection('projects')
      .where('freelancerId', '==', freelancerId)
      .get();

    const activeProjects = projectsSnapshot.docs.filter(doc => doc.data().status === 'active').length;
    
    // Get pending invoices
    const invoicesSnapshot = await db.collection('invoices')
      .where('freelancerId', '==', freelancerId)
      .where('status', '==', 'pending')
      .get();

    // Calculate monthly earnings
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const earningsSnapshot = await db.collection('payments')
      .where('freelancerId', '==', freelancerId)
      .where('status', '==', 'paid')
      .where('paidAt', '>=', firstDayOfMonth)
      .get();

    const monthlyEarnings = earningsSnapshot.docs.reduce((total, doc) => {
      return total + (doc.data().amount || 0);
    }, 0);

    res.json({
      totalProjects: projectsSnapshot.size,
      activeProjects,
      pendingInvoices: invoicesSnapshot.size,
      monthlyEarnings
    });
  } catch (error) {
    console.error('Error fetching freelancer stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;