const { db } = require('../firebase-config');

class Invoice {
  constructor(data) {
    this.id = data.id;
    this.invoiceNumber = data.invoiceNumber;
    this.projectId = data.projectId;
    this.freelancerId = data.freelancerId;
    this.clientId = data.clientId;
    this.clientEmail = data.clientEmail;
    this.amount = data.amount;
    this.tax = data.tax || 0;
    this.total = data.total;
    this.status = data.status || 'pending'; // pending, sent, paid, overdue
    this.dueDate = data.dueDate;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async create(invoiceData) {
    try {
      const invoiceRef = await db.collection('invoices').add({
        ...invoiceData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: invoiceRef.id, ...invoiceData };
    } catch (error) {
      throw new Error('Error creating invoice: ' + error.message);
    }
  }

  static async findById(id) {
    try {
      const doc = await db.collection('invoices').doc(id).get();
      if (!doc.exists) return null;
      
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error('Error finding invoice: ' + error.message);
    }
  }

  static async findByFreelancer(freelancerId) {
    try {
      const snapshot = await db.collection('invoices').where('freelancerId', '==', freelancerId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error finding invoices: ' + error.message);
    }
  }

  static async findByClient(clientId) {
    try {
      const snapshot = await db.collection('invoices').where('clientId', '==', clientId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error finding invoices: ' + error.message);
    }
  }

  static async update(id, updateData) {
    try {
      await db.collection('invoices').doc(id).update({
        ...updateData,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw new Error('Error updating invoice: ' + error.message);
    }
  }

  static async delete(id) {
    try {
      await db.collection('invoices').doc(id).delete();
      return true;
    } catch (error) {
      throw new Error('Error deleting invoice: ' + error.message);
    }
  }

  static async getAll() {
    try {
      const snapshot = await db.collection('invoices').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error getting invoices: ' + error.message);
    }
  }
}

module.exports = Invoice;
