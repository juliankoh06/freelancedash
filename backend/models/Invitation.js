const { db } = require('../firebase-config');

class Invitation {
  constructor(data) {
    this.id = data.id || null;
    this.projectId = data.projectId;
    this.freelancerId = data.freelancerId;
    this.clientEmail = data.clientEmail;
    this.token = data.token;
    this.status = data.status || 'pending'; // pending, accepted, expired
    this.createdAt = data.createdAt || new Date();
    this.expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    this.acceptedAt = data.acceptedAt || null;
    this.clientId = data.clientId || null;
  }

  // Create a new invitation
  static async create(invitationData) {
    try {
      const invitation = new Invitation(invitationData);
      const docRef = await db.collection('invitations').add({
        projectId: invitation.projectId,
        freelancerId: invitation.freelancerId,
        clientEmail: invitation.clientEmail,
        token: invitation.token,
        status: invitation.status,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        clientId: invitation.clientId
      });
      
      return { success: true, invitationId: docRef.id, data: invitation };
    } catch (error) {
      console.error('Error creating invitation:', error);
      return { success: false, error: error.message };
    }
  }

  // Find invitation by token
  static async findByToken(token) {
    try {
      const snapshot = await db.collection('invitations')
        .where('token', '==', token)
        .get();
      
      if (snapshot.empty) {
        return { success: false, error: 'Invitation not found' };
      }
      
      const doc = snapshot.docs[0];
      const invitationData = { id: doc.id, ...doc.data() };
      
      return { success: true, data: invitationData };
    } catch (error) {
      console.error('Error finding invitation:', error);
      return { success: false, error: error.message };
    }
  }

  // Find invitations by client email
  static async findByClientEmail(clientEmail) {
    try {
      const snapshot = await db.collection('invitations')
        .where('clientEmail', '==', clientEmail)
        .get();
      
      const invitations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return { success: true, data: invitations };
    } catch (error) {
      console.error('Error finding invitations by email:', error);
      return { success: false, error: error.message };
    }
  }

  // Accept invitation
  static async accept(token, clientId) {
    try {
      const invitationResult = await Invitation.findByToken(token);
      
      if (!invitationResult.success) {
        return invitationResult;
      }
      
      const invitation = invitationResult.data;
      
      // Check if invitation is expired
      if (new Date() > invitation.expiresAt.toDate()) {
        return { success: false, error: 'Invitation has expired' };
      }
      
      // Check if invitation is already accepted
      if (invitation.status === 'accepted') {
        return { success: false, error: 'Invitation already accepted' };
      }
      
      // Check if invitation is already rejected
      if (invitation.status === 'rejected') {
        return { success: false, error: 'Invitation already rejected' };
      }
      
      // Update invitation status
      await db.collection('invitations').doc(invitation.id).update({
        status: 'accepted',
        clientId: clientId,
        acceptedAt: new Date()
      });
      
      // Update project with clientId and change status to active
      console.log('Updating project status from pending_approval to active for project:', invitation.projectId);
      await db.collection('projects').doc(invitation.projectId).update({
        clientId: clientId,
        status: 'active', // Change from pending_approval to active
        updatedAt: new Date()
      });
      console.log('Project status updated successfully');
      
      return { success: true, data: invitation };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: error.message };
    }
  }

  // Reject invitation
  static async reject(token) {
    try {
      const invitationResult = await Invitation.findByToken(token);
      
      if (!invitationResult.success) {
        return invitationResult;
      }
      
      const invitation = invitationResult.data;
      
      // Check if invitation is expired
      if (new Date() > invitation.expiresAt.toDate()) {
        return { success: false, error: 'Invitation has expired' };
      }
      
      // Check if invitation is already accepted
      if (invitation.status === 'accepted') {
        return { success: false, error: 'Invitation already accepted' };
      }
      
      // Check if invitation is already rejected
      if (invitation.status === 'rejected') {
        return { success: false, error: 'Invitation already rejected' };
      }
      
      // Update invitation status
      await db.collection('invitations').doc(invitation.id).update({
        status: 'rejected',
        rejectedAt: new Date()
      });
      
      return { success: true, data: invitation };
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate secure token
  static generateToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) +
           Date.now().toString(36);
  }
}

module.exports = Invitation;
