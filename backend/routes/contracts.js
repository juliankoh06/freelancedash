const express = require('express');
const router = express.Router();
const Contract = require('../models/Contract');
const { db, storage } = require('../firebase-admin');
const { generateContractPDFBase64 } = require('../utils/pdfGenerator');

// Create a new contract
router.post('/create', async (req, res) => {
  try {
    const {
      projectId,
      freelancerId,
      clientId,
      title,
      scope,
      deliverables,
      paymentTerms,
      hourlyRate,
      fixedPrice,
      startDate,
      endDate,
      milestones,
      revisionPolicy,
      paymentPolicy // 'milestone' or 'end'
    } = req.body;

    if (!projectId || !freelancerId || !clientId || !title || !scope) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: projectId, freelancerId, clientId, title, scope'
      });
    }

    const contractData = {
      projectId,
      freelancerId,
      clientId,
      title,
      scope,
      deliverables: deliverables || [],
      paymentTerms: paymentTerms || 'Payment upon completion',
      hourlyRate: hourlyRate || null,
      fixedPrice: fixedPrice || null,
      startDate: startDate || new Date(),
      endDate: endDate || null,
      milestones: milestones || [],
      revisionPolicy: revisionPolicy || 'Standard revisions included',
      paymentPolicy: paymentPolicy || 'milestone',
      status: 'pending',
      // Freelancer auto-signs when creating the contract
      freelancerSigned: true,
      freelancerSignedAt: new Date(),
      freelancerSignature: 'Auto-signed on contract creation',
      clientSigned: false
    };

    const result = await Contract.create(contractData);

    if (result.success) {
      // Update project with contractId
      try {
        await db.collection('projects').doc(projectId).update({
          contractId: result.contractId,
          contractStatus: 'pending',
          updatedAt: new Date()
        });
      } catch (updateError) {
        console.error('Error updating project with contractId:', updateError);
        // Don't fail contract creation if project update fails
      }

      res.status(201).json({
        success: true,
        message: 'Contract created successfully',
        contractId: result.contractId,
        contract: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create contract'
    });
  }
});

// Get contract by project ID (must come before /:contractId route)
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await Contract.findByProjectId(projectId);

    if (result.success) {
      res.json({
        success: true,
        contract: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error fetching contract by project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract'
    });
  }
});

// Get all contracts for a freelancer
router.get('/freelancer/:freelancerId', async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const result = await Contract.findByFreelancerId(freelancerId);

    if (result.success) {
      res.json({
        success: true,
        contracts: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error fetching freelancer contracts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contracts'
    });
  }
});

// Get all contracts for a client
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await Contract.findByClientId(clientId);

    if (result.success) {
      res.json({
        success: true,
        contracts: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error fetching client contracts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contracts'
    });
  }
});

// Get contract by ID (with access control) - must come after specific routes
router.get('/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId } = req.query; // userId from query params or auth token
    
    const result = await Contract.findById(contractId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    const contract = result.data;
    
    // Access control: Only freelancer or client can view their contract
    if (userId && contract.freelancerId !== userId && contract.clientId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have permission to view this contract'
      });
    }

    res.json({
      success: true,
      contract: contract
    });
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract'
    });
  }
});

