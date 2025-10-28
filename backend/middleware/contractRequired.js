const Contract = require('../models/Contract');

/**
 * Middleware to ensure an active, fully-signed contract exists for a project
 * before allowing certain actions (time tracking, invoicing, payments)
 */
const requireActiveContract = async (req, res, next) => {
  try {
    const { projectId } = req.params || req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    // Find contract for this project
    const contractResult = await Contract.findByProject(projectId);

    if (!contractResult.success || !contractResult.data) {
      return res.status(403).json({
        success: false,
        error: 'No contract found for this project. A signed contract is required before work can begin.',
        code: 'NO_CONTRACT'
      });
    }

    const contract = contractResult.data;

    // Check if contract is fully signed and active
    if (contract.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Contract must be signed by both parties before work can begin.',
        contractStatus: contract.status,
        code: 'CONTRACT_NOT_ACTIVE'
      });
    }

    if (!contract.freelancerSignedAt || !contract.clientSignedAt) {
      return res.status(403).json({
        success: false,
        error: 'Contract pending signatures. Both parties must sign before proceeding.',
        freelancerSigned: !!contract.freelancerSignedAt,
        clientSigned: !!contract.clientSignedAt,
        code: 'CONTRACT_INCOMPLETE'
      });
    }

    // Attach contract to request for use in route handlers
    req.contract = contract;
    next();

  } catch (error) {
    console.error('Error checking contract requirement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify contract status'
    });
  }
};

/**
 * Middleware to check contract status but allow access
 * Used for read-only operations where we want to show contract warnings
 */
const checkContractStatus = async (req, res, next) => {
  try {
    const { projectId } = req.params || req.body;

    if (projectId) {
      const contractResult = await Contract.findByProject(projectId);
      if (contractResult.success && contractResult.data) {
        req.contract = contractResult.data;
        req.contractActive = contractResult.data.status === 'active' &&
                             contractResult.data.freelancerSignedAt &&
                             contractResult.data.clientSignedAt;
      } else {
        req.contract = null;
        req.contractActive = false;
      }
    }

    next();
  } catch (error) {
    console.error('Error checking contract status:', error);
    // Don't block on error for read-only checks
    req.contract = null;
    req.contractActive = false;
    next();
  }
};

module.exports = {
  requireActiveContract,
  checkContractStatus
};
