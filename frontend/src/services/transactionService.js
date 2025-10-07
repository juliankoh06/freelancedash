import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { Transaction, TRANSACTION_TYPES, TRANSACTION_STATUSES } from '../models/Transaction';

class TransactionService {
  constructor() {
    this.collectionName = 'transactions';
  }

  // Create a new transaction
  async createTransaction(transactionData) {
    try {
      console.log('🔍 Creating transaction:', transactionData);
      
      const transaction = new Transaction(transactionData);
      const validation = transaction.validate();
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const docRef = await addDoc(collection(db, this.collectionName), {
        ...transaction.toFirebase(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log('✅ Transaction created with ID:', docRef.id);
      return { success: true, id: docRef.id, transaction };
    } catch (error) {
      console.error('❌ Error creating transaction:', error);
      throw error;
    }
  }

  // Get transactions for a specific project
  async getProjectTransactions(projectId) {
    try {
      console.log('🔍 Fetching transactions for project:', projectId);
      
      const q = query(
        collection(db, this.collectionName),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => 
        Transaction.fromFirebase(doc)
      );
      
      console.log('✅ Fetched project transactions:', transactions.length);
      return { success: true, transactions };
    } catch (error) {
      console.error('❌ Error fetching project transactions:', error);
      throw error;
    }
  }

  // Get transactions for a freelancer
  async getFreelancerTransactions(freelancerId) {
    try {
      console.log('🔍 Fetching transactions for freelancer:', freelancerId);
      
      const q = query(
        collection(db, this.collectionName),
        where('freelancerId', '==', freelancerId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => 
        Transaction.fromFirebase(doc)
      );
      
      console.log('✅ Fetched freelancer transactions:', transactions.length);
      return { success: true, transactions };
    } catch (error) {
      console.error('❌ Error fetching freelancer transactions:', error);
      throw error;
    }
  }

  // Get transactions for a client
  async getClientTransactions(clientId) {
    try {
      console.log('🔍 Fetching transactions for client:', clientId);
      
      const q = query(
        collection(db, this.collectionName),
        where('clientId', '==', clientId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => 
        Transaction.fromFirebase(doc)
      );
      
      console.log('✅ Fetched client transactions:', transactions.length);
      return { success: true, transactions };
    } catch (error) {
      console.error('❌ Error fetching client transactions:', error);
      throw error;
    }
  }

  // Update transaction status
  async updateTransactionStatus(transactionId, status, paymentData = {}) {
    try {
      console.log('🔍 Updating transaction status:', { transactionId, status, paymentData });
      
      const updateData = {
        status,
        updatedAt: new Date(),
        ...paymentData
      };

      if (status === TRANSACTION_STATUSES.PAID) {
        updateData.paidAt = new Date();
      }

      await updateDoc(doc(db, this.collectionName, transactionId), updateData);
      
      console.log('✅ Transaction status updated');
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating transaction status:', error);
      throw error;
    }
  }

  // Delete transaction
  async deleteTransaction(transactionId) {
    try {
      console.log('🔍 Deleting transaction:', transactionId);
      
      await deleteDoc(doc(db, this.collectionName, transactionId));
      
      console.log('✅ Transaction deleted');
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting transaction:', error);
      throw error;
    }
  }

  // Get transaction statistics
  async getTransactionStats(userId, userType = 'freelancer') {
    try {
      console.log('🔍 Fetching transaction stats for:', { userId, userType });
      
      const fieldName = userType === 'freelancer' ? 'freelancerId' : 'clientId';
      const q = query(
        collection(db, this.collectionName),
        where(fieldName, '==', userId)
      );
      
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => 
        Transaction.fromFirebase(doc)
      );
      
      const stats = {
        total: transactions.length,
        paid: transactions.filter(t => t.status === TRANSACTION_STATUSES.PAID).length,
        pending: transactions.filter(t => t.status === TRANSACTION_STATUSES.PENDING).length,
        overdue: transactions.filter(t => t.isOverdue()).length,
        totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
        paidAmount: transactions
          .filter(t => t.status === TRANSACTION_STATUSES.PAID)
          .reduce((sum, t) => sum + t.amount, 0),
        pendingAmount: transactions
          .filter(t => t.status === TRANSACTION_STATUSES.PENDING)
          .reduce((sum, t) => sum + t.amount, 0)
      };
      
      console.log('✅ Transaction stats calculated:', stats);
      return { success: true, stats };
    } catch (error) {
      console.error('❌ Error fetching transaction stats:', error);
      throw error;
    }
  }

  // Create transaction from project data
  async createTransactionFromProject(project, transactionType = TRANSACTION_TYPES.PAYMENT) {
    try {
      console.log('🔍 Creating transaction from project:', { project, transactionType });
      
      const transactionData = {
        projectId: project.id,
        projectTitle: project.title,
        clientId: project.clientId,
        clientEmail: project.clientEmail,
        freelancerId: project.freelancerId,
        type: transactionType,
        amount: project.hourlyRate * (project.totalHours || 0),
        description: `Payment for project: ${project.title}`,
        status: TRANSACTION_STATUSES.PENDING,
        dueDate: project.dueDate,
        hoursWorked: project.totalHours || 0,
        hourlyRate: project.hourlyRate,
        timePeriod: {
          startDate: project.startDate,
          endDate: project.dueDate
        }
      };

      return await this.createTransaction(transactionData);
    } catch (error) {
      console.error('❌ Error creating transaction from project:', error);
      throw error;
    }
  }

  // Listen to real-time transaction updates
  subscribeToTransactions(userId, userType = 'freelancer', callback) {
    console.log('🔍 Subscribing to transactions for:', { userId, userType });
    
    const fieldName = userType === 'freelancer' ? 'freelancerId' : 'clientId';
    const q = query(
      collection(db, this.collectionName),
      where(fieldName, '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => 
        Transaction.fromFirebase(doc)
      );
      callback(transactions);
    });
  }
}

export default new TransactionService();
