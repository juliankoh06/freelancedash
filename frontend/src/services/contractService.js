import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

class ContractService {
  // Get contract by ID
  async getContract(contractId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/contracts/${contractId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching contract:', error);
      throw error;
    }
  }

  // Get contract by project ID
  async getContractByProject(projectId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/contracts/project/${projectId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching contract by project:', error);
      throw error;
    }
  }

  // Get all contracts for a freelancer
  async getFreelancerContracts(freelancerId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/contracts/freelancer/${freelancerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching freelancer contracts:', error);
      throw error;
    }
  }

  // Get all contracts for a client
  async getClientContracts(clientId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/contracts/client/${clientId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching client contracts:', error);
      throw error;
    }
  }

  // Sign a contract
  async signContract(contractId, userId, userType, signature) {
    try {
      const response = await axios.post(`${API_BASE_URL}/contracts/${contractId}/sign`, {
        userId,
        userType,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('Error signing contract:', error);
      throw error;
    }
  }

  // Update contract status
  async updateContractStatus(contractId, status) {
    try {
      const response = await axios.patch(`${API_BASE_URL}/contracts/${contractId}/status`, {
        status
      });
      return response.data;
    } catch (error) {
      console.error('Error updating contract status:', error);
      throw error;
    }
  }

  // Check if project has active contract
  async hasActiveContract(projectId) {
    try {
      const response = await this.getContractByProject(projectId);
      return response.success && response.contract.status === 'active';
    } catch (error) {
      return false;
    }
  }

  // Validate if work can start on project
  async canStartWork(projectId) {
    try {
      const response = await this.getContractByProject(projectId);
      
      if (!response.success) {
        return { allowed: false, reason: 'No contract found for this project' };
      }

      const contract = response.contract;

      if (contract.status === 'pending') {
        return { allowed: false, reason: 'Contract pending signatures from both parties' };
      }

      if (contract.status === 'terminated') {
        return { allowed: false, reason: 'Contract has been terminated' };
      }

      if (contract.status === 'completed') {
        return { allowed: false, reason: 'Contract has been completed' };
      }

      if (contract.status === 'active') {
        return { allowed: true, contract };
      }

      return { allowed: false, reason: 'Contract status is invalid' };
    } catch (error) {
      return { allowed: false, reason: 'Error checking contract status' };
    }
  }

  // Validate invoice against contract
  async validateInvoice(projectId, invoiceAmount) {
    try {
      const response = await this.getContractByProject(projectId);
      
      if (!response.success) {
        return { valid: false, reason: 'No contract found' };
      }

      const contract = response.contract;

      if (contract.status !== 'active') {
        return { valid: false, reason: 'Contract must be active to create invoices' };
      }

      // Check against fixed price if applicable
      if (contract.fixedPrice && invoiceAmount > contract.fixedPrice) {
        return { 
          valid: false, 
          reason: `Invoice amount (RM${invoiceAmount}) exceeds contract price (RM${contract.fixedPrice})` 
        };
      }

      return { valid: true, contract };
    } catch (error) {
      return { valid: false, reason: 'Error validating invoice' };
    }
  }

  // Get contract statistics
  async getContractStats(userId, userRole) {
    try {
      const response = userRole === 'freelancer'
        ? await this.getFreelancerContracts(userId)
        : await this.getClientContracts(userId);

      if (!response.success) {
        return null;
      }

      const contracts = response.contracts;

      return {
        total: contracts.length,
        pending: contracts.filter(c => c.status === 'pending').length,
        active: contracts.filter(c => c.status === 'active').length,
        completed: contracts.filter(c => c.status === 'completed').length,
        terminated: contracts.filter(c => c.status === 'terminated').length,
        totalValue: contracts.reduce((sum, c) => sum + (c.fixedPrice || 0), 0),
        pendingSignatures: contracts.filter(c => {
          if (userRole === 'freelancer') {
            return !c.freelancerSignedAt;
          } else {
            return !c.clientSignedAt;
          }
        }).length
      };
    } catch (error) {
      console.error('Error getting contract stats:', error);
      return null;
    }
  }

  // Check user access to project via contract
  async canAccessProject(userId, projectId) {
    try {
      const response = await this.getContractByProject(projectId);
      
      if (!response.success) {
        return false;
      }

      const contract = response.contract;
      return userId === contract.freelancerId || userId === contract.clientId;
    } catch (error) {
      return false;
    }
  }

  // Get contract payment info
  async getPaymentInfo(projectId) {
    try {
      const response = await this.getContractByProject(projectId);
      
      if (!response.success) {
        return null;
      }

      const contract = response.contract;
      
      return {
        type: contract.hourlyRate ? 'hourly' : 'fixed',
        hourlyRate: contract.hourlyRate,
        fixedPrice: contract.fixedPrice,
        paymentTerms: contract.paymentTerms,
        currency: 'RM'
      };
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
const contractService = new ContractService();
export default contractService;
