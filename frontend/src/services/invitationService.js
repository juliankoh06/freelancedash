// Invitation Service for handling client invitations
class InvitationService {
  constructor() {
    this.baseURL = "http://localhost:5000/api/invitations";
  }

  // Create invitation for a project
  async createInvitation(projectId, freelancerId, clientEmail) {
    try {
      const response = await fetch(`${this.baseURL}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          freelancerId,
          clientEmail,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("Invitation created successfully:", result.invitationId);
        return { success: true, data: result };
      } else {
        console.error("Failed to create invitation:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error creating invitation:", error);
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
      console.error("Error getting invitation:", error);
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
      console.error("Error getting project details:", error);
      return { success: false, error: error.message };
    }
  }

  // Check if client exists by email
  async checkClientExists(email) {
    try {
      const response = await fetch(`${this.baseURL}/check-client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error checking client:", error);
      return { success: false, error: error.message };
    }
  }

  // Accept invitation
  async acceptInvitation(token, clientId) {
    try {
      const response = await fetch(`${this.baseURL}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          clientId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("Invitation accepted successfully");
        return { success: true, data: result };
      } else {
        console.error("Failed to accept invitation:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      return { success: false, error: error.message };
    }
  }

  // Reject invitation
  async rejectInvitation(token) {
    try {
      const response = await fetch(`${this.baseURL}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("Invitation rejected successfully");
        return { success: true, data: result };
      } else {
        console.error("Failed to reject invitation:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      return { success: false, error: error.message };
    }
  }

  // Send invitation email
  async sendInvitationEmail(
    clientEmail,
    invitationLink,
    projectTitle,
    freelancerName,
    freelancerEmail,
  ) {
    try {
      const response = await fetch(
        "http://localhost:5000/api/email/send-invitation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientEmail,
            invitationLink,
            projectTitle,
            freelancerName,
            freelancerEmail,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        console.log("✅ Invitation email sent successfully:", result.messageId);
        return { success: true, messageId: result.messageId };
      } else {
        console.error("❌ Failed to send invitation email:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("❌ Error sending invitation email:", error);
      return { success: false, error: error.message };
    }
  }

  // Mark invitation for review later (client wants to think about it)
  async markForReviewLater(token, clientId) {
    try {
      const response = await fetch(`${this.baseURL}/review-later`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          clientId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("Invitation marked for review later");
        return { success: true, data: result };
      } else {
        console.error("Failed to mark invitation for review:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error marking invitation for review:", error);
      return { success: false, error: error.message };
    }
  }

  // Accept invitation from pending_review state
  async acceptFromReview(invitationId, clientId) {
    try {
      const response = await fetch(`${this.baseURL}/accept-from-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invitationId,
          clientId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("Invitation accepted from review successfully");
        return { success: true, data: result };
      } else {
        console.error("Failed to accept invitation from review:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error accepting invitation from review:", error);
      return { success: false, error: error.message };
    }
  }

  // Get invitations by client ID (for client dashboard)
  async getInvitationsByClientId(clientId) {
    try {
      const response = await fetch(`${this.baseURL}/client/${clientId}`);
      const result = await response.json();

      if (result.success) {
        return { success: true, invitations: result.invitations };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error getting client invitations:", error);
      return { success: false, error: error.message };
    }
  }

  // Get invitations by client email (for client dashboard when logged in)
  async getInvitationsByClientEmail(email) {
    try {
      const response = await fetch(
        `${this.baseURL}/by-email/${encodeURIComponent(email)}`,
      );
      const result = await response.json();

      if (result.success) {
        return { success: true, invitations: result.invitations };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error getting invitations by email:", error);
      return { success: false, error: error.message };
    }
  }
}

const invitationService = new InvitationService();
export default invitationService;
