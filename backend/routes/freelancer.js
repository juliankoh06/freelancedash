const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');

// Get freelancer statistics
router.get('/stats', async (req, res) => {
  try {
    const { freelancerId } = req.query;

    if (!freelancerId) {
      return res.status(400).json({ error: 'Freelancer ID is required' });
    }

    // Get freelancer's projects
    const projectsSnapshot = await db.collection('projects')
      .where('freelancerId', '==', freelancerId)
      .get();

    const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculate stats
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === 'in-progress').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;

    // Calculate total earnings from completed projects
    const totalEarnings = projects
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.budget || 0), 0);

    res.json({
      totalProjects,
      activeProjects,
      completedProjects,
      totalEarnings
    });
  } catch (err) {
    console.error('Error fetching freelancer stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