// Sign a contract
router.post('/:contractId/sign', async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId, userType, signature } = req.body;

    if (!userId || !userType || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, userType, signature'
      });
    }

    if (userType !== 'freelancer' && userType !== 'client') {
      return res.status(400).json({
        success: false,
        error: 'Invalid userType. Must be "freelancer" or "client"'
      });
    }

    const result = await Contract.signContract(contractId, { userId, userType, signature });

    if (result.success) {
      // Get updated contract to check if both signed
      const contractResult = await Contract.findById(contractId);
      const contract = contractResult.data;
      const bothSigned = !!(contract.freelancerSignedAt && contract.clientSignedAt);

      // Auto-generate invoice(s) based on payment policy
      if (bothSigned && contract.milestones && contract.milestones.length > 0) {
        const invoicesRef = db.collection('invoices');
        if (contract.paymentPolicy === 'end') {
          // Only after all milestones completed: create one invoice for all
          const totalAmount = contract.milestones.reduce((sum, m) => sum + (m.amount || 0), 0);
          const lineItems = contract.milestones.map(m => ({
            description: `${m.name} - ${m.description || 'Milestone payment'}`,
            quantity: 1,
            rate: m.amount,
            amount: m.amount
          }));
          const invoiceData = {
            projectId: contract.projectId,
            projectTitle: contract.title,
            contractId: contract.id,
            freelancerId: contract.freelancerId,
            freelancerName: contract.freelancerName,
            freelancerEmail: contract.freelancerEmail,
            clientId: contract.clientId,
            clientName: contract.clientName,
            clientEmail: contract.clientEmail,
            invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // or custom logic
            lineItems,
            subtotal: totalAmount,
            taxRate: 0,
            taxAmount: 0,
            totalAmount,
            status: 'pending',
            paymentTerms: contract.paymentTerms || 'Net 30',
            notes: `Invoice for all milestones (end-of-project payment)`,
            terms: 'Payment is due by the specified due date.',
            createdAt: new Date(),
            updatedAt: new Date(),
            type: 'project',
            autoGenerated: true
          };
          try {
            const invoiceDoc = await invoicesRef.add(invoiceData);
            console.log(`✅ Created invoice ${invoiceDoc.id} for all milestones (end-of-project payment)`);
          } catch (invoiceError) {
            console.error('❌ Error creating end-of-project invoice:', invoiceError);
          }
        } else {
          // Default: milestone-based, create invoice for first milestone
          const firstMilestone = contract.milestones[0];
          try {
            const invoiceData = {
              projectId: contract.projectId,
              projectTitle: contract.title,
              contractId: contract.id,
              milestoneId: firstMilestone.id,
              milestoneName: firstMilestone.name,
              freelancerId: contract.freelancerId,
              freelancerName: contract.freelancerName,
              freelancerEmail: contract.freelancerEmail,
              clientId: contract.clientId,
              clientName: contract.clientName,
              clientEmail: contract.clientEmail,
              invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              issueDate: new Date(),
              dueDate: firstMilestone.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              lineItems: [{
                description: `${firstMilestone.name} - ${firstMilestone.description || 'Milestone payment'}`,
                quantity: 1,
                rate: firstMilestone.amount,
                amount: firstMilestone.amount
              }],
              subtotal: firstMilestone.amount,
              taxRate: 0,
              taxAmount: 0,
              totalAmount: firstMilestone.amount,
              status: 'pending',
              paymentTerms: contract.paymentTerms || 'Net 30',
              notes: `Invoice for milestone: ${firstMilestone.name} (${firstMilestone.percentage}% of project)`,
              terms: 'Payment is due by the specified due date.',
              createdAt: new Date(),
              updatedAt: new Date(),
              type: 'milestone',
              autoGenerated: true
            };
            const invoiceDoc = await invoicesRef.add(invoiceData);
            console.log(`✅ Created invoice ${invoiceDoc.id} for first milestone:`, firstMilestone.name);
          } catch (invoiceError) {
            console.error('❌ Error creating first milestone invoice:', invoiceError);
          }
        }
      }

      // If both parties signed, generate and store contract PDF and update project status
      if (bothSigned) {
        // Update project contractStatus to signed
        try {
          await db.collection('projects').doc(contract.projectId).update({
            contractStatus: 'signed',
            updatedAt: new Date()
          });
        } catch (projectUpdateError) {
          console.error('Error updating project contractStatus:', projectUpdateError);
        }

        try {
          console.log('📄 Generating signed contract PDF...');
          const pdfBase64 = await generateContractPDFBase64(contract);
          const pdfBuffer = Buffer.from(pdfBase64, 'base64');
          
          // Upload to Firebase Storage
          const fileName = `signed_contract_${contractId}_${Date.now()}.pdf`;
          const file = storage.bucket().file(`contracts/${contractId}/${fileName}`);
          
          await file.save(pdfBuffer, {
            metadata: {
              contentType: 'application/pdf',
              metadata: {
                contractId: contractId,
                generatedAt: new Date().toISOString()
              }
            }
          });

          // Make file publicly accessible (or use signed URLs for private access)
          await file.makePublic();
          const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/contracts/${contractId}/${fileName}`;
          
          // Update contract with PDF URL
          await db.collection('contracts').doc(contractId).update({
            signedContractPdfUrl: publicUrl,
            pdfGeneratedAt: new Date()
          });

          console.log(`✅ Contract PDF generated and stored: ${publicUrl}`);
          
          // TODO: Send email to both parties with PDF attachment
          
        } catch (pdfError) {
          console.error('❌ Error generating contract PDF:', pdfError);
          // Don't fail the signing process if PDF generation fails
        }
      }

      res.json({
        success: true,
        message: result.message,
        bothSigned: bothSigned,
        fullySigned: bothSigned,
        status: contract.status,
        waitingFor: bothSigned ? null : (userType === 'client' ? 'freelancer' : 'client')
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error signing contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sign contract'
    });
  }
});

// Update contract status
router.patch('/:contractId/status', async (req, res) => {
  try {
    const { contractId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'signed', 'active', 'completed', 'terminated'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const result = await Contract.updateStatus(contractId, status);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error updating contract status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contract status'
    });
  }
});

// Update contract
router.put('/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.freelancerSignature;
    delete updateData.freelancerSignedAt;
    delete updateData.clientSignature;
    delete updateData.clientSignedAt;

    const result = await Contract.update(contractId, updateData);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contract'
    });
  }
});

// Reject contract (client only)
router.post('/:contractId/reject', async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId, reasons, comments } = req.body;

    if (!userId || !reasons || reasons.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, reasons'
      });
    }

    // Get contract
    const contractDoc = await db.collection('contracts').doc(contractId).get();
    if (!contractDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }

    const contract = { id: contractDoc.id, ...contractDoc.data() };

    // Verify user is the client and hasn't signed yet
    if (contract.clientId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the client can reject this contract'
      });
    }

    if (contract.clientSignedAt) {
      return res.status(400).json({
        success: false,
        error: 'Cannot reject a contract that has already been signed'
      });
    }

    // Update contract status
    await db.collection('contracts').doc(contractId).update({
      status: 'rejected',
      rejectedBy: userId,
      rejectedAt: new Date(),
      rejectionReasons: reasons,
      rejectionComments: comments || '',
      updatedAt: new Date()
    });

    // Update project status and add rejection info
    await db.collection('projects').doc(contract.projectId).update({
      status: 'contract_rejected',
      rejectionReasons: reasons,
      rejectionComments: comments || '',
      rejectedAt: new Date(),
      updatedAt: new Date()
    });

    // Delete invitation from invitations collection
    const invitationsSnapshot = await db.collection('invitations')
      .where('projectId', '==', contract.projectId)
      .get();
    
    if (!invitationsSnapshot.empty) {
      const invitationDoc = invitationsSnapshot.docs[0];
      await db.collection('invitations').doc(invitationDoc.id).delete();
      console.log(`✅ Invitation ${invitationDoc.id} deleted after contract rejection`);
    }

    // Get freelancer email and details
    const freelancerDoc = await db.collection('users').doc(contract.freelancerId).get();
    const freelancerData = freelancerDoc.data();

    // Create notification for freelancer
    await db.collection('notifications').add({
      userId: contract.freelancerId,
      type: 'contract_rejected',
      title: '❌ Contract Rejected',
      message: `The client has rejected the contract for "${contract.title}". Check your pending invitations to see their feedback.`,
      projectId: contract.projectId,
      contractId,
      reasons,
      comments: comments || '',
      priority: 'high',
      createdAt: new Date()
    });

    // Send email to freelancer
    const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@freelancedash.com',
      to: freelancerData?.email,
      subject: `❌ Contract Rejected: ${contract.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fee; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #dc2626; margin-top: 0;">Contract Rejected</h2>
            <p style="color: #666;">The client has rejected the contract for <strong>${contract.title}</strong>.</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #333;">Client's Feedback:</h3>
            <ul style="color: #666;">
              ${reasons.map(reason => `<li>${reason}</li>`).join('')}
            </ul>
            ${comments ? `
              <div style="margin-top: 15px; padding: 15px; background-color: #fff; border-left: 3px solid #f59e0b;">
                <p style="margin: 0; font-style: italic; color: #666;">"${comments}"</p>
              </div>
            ` : ''}
          </div>
          
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 5px;">
            <h3 style="margin-top: 0; color: #1e40af;">Next Steps:</h3>
            <ul style="color: #666;">
              <li>Review the client's feedback in your dashboard</li>
              <li>You can remove this project from your pending list</li>
              <li>If you want to work with this client, create a new project with adjusted terms</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">This is an automated message from FreelanceDash</p>
          </div>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Contract rejection email sent to:', freelancerData?.email);
    } catch (emailError) {
      console.error('❌ Failed to send rejection email:', emailError);
      // Don't fail the entire request if email fails
    }

    res.json({
      success: true,
      message: 'Contract rejected successfully. Invitation deleted and freelancer notified.',
      freelancerEmail: freelancerData?.email
    });
  } catch (error) {
    console.error('Error rejecting contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject contract'
    });
  }
});

// Delete contract
router.delete('/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params;
    const result = await Contract.delete(contractId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contract'
    });
  }
});

module.exports = router;
