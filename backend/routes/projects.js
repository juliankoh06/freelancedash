const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

// Create a new project
router.post('/', async (req, res) => {
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
      console.log('✅ Project created successfully:', result.data.id);
      res.status(201).json(result.data);
    } else {
      console.error('❌ Project creation failed:', result.error);
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('❌ Error creating project (route):', error);
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

module.exports = router;
