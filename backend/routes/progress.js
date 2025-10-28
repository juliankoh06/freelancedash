const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const progressTrackingService = require('../services/progressTrackingService');
const { authenticateToken } = require('../middleware/auth');

// Update task progress
router.post('/task/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const progressData = req.body;
    const userId = req.user.uid;

    const result = await progressTrackingService.updateTaskProgress(taskId, progressData, userId);
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error updating task progress:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Verify progress update (client only)
router.post('/verify/:progressUpdateId', authenticateToken, async (req, res) => {
  try {
    const { progressUpdateId } = req.params;
    const { verificationNotes } = req.body;
    const clientId = req.user.uid;

    const result = await progressTrackingService.verifyProgressUpdate(
      progressUpdateId, 
      clientId, 
      verificationNotes
    );
    res.json({ success: true, message: 'Progress update verified' });
  } catch (error) {
    console.error('Error verifying progress update:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get progress updates for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    // Verify user has access to this project
    const projectDoc = await admin.firestore().collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const projectData = projectDoc.data();
    if (projectData.freelancerId !== userId && projectData.clientId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get progress updates
    const progressUpdatesSnapshot = await admin.firestore()
      .collection('progress_updates')
      .where('projectId', '==', projectId)
      .orderBy('updatedAt', 'desc')
      .get();

    const progressUpdates = progressUpdatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ success: true, data: progressUpdates });
  } catch (error) {
    console.error('Error fetching progress updates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
