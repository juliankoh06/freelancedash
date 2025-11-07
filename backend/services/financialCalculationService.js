const { admin, db } = require('../firebase-admin');

class FinancialCalculationService {
  constructor() {
    this.db = db;
  }

  // Calculate project financial summary
  async calculateProjectFinancials(projectId) {
    try {
      // Get all tasks for the project
      const tasksSnapshot = await this.db.collection('tasks')
        .where('projectId', '==', projectId)
        .get();

      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get all transactions for the project
      const transactionsSnapshot = await this.db.collection('transactions')
        .where('projectId', '==', projectId)
        .get();

      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get all invoices for the project
      const invoicesSnapshot = await this.db.collection('invoices')
        .where('projectId', '==', projectId)
        .get();

      const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate time-based costs
      const totalHours = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
      const projectDoc = await this.db.collection('projects').doc(projectId).get();
      const projectData = projectDoc.data();
      const hourlyRate = projectData.hourlyRate || 0;
      const timeBasedCost = totalHours * hourlyRate;

      // Calculate milestone costs
      const milestones = projectData.milestones || [];
      const milestoneCost = milestones.reduce((sum, milestone) => {
        if (milestone.status === 'completed' || milestone.status === 'invoiced' || milestone.status === 'paid') {
          return sum + (milestone.amount || 0);
        }
        return sum;
      }, 0);

      // Calculate transaction totals
      const paidTransactions = transactions.filter(t => t.status === 'paid');
      const pendingTransactions = transactions.filter(t => t.status === 'pending');
      const overdueTransactions = transactions.filter(t => t.status === 'overdue');

      const totalPaid = paidTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalPending = pendingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalOverdue = overdueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

      // Calculate invoice totals
      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'approved');
      const draftInvoices = invoices.filter(i => i.status === 'draft');

      const totalInvoiced = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
      const totalPaidInvoices = paidInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
      const totalPendingInvoices = pendingInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

      // Calculate project value
      const projectValue = Math.max(timeBasedCost, milestoneCost, totalInvoiced);

      return {
        projectId,
        totalHours,
        hourlyRate,
        timeBasedCost,
        milestoneCost,
        projectValue,
        transactions: {
          total: transactions.length,
          paid: paidTransactions.length,
          pending: pendingTransactions.length,
          overdue: overdueTransactions.length,
          totalPaid,
          totalPending,
          totalOverdue
        },
        invoices: {
          total: invoices.length,
          paid: paidInvoices.length,
          pending: pendingInvoices.length,
          draft: draftInvoices.length,
          totalInvoiced,
          totalPaidInvoices,
          totalPendingInvoices
        },
        calculatedAt: new Date()
      };
    } catch (error) {
      console.error('Error calculating project financials:', error);
      throw error;
    }
  }

  // Calculate freelancer financial summary
  async calculateFreelancerFinancials(freelancerId, timeRange = 'month') {
    try {
      const now = new Date();
      let startDate;

      switch (timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get all projects for freelancer
      const projectsSnapshot = await this.db.collection('projects')
        .where('freelancerId', '==', freelancerId)
        .get();

      const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get all transactions for freelancer
      const transactionsSnapshot = await this.db.collection('transactions')
        .where('freelancerId', '==', freelancerId)
        .where('createdAt', '>=', startDate)
        .get();

      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Get all invoices for freelancer
      const invoicesSnapshot = await this.db.collection('invoices')
        .where('freelancerId', '==', freelancerId)
        .where('createdAt', '>=', startDate)
        .get();

      const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate totals
      const totalEarnings = transactions
        .filter(t => t.status === 'paid')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalInvoiced = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
      const totalPaidInvoices = invoices
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + (i.totalAmount || 0), 0);

      const pendingAmount = transactions
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const overdueAmount = transactions
        .filter(t => t.status === 'overdue')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      // Calculate project statistics
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const totalProjects = projects.length;

      // Calculate average project value
      const totalProjectValue = projects.reduce((sum, p) => {
        return sum + (p.estimatedCost || p.hourlyRate * (p.estimatedHours || 0) || 0);
      }, 0);
      const averageProjectValue = totalProjects > 0 ? totalProjectValue / totalProjects : 0;

      return {
        freelancerId,
        timeRange,
        period: {
          startDate,
          endDate: now
        },
        earnings: {
          total: totalEarnings,
          pending: pendingAmount,
          overdue: overdueAmount
        },
        invoices: {
          total: invoices.length,
          totalAmount: totalInvoiced,
          paidAmount: totalPaidInvoices,
          pendingAmount: totalInvoiced - totalPaidInvoices
        },
        projects: {
          total: totalProjects,
          active: activeProjects,
          completed: completedProjects,
          averageValue: averageProjectValue
        },
        calculatedAt: new Date()
      };
    } catch (error) {
      console.error('Error calculating freelancer financials:', error);
      throw error;
    }
  }

  // Validate financial data consistency
  async validateFinancialConsistency(projectId) {
    try {
      const issues = [];

      // Get project data
      const projectDoc = await this.db.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) {
        issues.push('Project not found');
        return { isValid: false, issues };
      }

      const projectData = projectDoc.data();

      // Get all related data
      const [tasksSnapshot, transactionsSnapshot, invoicesSnapshot] = await Promise.all([
        this.db.collection('tasks').where('projectId', '==', projectId).get(),
        this.db.collection('transactions').where('projectId', '==', projectId).get(),
        this.db.collection('invoices').where('projectId', '==', projectId).get()
      ]);

      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Check milestone consistency
      const milestones = projectData.milestones || [];
      const totalMilestonePercentage = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
      if (totalMilestonePercentage > 100) {
        issues.push(`Total milestone percentage exceeds 100%: ${totalMilestonePercentage}%`);
      }

      // Check time tracking consistency
      const totalHours = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
      const hourlyRate = projectData.hourlyRate || 0;
      const calculatedCost = totalHours * hourlyRate;

      // Check if transaction amounts match calculated costs
      const transactionAmounts = transactions.map(t => t.amount || 0);
      const totalTransactionAmount = transactionAmounts.reduce((sum, amount) => sum + amount, 0);

      if (Math.abs(totalTransactionAmount - calculatedCost) > 0.01) {
        issues.push(`Transaction total (${totalTransactionAmount}) doesn't match calculated cost (${calculatedCost})`);
      }

      // Check invoice consistency
      const invoiceAmounts = invoices.map(i => i.totalAmount || 0);
      const totalInvoiceAmount = invoiceAmounts.reduce((sum, amount) => sum + amount, 0);

      if (Math.abs(totalInvoiceAmount - calculatedCost) > 0.01) {
        issues.push(`Invoice total (${totalInvoiceAmount}) doesn't match calculated cost (${calculatedCost})`);
      }

      // Check for duplicate transactions
      const transactionDescriptions = transactions.map(t => t.description);
      const duplicateDescriptions = transactionDescriptions.filter((desc, index) => 
        transactionDescriptions.indexOf(desc) !== index
      );
      if (duplicateDescriptions.length > 0) {
        issues.push(`Duplicate transaction descriptions found: ${duplicateDescriptions.join(', ')}`);
      }

      // Check for negative amounts
      const negativeTransactions = transactions.filter(t => (t.amount || 0) < 0);
      if (negativeTransactions.length > 0) {
        issues.push(`Found ${negativeTransactions.length} transactions with negative amounts`);
      }

      return {
        isValid: issues.length === 0,
        issues,
        summary: {
          totalHours,
          calculatedCost,
          totalTransactionAmount,
          totalInvoiceAmount,
          milestonePercentage: totalMilestonePercentage
        }
      };
    } catch (error) {
      console.error('Error validating financial consistency:', error);
      return {
        isValid: false,
        issues: [`Validation error: ${error.message}`]
      };
    }
  }

  // Recalculate all financial data for a project
  async recalculateProjectFinancials(projectId) {
    try {
      const financials = await this.calculateProjectFinancials(projectId);
      
      // Update project with calculated financials
      await this.db.collection('projects').doc(projectId).update({
        calculatedFinancials: financials,
        lastFinancialCalculation: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return financials;
    } catch (error) {
      console.error('Error recalculating project financials:', error);
      throw error;
    }
  }

  // Get financial dashboard data
  async getFinancialDashboard(freelancerId) {
    try {
      const [monthlyFinancials, quarterlyFinancials, yearlyFinancials] = await Promise.all([
        this.calculateFreelancerFinancials(freelancerId, 'month'),
        this.calculateFreelancerFinancials(freelancerId, 'quarter'),
        this.calculateFreelancerFinancials(freelancerId, 'year')
      ]);

      // Get recent projects
      const projectsSnapshot = await this.db.collection('projects')
        .where('freelancerId', '==', freelancerId)
        .orderBy('updatedAt', 'desc')
        .limit(10)
        .get();

      const recentProjects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return {
        monthly: monthlyFinancials,
        quarterly: quarterlyFinancials,
        yearly: yearlyFinancials,
        recentProjects
      };
    } catch (error) {
      console.error('Error getting financial dashboard:', error);
      throw error;
    }
  }
}

module.exports = new FinancialCalculationService();
