const { db } = require('../firebase-admin');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.password = data.password;
    this.username = data.username;
    this.fullName = data.fullName;
    this.role = data.role || 'freelancer'; // freelancer or client
    this.company = data.company || '';
    this.address = data.address || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async create(userData) {
    try {
      const userRef = await db.collection('users').add({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: userRef.id, ...userData };
    } catch (error) {
      throw new Error('Error creating user: ' + error.message);
    }
  }

  static async findByEmail(email) {
    try {
      const snapshot = await db.collection('users').where('email', '==', email).get();
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error('Error finding user: ' + error.message);
    }
  }

  static async findByEmailAndRole(email, role) {
    try {
      const snapshot = await db.collection('users')
        .where('email', '==', email)
        .where('role', '==', role)
        .get();
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error('Error finding user by email and role: ' + error.message);
    }
  }

  static async findAllByEmail(email) {
    try {
      const snapshot = await db.collection('users').where('email', '==', email).get();
      if (snapshot.empty) return [];
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error finding users by email: ' + error.message);
    }
  }

  static async findByUsername(username) {
    try {
      const snapshot = await db.collection('users').where('username', '==', username).get();
      if (snapshot.empty) return null;
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error('Error finding user: ' + error.message);
    }
  }

  static async findById(id) {
    try {
      const doc = await db.collection('users').doc(id).get();
      if (!doc.exists) return null;
      
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error('Error finding user: ' + error.message);
    }
  }

  static async update(id, updateData) {
    try {
      await db.collection('users').doc(id).update({
        ...updateData,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw new Error('Error updating user: ' + error.message);
    }
  }

  static async delete(id) {
    try {
      await db.collection('users').doc(id).delete();
      return true;
    } catch (error) {
      throw new Error('Error deleting user: ' + error.message);
    }
  }
}

module.exports = User;
