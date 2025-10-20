const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole, validateInput } = require('../middleware/auth');
const { projectSchema, projectUpdateSchema, taskSchema, taskUpdateSchema } = require('../validation/schemas');
const { db } = require('../firebase-config');

// Get all projects (authenticated users only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projectsSnapshot = await db.collection('projects').get();
    const projects = projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get projects by freelancer (authenticated freelancers only)
router.get('/freelancer/:freelancerId', authenticateToken, authorizeRole(['freelancer']), async (req, res) => {
  try {
    const { freelancerId } = req.params;
    
    // Ensure freelancer can only access their own projects
    if (req.user.uid !== freelancerId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const projectsSnapshot = await db.collection('projects')
      .where('freelancerId', '==', freelancerId)
      .get();
    const projects = projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get projects by client (authenticated clients only)
router.get('/client/:clientId', authenticateToken, authorizeRole(['client']), async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Ensure client can only access their own projects
    if (req.user.uid !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const projectsSnapshot = await db.collection('projects')
      .where('clientId', '==', clientId)
      .get();
    const projects = projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get projects by client email (authenticated clients only)
router.get('/client-email/:clientEmail', authenticateToken, authorizeRole(['client']), async (req, res) => {
  try {
    const { clientEmail } = req.params;
    
    console.log('Client email route - req.user:', req.user);
    console.log('Client email route - req.userData:', req.userData);
    console.log('Requested email:', clientEmail);
    
    // Get email from either req.user or req.userData
    const userEmail = req.user.email || req.userData?.email;
    
    if (!userEmail) {
      return res.status(400).json({ success: false, error: 'User email not found in token' });
    }
    
    // Ensure client can only access their own projects
    if (userEmail !== clientEmail) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied',
        details: `User email (${userEmail}) does not match requested email (${clientEmail})`
      });
    }
    
    const projectsSnapshot = await db.collection('projects')
      .where('clientEmail', '==', clientEmail)
      .get();
    const projects = projectsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${projects.length} projects for ${clientEmail}`);
    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('Error in client-email route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new project (authenticated freelancers only)
router.post('/', authenticateToken, authorizeRole(['freelancer']), validateInput(projectSchema), async (req, res) => {
  try {
    const projectData = {
      ...req.body,
      freelancerId: req.user.uid,
      freelancerName: req.userData.username,
      status: req.body.clientEmail ? 'pending_approval' : 'active',
      progress: 0,
      totalHours: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await db.collection('projects').add(projectData);
    const project = { id: docRef.id, ...projectData };
    
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update project (authenticated users only)
router.put('/:id', authenticateToken, validateInput(projectUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user owns the project
    const projectDoc = await db.collection('projects').doc(id).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const projectData = projectDoc.data();
    const isOwner = projectData.freelancerId === req.user.uid || projectData.clientId === req.user.uid;
    
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // BUSINESS RULE: Freelancers cannot edit critical fields if project has a client
    const hasClient = projectData.clientId || projectData.clientEmail;
    const isFreelancer = projectData.freelancerId === req.user.uid;
    
    if (hasClient && isFreelancer) {
      // Define locked fields that cannot be changed
      const lockedFields = ['title', 'hourlyRate', 'clientEmail', 'clientId', 'startDate', 'dueDate'];
      const attemptedChanges = Object.keys(req.body).filter(key => 
        lockedFields.includes(key) && req.body[key] !== projectData[key]
      );
      
      if (attemptedChanges.length > 0) {
        return res.status(403).json({ 
          success: false,
          error: 'Cannot modify locked fields',
          message: `Projects with clients have locked fields: ${attemptedChanges.join(', ')}. These fields represent contractual agreements.`,
          lockedFields: attemptedChanges
        });
      }
      
      // Only allow updates to non-critical fields
      const allowedUpdates = {
        description: req.body.description,
        status: req.body.status,
        progress: req.body.progress,
        priority: req.body.priority,
        updatedAt: new Date()
      };
      
      await db.collection('projects').doc(id).update(allowedUpdates);
    } else {
      // No restrictions for projects without clients or if user is client
      await db.collection('projects').doc(id).update({
        ...req.body,
        updatedAt: new Date()
      });
    }
    
    res.json({ success: true, message: 'Project updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete project (authenticated users only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user owns the project
    const projectDoc = await db.collection('projects').doc(id).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const projectData = projectDoc.data();
    const isOwner = projectData.freelancerId === req.user.uid || projectData.clientId === req.user.uid;
    
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // BUSINESS RULE: Freelancers cannot delete projects with assigned clients
    // This protects data integrity, audit trail, and client trust
    if (projectData.freelancerId === req.user.uid && 
        (projectData.clientId || projectData.clientEmail)) {
      return res.status(403).json({ 
        success: false,
        error: 'Cannot delete project with assigned client',
        message: 'Projects with clients cannot be deleted to maintain data integrity and audit trail. Please archive or mark as cancelled instead.'
      });
    }
    
    await db.collection('projects').doc(id).delete();
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Task routes
// Get all tasks (authenticated users only)
router.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const tasksSnapshot = await db.collection('tasks').get();
    const tasks = tasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new task (authenticated freelancers only)
router.post('/tasks', authenticateToken, authorizeRole(['freelancer']), validateInput(taskSchema), async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      freelancerId: req.user.uid,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await db.collection('tasks').add(taskData);
    const task = { id: docRef.id, ...taskData };
    
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update task (authenticated users only)
router.put('/tasks/:id', authenticateToken, validateInput(taskUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has access to this task
    const taskDoc = await db.collection('tasks').doc(id).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskData = taskDoc.data();
    const hasAccess = taskData.freelancerId === req.user.uid;
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.collection('tasks').doc(id).update({
      ...req.body,
      updatedAt: new Date()
    });
    
    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update task status (authenticated users only)
router.put('/tasks/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Check if user has access to this task
    const taskDoc = await db.collection('tasks').doc(id).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskData = taskDoc.data();
    const hasAccess = taskData.freelancerId === req.user.uid;
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.collection('tasks').doc(id).update({
      status: status,
      updatedAt: new Date()
    });
    
    res.json({ success: true, message: 'Task status updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete task (authenticated users only)
router.delete('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has access to this task
    const taskDoc = await db.collection('tasks').doc(id).get();
    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskData = taskDoc.data();
    const hasAccess = taskData.freelancerId === req.user.uid;
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.collection('tasks').doc(id).delete();
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tasks by project (authenticated users only) - MUST come after /tasks routes
router.get('/:projectId/tasks', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if user has access to this project
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const projectData = projectDoc.data();
    const hasAccess = projectData.freelancerId === req.user.uid || 
                     projectData.clientId === req.user.uid ||
                     projectData.clientEmail === req.user.email;
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const tasksSnapshot = await db.collection('tasks')
      .where('projectId', '==', projectId)
      .get();
    const tasks = tasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
