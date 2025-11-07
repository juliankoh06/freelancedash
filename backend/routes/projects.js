const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { authenticateToken } = require('../middleware/auth');

// Create a new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const projectData = req.body;
    
    console.log('📝 Creating project with data:', JSON.stringify(projectData, null, 2));
    
    if (!projectData.title || !projectData.freelancerId) {
      console.error('❌ Missing required fields:', { title: projectData.title, freelancerId: projectData.freelancerId });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: title and freelancerId' 
      });
    }
    
    const result = await Project.create(projectData);
    
    if (result.success) {
      console.log(' Project created successfully:', result.data.id);
      res.status(201).json(result.data);
    } else {
      console.error(' Project creation failed:', result.error);
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error(' Error creating project (route):', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route to fetch projects by client ID
router.get('/client/:clientId', async (req, res) => {
  const { clientId } = req.params;
  try {
    const projects = await Project.findByClient(clientId);
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to fetch projects by client email
router.get('/client-email/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const projects = await Project.findByClientEmail(email);
    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    console.error('Error fetching projects by client email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a single project by ID
router.get('/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a project
router.patch('/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const updateData = req.body;
  
  try {
    // Get current project data before update
    const currentProject = await Project.findById(projectId);
    if (!currentProject.success) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    const oldMilestones = currentProject.data.milestones || [];
    const newMilestones = updateData.milestones || oldMilestones;
    
    // Check if any milestone was just marked as completed
    if (newMilestones && oldMilestones) {
      for (let i = 0; i < newMilestones.length; i++) {
        const newMilestone = newMilestones[i];
        const oldMilestone = oldMilestones[i];
        
        // If milestone status changed to "completed" and wasn't before
        if (newMilestone && oldMilestone && 
            newMilestone.status === 'completed' && 
            oldMilestone.status !== 'completed') {
          
          // Send milestone completion email to client
          try {
            const { sendMilestoneCompletionEmail } = require('../services/emailService');
            const { db } = require('../firebase-admin');
            
            // Fetch client details
            let clientData = {};
            if (currentProject.data.clientId) {
              const clientDoc = await db.collection('users').doc(currentProject.data.clientId).get();
              if (clientDoc.exists) {
                const cData = clientDoc.data();
                clientData = {
                  clientEmail: cData.email,
                  clientName: cData.fullName || cData.username || 'Client'
                };
              }
            }
            
            // Fetch freelancer details
            let freelancerData = {};
            if (currentProject.data.freelancerId) {
              const freelancerDoc = await db.collection('users').doc(currentProject.data.freelancerId).get();
              if (freelancerDoc.exists) {
                const fData = freelancerDoc.data();
                freelancerData = {
                  freelancerName: fData.fullName || fData.username || 'Freelancer'
                };
              }
            }
            
            if (clientData.clientEmail) {
              await sendMilestoneCompletionEmail({
                clientEmail: clientData.clientEmail,
                clientName: clientData.clientName,
                projectTitle: currentProject.data.title,
                milestoneTitle: newMilestone.title,
                freelancerName: freelancerData.freelancerName || 'Freelancer',
                evidence: newMilestone.evidence || '',
                evidenceFiles: newMilestone.evidenceFiles || []
              });
              console.log(`✅ Milestone completion email sent to ${clientData.clientEmail}`);
            }
          } catch (emailError) {
            console.error('❌ Error sending milestone completion email:', emailError);
            // Don't fail the update if email fails
          }
        }
      }
    }
    
    await Project.update(projectId, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Project updated successfully' 
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a project
router.delete('/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  
  try {
    await Project.delete(projectId);
    res.status(200).json({ 
      success: true, 
      message: 'Project deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route to archive a project
router.patch('/:projectId/archive', async (req, res) => {
  const { projectId } = req.params;
  const { archivedReason, previousStatus } = req.body;
  
  try {
    await Project.update(projectId, {
      status: 'archived',
      archivedAt: new Date().toISOString(),
      archivedReason: archivedReason || 'Archived by user',
      previousStatus: previousStatus || 'unknown'
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Project archived successfully' 
    });
  } catch (error) {
    console.error('Error archiving project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route to unarchive a project
router.patch('/:projectId/unarchive', async (req, res) => {
  const { projectId } = req.params;
  
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    const restoreStatus = project.previousStatus || 'active';
    
    await Project.update(projectId, {
      status: restoreStatus,
      archivedAt: null,
      archivedReason: null,
      previousStatus: null
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Project unarchived successfully',
      restoredStatus: restoreStatus
    });
  } catch (error) {
    console.error('Error unarchiving project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route to auto-update overdue projects (can be called manually or via cron)
router.post('/auto-update-status', async (req, res) => {
  const { autoRejectOverduePendingProjects, autoMarkOverdueActiveProjects } = require('../utils/projectStatusUpdater');
  
  try {
    // Auto-reject pending sign projects past due date
    const rejectResult = await autoRejectOverduePendingProjects();
    
    // Auto-mark active projects as overdue
    const overdueResult = await autoMarkOverdueActiveProjects();
    
    res.status(200).json({
      success: true,
      message: 'Project status auto-update completed',
      rejectedProjects: rejectResult.updatedCount || 0,
      overdueProjects: overdueResult.updatedCount || 0,
    });
  } catch (error) {
    console.error('Error auto-updating project status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
