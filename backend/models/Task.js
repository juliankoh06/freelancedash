const { db } = require('../firebase-config');

class Task {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.projectId = data.projectId;
    this.assignedTo = data.assignedTo; // freelancer ID
    this.status = data.status || 'pending'; // pending, in-progress, completed, cancelled
    this.priority = data.priority || 'medium'; // low, medium, high
    this.dueDate = data.dueDate;
    this.estimatedHours = data.estimatedHours;
    this.actualHours = data.actualHours;
    this.progress = data.progress || 0; // 0-100
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.completedAt = data.completedAt;
  }

  static async create(taskData) {
    try {
      const taskRef = await db.collection('tasks').add({
        ...taskData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: taskRef.id, ...taskData };
    } catch (error) {
      throw new Error('Error creating task: ' + error.message);
    }
  }

  static async findById(id) {
    try {
      const doc = await db.collection('tasks').doc(id).get();
      if (!doc.exists) return null;
      
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error('Error finding task: ' + error.message);
    }
  }

  static async findByProject(projectId) {
    try {
      const snapshot = await db.collection('tasks').where('projectId', '==', projectId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error finding tasks: ' + error.message);
    }
  }

  static async findByAssignee(assignedTo) {
    try {
      const snapshot = await db.collection('tasks').where('assignedTo', '==', assignedTo).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error('Error finding tasks: ' + error.message);
    }
  }

  static async update(id, updateData) {
    try {
      await db.collection('tasks').doc(id).update({
        ...updateData,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw new Error('Error updating task: ' + error.message);
    }
  }

  static async delete(id) {
    try {
      await db.collection('tasks').doc(id).delete();
      return true;
    } catch (error) {
      throw new Error('Error deleting task: ' + error.message);
    }
  }

  static async updateProgress(id, progress) {
    try {
      const updateData = { progress, updatedAt: new Date() };
      if (progress === 100) {
        updateData.status = 'completed';
        updateData.completedAt = new Date();
      }
      
      await db.collection('tasks').doc(id).update(updateData);
      return true;
    } catch (error) {
      throw new Error('Error updating task progress: ' + error.message);
    }
  }

  static async getProjectProgress(projectId) {
    try {
      const tasks = await this.findByProject(projectId);
      if (tasks.length === 0) return 0;
      
      const totalProgress = tasks.reduce((sum, task) => sum + (task.progress || 0), 0);
      return Math.round(totalProgress / tasks.length);
    } catch (error) {
      throw new Error('Error calculating project progress: ' + error.message);
    }
  }
}

module.exports = Task;
