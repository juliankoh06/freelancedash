import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase-config';

export const projectsAPI = {
  // Get all projects
  async getAllProjects() {
    try {
      const projectsQuery = query(collection(db, 'projects'));
      const projectsSnapshot = await getDocs(projectsQuery);
      return projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  // Get projects by freelancer
  async getProjectsByFreelancer(freelancerId) {
    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('freelancerId', '==', freelancerId)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      return projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching freelancer projects:', error);
      throw error;
    }
  },

  // Create a new project
  async createProject(projectData) {
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        ...projectData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: docRef.id, ...projectData };
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  },

  // Update a project
  async updateProject(projectId, updateData) {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        ...updateData,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  },

  // Delete a project
  async deleteProject(projectId) {
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }
};

export const tasksAPI = {
  // Get all tasks
  async getAllTasks() {
    try {
      const tasksQuery = query(collection(db, 'tasks'));
      const tasksSnapshot = await getDocs(tasksQuery);
      return tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  },

  // Get tasks by project
  async getTasksByProject(projectId) {
    try {
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      return tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching project tasks:', error);
      throw error;
    }
  },

  // Get tasks by assignee
  async getTasksByAssignee(assignedTo) {
    try {
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', assignedTo)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      return tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching assignee tasks:', error);
      throw error;
    }
  },

  // Create a new task
  async createTask(taskData) {
    try {
      const docRef = await addDoc(collection(db, 'tasks'), {
        ...taskData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: docRef.id, ...taskData };
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  // Update a task
  async updateTask(taskId, updateData) {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        ...updateData,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Update task status
  async updateTaskStatus(taskId, status) {
    try {
      const updateData = { status, updatedAt: new Date() };
      if (status === 'completed') {
        updateData.completedAt = new Date();
      }
      
      await updateDoc(doc(db, 'tasks', taskId), updateData);
      return true;
    } catch (error) {
      console.error('Error updating task status:', error);
      throw error;
    }
  },

  // Delete a task
  async deleteTask(taskId) {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }
};

export const invoicesAPI = {
  // Get all invoices
  async getAllInvoices() {
    try {
      const invoicesQuery = query(collection(db, 'invoices'));
      const invoicesSnapshot = await getDocs(invoicesQuery);
      return invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  },

  // Get invoices by freelancer
  async getInvoicesByFreelancer(freelancerId) {
    try {
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('freelancerId', '==', freelancerId)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      return invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching freelancer invoices:', error);
      throw error;
    }
  },

  // Create a new invoice
  async createInvoice(invoiceData) {
    try {
      const docRef = await addDoc(collection(db, 'invoices'), {
        ...invoiceData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: docRef.id, ...invoiceData };
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  },

  // Update an invoice
  async updateInvoice(invoiceId, updateData) {
    try {
      await updateDoc(doc(db, 'invoices', invoiceId), {
        ...updateData,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  },

  // Delete an invoice
  async deleteInvoice(invoiceId) {
    try {
      await deleteDoc(doc(db, 'invoices', invoiceId));
      return true;
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  }
};
