const { db } = require('../firebase-admin');

class Contract {
  constructor(data) {
    this.id = data.id || null;
    this.projectId = data.projectId;
    this.freelancerId = data.freelancerId;
    this.clientId = data.clientId;
    this.title = data.title;
    this.scope = data.scope;
    this.deliverables = data.deliverables || [];
    this.paymentTerms = data.paymentTerms;
    this.hourlyRate = data.hourlyRate || null;
    this.fixedPrice = data.fixedPrice || null;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.milestones = data.milestones || [];
    this.revisionPolicy = data.revisionPolicy || 'Standard revisions included';
    
    // Billable hours cap (for not-to-exceed contracts)
    this.enableBillableHours = data.enableBillableHours || false;
    this.maxBillableHours = data.maxBillableHours || null;
    
    // Additional contract details
    this.invoicingSchedule = data.invoicingSchedule || 'Upon milestone completion'; // or 'Weekly', 'Bi-weekly', 'Monthly'
    this.invoicingTerms = data.invoicingTerms || 'Payment due within 7 days of invoice';
    this.lateFeePolicy = data.lateFeePolicy || 'No late fees applied';
    this.terminationClause = data.terminationClause || 'Either party may terminate with 7 days written notice';
    this.confidentialityClause = data.confidentialityClause || 'Both parties agree to keep project details confidential';
    this.intellectualPropertyClause = data.intellectualPropertyClause || 'Upon full payment, all intellectual property rights transfer to client';
    
    // Party information
    this.freelancerName = data.freelancerName || null;
    this.freelancerAddress = data.freelancerAddress || null;
    this.freelancerPhone = data.freelancerPhone || null;
    this.clientName = data.clientName || null;
    this.clientAddress = data.clientAddress || null;
    this.clientPhone = data.clientPhone || null;
    
    this.status = data.status || 'pending'; // pending, signed, active, completed, terminated
    this.freelancerSignature = data.freelancerSignature || null;
    this.freelancerSignedAt = data.freelancerSignedAt || null;
    this.clientSignature = data.clientSignature || null;
    this.clientSignedAt = data.clientSignedAt || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Create a new contract
  static async create(contractData) {
    try {
      const contract = new Contract(contractData);
      const docRef = await db.collection('contracts').add({
        projectId: contract.projectId,
        freelancerId: contract.freelancerId,
        clientId: contract.clientId,
        title: contract.title,
        scope: contract.scope,
        deliverables: contract.deliverables,
        paymentTerms: contract.paymentTerms,
        hourlyRate: contract.hourlyRate,
        fixedPrice: contract.fixedPrice,
        startDate: contract.startDate,
        endDate: contract.endDate,
        milestones: contract.milestones,
        revisionPolicy: contract.revisionPolicy,
        
        // Billable hours cap
        enableBillableHours: contract.enableBillableHours,
        maxBillableHours: contract.maxBillableHours,
        
        // Additional terms
        invoicingSchedule: contract.invoicingSchedule,
        invoicingTerms: contract.invoicingTerms,
        lateFeePolicy: contract.lateFeePolicy,
        terminationClause: contract.terminationClause,
        confidentialityClause: contract.confidentialityClause,
        intellectualPropertyClause: contract.intellectualPropertyClause,
        
        // Party information
        freelancerName: contract.freelancerName,
        freelancerAddress: contract.freelancerAddress,
        freelancerPhone: contract.freelancerPhone,
        clientName: contract.clientName,
        clientAddress: contract.clientAddress,
        clientPhone: contract.clientPhone,
        
        status: contract.status,
        freelancerSignature: contract.freelancerSignature,
        freelancerSignedAt: contract.freelancerSignedAt,
        clientSignature: contract.clientSignature,
        clientSignedAt: contract.clientSignedAt,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt
      });
      
      return { success: true, contractId: docRef.id, data: contract };
    } catch (error) {
      console.error('Error creating contract:', error);
      return { success: false, error: error.message };
    }
  }

  // Find contract by ID
  static async findById(id) {
    try {
      const doc = await db.collection('contracts').doc(id).get();
      
      if (!doc.exists) {
        return { success: false, error: 'Contract not found' };
      }
      
      return { success: true, data: { id: doc.id, ...doc.data() } };
    } catch (error) {
      console.error('Error finding contract:', error);
      return { success: false, error: error.message };
    }
  }

  // Find contract by project ID
  static async findByProjectId(projectId) {
    try {
      const snapshot = await db.collection('contracts')
        .where('projectId', '==', projectId)
        .get();
      
      if (snapshot.empty) {
        return { success: false, error: 'No contract found for this project' };
      }
      
      const doc = snapshot.docs[0];
      return { success: true, data: { id: doc.id, ...doc.data() } };
    } catch (error) {
      console.error('Error finding contract by project:', error);
      return { success: false, error: error.message };
    }
  }

  // Alias for backwards compatibility
  static async findByProject(projectId) {
    return this.findByProjectId(projectId);
  }

  // Check if contract allows work to begin
  static async canStartWork(contractId) {
    try {
      const result = await this.findById(contractId);
      if (!result.success) {
        return { allowed: false, reason: 'Contract not found' };
      }

      const contract = result.data;

      // Contract must be active
      if (contract.status !== 'active') {
        return { 
          allowed: false, 
          reason: 'Contract is not active',
          contractStatus: contract.status
        };
      }

      // Both parties must have signed
      if (!contract.freelancerSignedAt || !contract.clientSignedAt) {
        return {
          allowed: false,
          reason: 'Contract pending signatures from both parties',
          freelancerSigned: !!contract.freelancerSignedAt,
          clientSigned: !!contract.clientSignedAt
        };
      }

      return { 
        allowed: true, 
        contract: contract 
      };
    } catch (error) {
      console.error('Error checking if work can start:', error);
      return { allowed: false, reason: error.message };
    }
  }

  // Check if contract allows work for a specific project
  static async canStartWorkForProject(projectId) {
    try {
      const contractResult = await this.findByProjectId(projectId);
      if (!contractResult.success) {
        return { allowed: false, reason: 'No contract found for this project' };
      }

      return this.canStartWork(contractResult.data.id);
    } catch (error) {
      console.error('Error checking if work can start for project:', error);
      return { allowed: false, reason: error.message };
    }
  }

  // Get all contracts for a freelancer
  static async findByFreelancerId(freelancerId) {
    try {
      const snapshot = await db.collection('contracts')
        .where('freelancerId', '==', freelancerId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const contracts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { success: true, data: contracts };
    } catch (error) {
      console.error('Error finding contracts by freelancer:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all contracts for a client
  static async findByClientId(clientId) {
    try {
      const snapshot = await db.collection('contracts')
        .where('clientId', '==', clientId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const contracts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { success: true, data: contracts };
    } catch (error) {
      console.error('Error finding contracts by client:', error);
      return { success: false, error: error.message };
    }
  }

  // Sign contract (freelancer or client)
  static async signContract(contractId, signatureData) {
    try {
      const { userId, userType, signature } = signatureData; // userType: 'freelancer' or 'client'
      
      const updateData = {
        updatedAt: new Date()
      };

      if (userType === 'freelancer') {
        updateData.freelancerSignature = signature;
        updateData.freelancerSignedAt = new Date();
      } else if (userType === 'client') {
        updateData.clientSignature = signature;
        updateData.clientSignedAt = new Date();
      }

      await db.collection('contracts').doc(contractId).update(updateData);

      // Check if both parties have signed
      const contractDoc = await db.collection('contracts').doc(contractId).get();
      const contractData = contractDoc.data();

      if (contractData.freelancerSignedAt && contractData.clientSignedAt) {
        // Both signed - activate contract and project
        await db.collection('contracts').doc(contractId).update({
          status: 'active',
          updatedAt: new Date()
        });

        // Update project status to active now that contract is fully signed
        console.log('Contract fully signed, activating project:', contractData.projectId);
        await db.collection('projects').doc(contractData.projectId).update({
          status: 'active',
          updatedAt: new Date()
        });
        console.log('Project activated - work can now begin');

        return { 
          success: true, 
          message: 'Contract signed successfully. Both parties have signed - project is now active!',
          fullySignedcontract: true,
          projectActivated: true
        };
      }

      // Only one party has signed so far
      const waitingFor = contractData.freelancerSignedAt ? 'client' : 'freelancer';
      return { 
        success: true, 
        message: `Contract signed successfully. Waiting for ${waitingFor} signature.`,
        fullySignedcontract: false,
        waitingFor: waitingFor
      };
    } catch (error) {
      console.error('Error signing contract:', error);
      return { success: false, error: error.message };
    }
  }

  // Update contract status
  static async updateStatus(contractId, status) {
    try {
      await db.collection('contracts').doc(contractId).update({
        status,
        updatedAt: new Date()
      });
      
      return { success: true, message: 'Contract status updated' };
    } catch (error) {
      console.error('Error updating contract status:', error);
      return { success: false, error: error.message };
    }
  }

  // Update contract
  static async update(contractId, updateData) {
    try {
      await db.collection('contracts').doc(contractId).update({
        ...updateData,
        updatedAt: new Date()
      });
      
      return { success: true, message: 'Contract updated successfully' };
    } catch (error) {
      console.error('Error updating contract:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete contract
  static async delete(contractId) {
    try {
      await db.collection('contracts').doc(contractId).delete();
      return { success: true, message: 'Contract deleted successfully' };
    } catch (error) {
      console.error('Error deleting contract:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = Contract;
