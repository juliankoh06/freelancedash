const { db } = require('../firebase-admin');

class Project {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.freelancerId = data.freelancerId;
    this.clientId = data.clientId;
    this.clientEmail = data.clientEmail; // Add client email support
    this.status = data.status || 'draft'; // draft, pending_invitation, pending_contract, pending_client_signature, pending_freelancer_signature, active, overdue, completed,, cancelled, rejected, archived, invitation_expired, contract_rejected
    this.priority = data.priority || 'medium'; // low, medium, high
    this.deadline = data.deadline;
    this.budget = data.budget;
    this.freelancerVisible = data.freelancerVisible !== false;
    this.clientVisible = data.clientVisible !== false; 
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async create(projectData) {
    try {
      const projectRef = await db.collection('projects').add({
        ...projectData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const createdProject = { id: projectRef.id, ...projectData, createdAt: new Date(), updatedAt: new Date() };
      return { success: true, data: createdProject };
    } catch (error) {
      console.error('Error creating project in model:', error);
      return { success: false, error: error.message };
    }
  }

  static async findById(id) {
    try {
      const doc = await db.collection('projects').doc(id).get();
      if (!doc.exists) return null;
      
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error('Error finding project: ' + error.message);
    }
  }

  static async findByFreelancer(freelancerId) {
    try {
      const snapshot = await db.collection('projects').where('freelancerId', '==', freelancerId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error finding projects: ' + error.message);
    }
  }

  static async findByClient(clientId) {
    try {
      const snapshot = await db.collection('projects').where('clientId', '==', clientId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error finding projects: ' + error.message);
    }
  }

  static async findByClientEmail(clientEmail) {
    try {
      const snapshot = await db.collection('projects').where('clientEmail', '==', clientEmail).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error finding projects by email: ' + error.message);
    }
  }

  static async update(id, updateData) {
    try {
      await db.collection('projects').doc(id).update({
        ...updateData,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw new Error('Error updating project: ' + error.message);
    }
  }

  static async delete(id) {
    try {
      await db.collection('projects').doc(id).delete();
      return true;
    } catch (error) {
      throw new Error('Error deleting project: ' + error.message);
    }
  }

  static async getAll() {
    try {
      const snapshot = await db.collection('projects').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error getting projects: ' + error.message);
    }
  }
}

module.exports = Project;
