const { db } = require('../firebase-config-simple');

class Project {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.freelancerId = data.freelancerId;
    this.clientId = data.clientId;
    this.status = data.status || 'pending'; // pending, active, completed, cancelled
    this.priority = data.priority || 'medium'; // low, medium, high
    this.deadline = data.deadline;
    this.budget = data.budget;
    this.currency = data.currency || 'USD';
    this.tags = data.tags || [];
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
      return { id: projectRef.id, ...projectData };
    } catch (error) {
      throw new Error('Error creating project: ' + error.message);
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
