const { db } = require('../firebase-config-simple');

class Invoice {
  constructor(data) {
    this.id = data.id;
    this.invoiceNumber = data.invoiceNumber;
    this.projectId = data.projectId;
    this.freelancerId = data.freelancerId;
    this.clientId = data.clientId;
    this.amount = data.amount;
    this.currency = data.currency || 'USD';
    this.status = data.status || 'draft'; // draft, sent, paid, overdue, cancelled
    this.dueDate = data.dueDate;
    this.issueDate = data.issueDate || new Date();
    this.paymentDate = data.paymentDate;
    this.items = data.items || []; // Array of invoice items
    this.notes = data.notes || '';
    this.terms = data.terms || '';
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

  static async findByProject(projectId) {
    try {
      const snapshot = await db.collection('invoices').where('projectId', '==', projectId).get();
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

  static async getOverdueInvoices() {
    try {
      const now = new Date();
      const snapshot = await db.collection('invoices')
        .where('status', '==', 'sent')
        .where('dueDate', '<', now)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error getting overdue invoices: ' + error.message);
    }
  }

  static async generateInvoiceNumber() {
    try {
      const snapshot = await db.collection('invoices').orderBy('createdAt', 'desc').limit(1).get();
      if (snapshot.empty) {
        return 'INV-0001';
      }
      
      const lastInvoice = snapshot.docs[0].data();
      const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[1]);
      return `INV-${String(lastNumber + 1).padStart(4, '0')}`;
    } catch (error) {
      throw new Error('Error generating invoice number: ' + error.message);
    }
  }
}

module.exports = Invoice;
