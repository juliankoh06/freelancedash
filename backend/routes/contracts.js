const express = require('express');
const router = express.Router();
const Contract = require('../models/Contract');
const { db } = require('../firebase-admin');

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
      revisionPolicy
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
      status: 'pending'
    };

    const result = await Contract.create(contractData);

    if (result.success) {
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

// Get contract by ID
router.get('/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params;
    const result = await Contract.findById(contractId);

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
    console.error('Error fetching contract:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract'
    });
  }
});

// Get contract by project ID
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

      // Auto-generate invoice for the first milestone only
      if (bothSigned && contract.milestones && contract.milestones.length > 0) {
        const firstMilestone = contract.milestones[0];
        console.log('🎉 Contract fully signed! Auto-generating invoice for first milestone:', firstMilestone.name);
        
        try {
          const invoicesRef = db.collection('invoices');
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
            currency: 'RM',
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
          // Don't fail the signing process if invoice creation fails
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
