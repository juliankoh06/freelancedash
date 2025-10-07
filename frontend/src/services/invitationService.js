// Invitation Service for handling client invitations
class InvitationService {
  constructor() {
    this.baseURL = 'http://localhost:5000/api/invitations';
  }

  // Create invitation for a project
  async createInvitation(projectId, freelancerId, clientEmail) {
    try {
      const response = await fetch(`${this.baseURL}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          freelancerId,
          clientEmail
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Invitation created successfully:', result.invitationId);
        return { success: true, data: result };
      } else {
        console.error('Failed to create invitation:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error creating invitation:', error);
      return { success: false, error: error.message };
    }
  }

  // Get invitation details by token
  async getInvitation(token) {
    try {
      const response = await fetch(`${this.baseURL}/${token}`);
      const result = await response.json();
      
      if (result.success) {
        return { success: true, data: result.invitation };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error getting invitation:', error);
      return { success: false, error: error.message };
    }
  }

  // Get project details for invitation
  async getProjectDetails(token) {
    try {
      const response = await fetch(`${this.baseURL}/${token}/project`);
      const result = await response.json();
      
      if (result.success) {
        return { success: true, data: result };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error getting project details:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if client exists by email
  async checkClientExists(email) {
    try {
      const response = await fetch(`${this.baseURL}/check-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error checking client:', error);
      return { success: false, error: error.message };
    }
  }

  // Accept invitation
  async acceptInvitation(token, clientId) {
    try {
      const response = await fetch(`${this.baseURL}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          clientId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Invitation accepted successfully');
        return { success: true, data: result };
      } else {
        console.error('Failed to accept invitation:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: error.message };
    }
  }

  // Reject invitation
  async rejectInvitation(token) {
    try {
      const response = await fetch(`${this.baseURL}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Invitation rejected successfully');
        return { success: true, data: result };
      } else {
        console.error('Failed to reject invitation:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      return { success: false, error: error.message };
    }
  }

  // Send invitation email
  async sendInvitationEmail(clientEmail, invitationLink, projectTitle, freelancerName, freelancerEmail) {
    try {
      const response = await fetch('http://localhost:5000/api/email/send-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientEmail,
          invitationLink,
          projectTitle,
          freelancerName,
          freelancerEmail
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Invitation email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
      } else {
        console.error('❌ Failed to send invitation email:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Error sending invitation email:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new InvitationService();
