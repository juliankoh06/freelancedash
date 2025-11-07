const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase-admin');
const financialCalculationService = require('../services/financialCalculationService');
const dataConsistencyService = require('../services/dataConsistencyService');
const { authenticateToken } = require('../middleware/auth');

// Get project financials
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    // Verify user has access to this project
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const projectData = projectDoc.data();
    if (projectData.freelancerId !== userId && projectData.clientId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const financials = await financialCalculationService.calculateProjectFinancials(projectId);
    res.json({ success: true, data: financials });
  } catch (error) {
    console.error('Error getting project financials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get freelancer financials
router.get('/freelancer/:freelancerId', authenticateToken, async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const { timeRange = 'month' } = req.query;
    const userId = req.user.uid;

    // Verify user can access this data
    if (freelancerId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const financials = await financialCalculationService.calculateFreelancerFinancials(freelancerId, timeRange);
    res.json({ success: true, data: financials });
  } catch (error) {
    console.error('Error getting freelancer financials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get financial dashboard
router.get('/dashboard/:freelancerId', authenticateToken, async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const userId = req.user.uid;

    // Verify user can access this data
    if (freelancerId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const dashboard = await financialCalculationService.getFinancialDashboard(freelancerId);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error('Error getting financial dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate financial consistency
router.get('/validate/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    // Verify user has access to this project
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const projectData = projectDoc.data();
    if (projectData.freelancerId !== userId && projectData.clientId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const validation = await financialCalculationService.validateFinancialConsistency(projectId);
    res.json({ success: true, data: validation });
  } catch (error) {
    console.error('Error validating financial consistency:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Recalculate project financials
router.post('/recalculate/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    // Verify user has access to this project
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const projectData = projectDoc.data();
    if (projectData.freelancerId !== userId) {
      return res.status(403).json({ success: false, error: 'Only freelancers can recalculate financials' });
    }

    const financials = await financialCalculationService.recalculateProjectFinancials(projectId);
    res.json({ success: true, data: financials });
  } catch (error) {
    console.error('Error recalculating project financials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check data consistency
router.get('/consistency/check', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Only allow freelancers to check data consistency
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data().role !== 'freelancer') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const consistency = await dataConsistencyService.checkDataConsistency();
    res.json({ success: true, data: consistency });
  } catch (error) {
    console.error('Error checking data consistency:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fix data consistency issues
router.post('/consistency/fix', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Only allow freelancers to fix data consistency
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data().role !== 'freelancer') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await dataConsistencyService.fixDataConsistency();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fixing data consistency:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
