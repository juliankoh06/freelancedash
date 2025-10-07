const express = require('express');
const router = express.Router();
const Invitation = require('../models/Invitation');
const { db } = require('../firebase-config');
const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Create invitation
router.post('/create', async (req, res) => {
  try {
    const { projectId, freelancerId, clientEmail } = req.body;

    if (!projectId || !freelancerId || !clientEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: projectId, freelancerId, clientEmail' 
      });
    }

    // Generate unique token
    const token = Invitation.generateToken();
    
    // Create invitation
    const invitationData = {
      projectId,
      freelancerId,
      clientEmail,
      token
    };

    const result = await Invitation.create(invitationData);
    
    if (result.success) {
      const invitationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/invite/${token}`;
      
      // Get project and freelancer details for the email
      const projectDoc = await db.collection('projects').doc(projectId).get();
      const freelancerDoc = await db.collection('users').doc(freelancerId).get();
      
      const projectData = projectDoc.exists ? projectDoc.data() : {};
      const freelancerData = freelancerDoc.exists ? freelancerDoc.data() : {};
      
      // Send invitation email
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER || 'your-email@gmail.com',
          to: clientEmail,
          subject: `Project Invitation: ${projectData.title || 'New Project'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're Invited to a Project!</h2>
              <p>Hello,</p>
              <p><strong>${freelancerData.name || 'A freelancer'}</strong> has invited you to collaborate on a project:</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3>${projectData.title || 'New Project'}</h3>
                <p><strong>Description:</strong> ${projectData.description || 'No description provided'}</p>
                <p><strong>Budget:</strong> $${projectData.budget || 'Not specified'}</p>
                <p><strong>Timeline:</strong> ${projectData.timeline || 'Not specified'}</p>
              </div>
              
              <p>To accept this invitation and start collaborating, click the button below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationLink}" 
                   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666;">${invitationLink}</p>
              
              <hr style="margin: 30px 0;">
              <p style="color: #666; font-size: 14px;">
                This invitation will expire in 7 days. If you have any questions, you can contact ${freelancerData.name || 'the freelancer'} directly at ${freelancerData.email || 'their email'}.
              </p>
              <p style="color: #666; font-size: 14px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
          `
        };
        
        await transporter.sendMail(mailOptions);
        console.log('Invitation email sent successfully to:', clientEmail);
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        // Don't fail the invitation creation if email fails
      }
      
      res.json({
        success: true,
        invitationId: result.invitationId,
        token: token,
        invitationLink: invitationLink
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invitation by token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const result = await Invitation.findByToken(token);
    
    if (result.success) {
      // Check if invitation is expired
      if (new Date() > result.data.expiresAt.toDate()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invitation has expired' 
        });
      }
      
      // Check if already accepted
      if (result.data.status === 'accepted') {
        return res.status(400).json({ 
          success: false, 
          error: 'Invitation already accepted' 
        });
      }
      
      res.json({
        success: true,
        invitation: result.data
      });
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error getting invitation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Accept invitation
router.post('/accept', async (req, res) => {
  try {
    const { token, clientId } = req.body;

    if (!token || !clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: token, clientId' 
      });
    }

    const result = await Invitation.accept(token, clientId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Invitation accepted successfully',
        projectId: result.data.projectId
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject invitation
router.post('/reject', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: token' 
      });
    }

    const result = await Invitation.reject(token);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Invitation rejected successfully',
        projectId: result.data.projectId
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check if client exists by email
router.post('/check-client', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    // Check if user exists with this email
    const snapshot = await db.collection('users')
      .where('email', '==', email)
      .where('role', '==', 'client')
      .get();
    
    if (snapshot.empty) {
      res.json({ 
        success: true, 
        exists: false,
        message: 'Client not found' 
      });
    } else {
      const userData = snapshot.docs[0].data();
      res.json({ 
        success: true, 
        exists: true,
        clientId: snapshot.docs[0].id,
        client: userData
      });
    }
  } catch (error) {
    console.error('Error checking client:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get project details for invitation
router.get('/:token/project', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Get invitation first
    const invitationResult = await Invitation.findByToken(token);
    
    if (!invitationResult.success) {
      return res.status(404).json(invitationResult);
    }
    
    // Get project details
    const projectDoc = await db.collection('projects').doc(invitationResult.data.projectId).get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
    
    const projectData = { id: projectDoc.id, ...projectDoc.data() };
    
    // Get freelancer details
    const freelancerDoc = await db.collection('users').doc(projectData.freelancerId).get();
    const freelancerData = freelancerDoc.exists ? freelancerDoc.data() : null;
    
    res.json({
      success: true,
      project: projectData,
      freelancer: freelancerData
    });
  } catch (error) {
    console.error('Error getting project details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
