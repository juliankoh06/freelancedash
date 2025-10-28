const admin = require('firebase-admin');

class DataConsistencyService {
  constructor() {
    this.db = admin.firestore();
  }

  // Check overall data consistency
  async checkDataConsistency() {
    try {
      const issues = [];
      
      // Check all projects
      const projectsSnapshot = await this.db.collection('projects').get();
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
        
        // Check project-specific consistency
        const projectIssues = await this.checkProjectConsistency(projectId, projectData);
        issues.push(...projectIssues);
      }

      // Check orphaned records
      const orphanedIssues = await this.checkOrphanedRecords();
      issues.push(...orphanedIssues);

      // Check data integrity
      const integrityIssues = await this.checkDataIntegrity();
      issues.push(...integrityIssues);

      return {
        isValid: issues.length === 0,
        issues,
        checkedAt: new Date(),
        totalProjects: projectsSnapshot.docs.length
      };
    } catch (error) {
      console.error('Error checking data consistency:', error);
      return {
        isValid: false,
        issues: [`Consistency check failed: ${error.message}`],
        checkedAt: new Date()
      };
    }
  }

  // Check project-specific consistency
  async checkProjectConsistency(projectId, projectData) {
    const issues = [];

    try {
      // Check if freelancer exists
      if (projectData.freelancerId) {
        const freelancerDoc = await this.db.collection('users').doc(projectData.freelancerId).get();
        if (!freelancerDoc.exists) {
          issues.push(`Project ${projectId}: Freelancer ${projectData.freelancerId} not found`);
        }
      }

      // Check if client exists
      if (projectData.clientId) {
        const clientDoc = await this.db.collection('users').doc(projectData.clientId).get();
        if (!clientDoc.exists) {
          issues.push(`Project ${projectId}: Client ${projectData.clientId} not found`);
        }
      }

      // Check milestone consistency
      const milestones = projectData.milestones || [];
      const totalPercentage = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
      if (totalPercentage > 100) {
        issues.push(`Project ${projectId}: Total milestone percentage exceeds 100% (${totalPercentage}%)`);
      }

      // Check tasks consistency
      const tasksSnapshot = await this.db.collection('tasks')
        .where('projectId', '==', projectId)
        .get();

      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Check if task progress adds up correctly
      const totalTaskProgress = tasks.reduce((sum, task) => sum + (task.progress || 0), 0);
      const averageProgress = tasks.length > 0 ? totalTaskProgress / tasks.length : 0;
      
      if (Math.abs(averageProgress - (projectData.progress || 0)) > 10) {
        issues.push(`Project ${projectId}: Project progress (${projectData.progress}%) doesn't match average task progress (${averageProgress.toFixed(1)}%)`);
      }

      // Check time tracking consistency
      const timeSessionsSnapshot = await this.db.collection('time_sessions')
        .where('projectId', '==', projectId)
        .get();

      const timeSessions = timeSessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const totalTrackedTime = timeSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      const totalTaskTime = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);

      if (Math.abs(totalTrackedTime - totalTaskTime) > 0.1) {
        issues.push(`Project ${projectId}: Time sessions (${totalTrackedTime.toFixed(2)}h) don't match task time (${totalTaskTime.toFixed(2)}h)`);
      }

      // Check financial consistency
      const transactionsSnapshot = await this.db.collection('transactions')
        .where('projectId', '==', projectId)
        .get();

      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const totalTransactionAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const hourlyRate = projectData.hourlyRate || 0;
      const calculatedCost = totalTaskTime * hourlyRate;

      if (Math.abs(totalTransactionAmount - calculatedCost) > 0.01) {
        issues.push(`Project ${projectId}: Transaction total (${totalTransactionAmount}) doesn't match calculated cost (${calculatedCost})`);
      }

    } catch (error) {
      issues.push(`Project ${projectId}: Error checking consistency - ${error.message}`);
    }

    return issues;
  }

  // Check for orphaned records
  async checkOrphanedRecords() {
    const issues = [];

    try {
      // Check orphaned tasks
      const tasksSnapshot = await this.db.collection('tasks').get();
      for (const taskDoc of tasksSnapshot.docs) {
        const taskData = taskDoc.data();
        if (taskData.projectId) {
          const projectDoc = await this.db.collection('projects').doc(taskData.projectId).get();
          if (!projectDoc.exists) {
            issues.push(`Task ${taskDoc.id}: Referenced project ${taskData.projectId} not found`);
          }
        }
      }

      // Check orphaned transactions
      const transactionsSnapshot = await this.db.collection('transactions').get();
      for (const transactionDoc of transactionsSnapshot.docs) {
        const transactionData = transactionDoc.data();
        if (transactionData.projectId) {
          const projectDoc = await this.db.collection('projects').doc(transactionData.projectId).get();
          if (!projectDoc.exists) {
            issues.push(`Transaction ${transactionDoc.id}: Referenced project ${transactionData.projectId} not found`);
          }
        }
      }

      // Check orphaned invoices
      const invoicesSnapshot = await this.db.collection('invoices').get();
      for (const invoiceDoc of invoicesSnapshot.docs) {
        const invoiceData = invoiceDoc.data();
        if (invoiceData.projectId) {
          const projectDoc = await this.db.collection('projects').doc(invoiceData.projectId).get();
          if (!projectDoc.exists) {
            issues.push(`Invoice ${invoiceDoc.id}: Referenced project ${invoiceData.projectId} not found`);
          }
        }
      }

      // Check orphaned time sessions
      const timeSessionsSnapshot = await this.db.collection('time_sessions').get();
      for (const sessionDoc of timeSessionsSnapshot.docs) {
        const sessionData = sessionDoc.data();
        if (sessionData.projectId) {
          const projectDoc = await this.db.collection('projects').doc(sessionData.projectId).get();
          if (!projectDoc.exists) {
            issues.push(`Time session ${sessionDoc.id}: Referenced project ${sessionData.projectId} not found`);
          }
        }
        if (sessionData.taskId) {
          const taskDoc = await this.db.collection('tasks').doc(sessionData.taskId).get();
          if (!taskDoc.exists) {
            issues.push(`Time session ${sessionDoc.id}: Referenced task ${sessionData.taskId} not found`);
          }
        }
      }

    } catch (error) {
      issues.push(`Error checking orphaned records: ${error.message}`);
    }

    return issues;
  }

  // Check data integrity
  async checkDataIntegrity() {
    const issues = [];

    try {
      // Check for duplicate invoice numbers
      const invoicesSnapshot = await this.db.collection('invoices').get();
      const invoiceNumbers = invoicesSnapshot.docs.map(doc => doc.data().invoiceNumber).filter(Boolean);
      const duplicateInvoiceNumbers = invoiceNumbers.filter((number, index) => 
        invoiceNumbers.indexOf(number) !== index
      );
      
      if (duplicateInvoiceNumbers.length > 0) {
        issues.push(`Duplicate invoice numbers found: ${duplicateInvoiceNumbers.join(', ')}`);
      }

      // Check for invalid email addresses
      const usersSnapshot = await this.db.collection('users').get();
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.email && !this.isValidEmail(userData.email)) {
          issues.push(`User ${userDoc.id}: Invalid email address ${userData.email}`);
        }
      }

      // Check for negative amounts
      const transactionsSnapshot = await this.db.collection('transactions').get();
      const negativeTransactions = transactionsSnapshot.docs.filter(doc => 
        (doc.data().amount || 0) < 0
      );
      
      if (negativeTransactions.length > 0) {
        issues.push(`Found ${negativeTransactions.length} transactions with negative amounts`);
      }

      // Check for future dates
      const now = new Date();
      const futureInvoices = invoicesSnapshot.docs.filter(doc => {
        const issueDate = doc.data().issueDate?.toDate();
        return issueDate && issueDate > now;
      });
      
      if (futureInvoices.length > 0) {
        issues.push(`Found ${futureInvoices.length} invoices with future issue dates`);
      }

    } catch (error) {
      issues.push(`Error checking data integrity: ${error.message}`);
    }

    return issues;
  }

  // Fix data consistency issues
  async fixDataConsistency() {
    try {
      const fixes = [];
      
      // Fix orphaned records
      const orphanedFixes = await this.fixOrphanedRecords();
      fixes.push(...orphanedFixes);

      // Fix duplicate invoice numbers
      const duplicateFixes = await this.fixDuplicateInvoiceNumbers();
      fixes.push(...duplicateFixes);

      // Fix negative amounts
      const negativeFixes = await this.fixNegativeAmounts();
      fixes.push(...negativeFixes);

      return {
        success: true,
        fixes,
        fixedAt: new Date()
      };
    } catch (error) {
      console.error('Error fixing data consistency:', error);
      return {
        success: false,
        error: error.message,
        fixedAt: new Date()
      };
    }
  }

  // Fix orphaned records
  async fixOrphanedRecords() {
    const fixes = [];

    try {
      // Remove orphaned tasks
      const tasksSnapshot = await this.db.collection('tasks').get();
      for (const taskDoc of tasksSnapshot.docs) {
        const taskData = taskDoc.data();
        if (taskData.projectId) {
          const projectDoc = await this.db.collection('projects').doc(taskData.projectId).get();
          if (!projectDoc.exists) {
            await this.db.collection('tasks').doc(taskDoc.id).delete();
            fixes.push(`Removed orphaned task ${taskDoc.id}`);
          }
        }
      }

      // Remove orphaned time sessions
      const timeSessionsSnapshot = await this.db.collection('time_sessions').get();
      for (const sessionDoc of timeSessionsSnapshot.docs) {
        const sessionData = sessionDoc.data();
        if (sessionData.projectId) {
          const projectDoc = await this.db.collection('projects').doc(sessionData.projectId).get();
          if (!projectDoc.exists) {
            await this.db.collection('time_sessions').doc(sessionDoc.id).delete();
            fixes.push(`Removed orphaned time session ${sessionDoc.id}`);
          }
        }
      }

    } catch (error) {
      fixes.push(`Error fixing orphaned records: ${error.message}`);
    }

    return fixes;
  }

  // Fix duplicate invoice numbers
  async fixDuplicateInvoiceNumbers() {
    const fixes = [];

    try {
      const invoicesSnapshot = await this.db.collection('invoices').get();
      const invoiceMap = new Map();

      for (const invoiceDoc of invoicesSnapshot.docs) {
        const invoiceData = invoiceDoc.data();
        const invoiceNumber = invoiceData.invoiceNumber;

        if (invoiceNumber) {
          if (invoiceMap.has(invoiceNumber)) {
            // Generate new invoice number
            const newInvoiceNumber = await this.generateUniqueInvoiceNumber();
            await this.db.collection('invoices').doc(invoiceDoc.id).update({
              invoiceNumber: newInvoiceNumber,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            fixes.push(`Fixed duplicate invoice number ${invoiceNumber} -> ${newInvoiceNumber}`);
          } else {
            invoiceMap.set(invoiceNumber, invoiceDoc.id);
          }
        }
      }

    } catch (error) {
      fixes.push(`Error fixing duplicate invoice numbers: ${error.message}`);
    }

    return fixes;
  }

  // Fix negative amounts
  async fixNegativeAmounts() {
    const fixes = [];

    try {
      const transactionsSnapshot = await this.db.collection('transactions').get();
      
      for (const transactionDoc of transactionsSnapshot.docs) {
        const transactionData = transactionDoc.data();
        const amount = transactionData.amount || 0;

        if (amount < 0) {
          await this.db.collection('transactions').doc(transactionDoc.id).update({
            amount: Math.abs(amount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          fixes.push(`Fixed negative amount in transaction ${transactionDoc.id}: ${amount} -> ${Math.abs(amount)}`);
        }
      }

    } catch (error) {
      fixes.push(`Error fixing negative amounts: ${error.message}`);
    }

    return fixes;
  }

  // Generate unique invoice number
  async generateUniqueInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    return `INV-${year}${month}-${timestamp}`;
  }

  // Validate email address
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = new DataConsistencyService();
