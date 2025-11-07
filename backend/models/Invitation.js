const { db } = require("../firebase-admin");

class Invitation {
  constructor(data) {
    this.id = data.id || null;
    this.projectId = data.projectId;
    this.freelancerId = data.freelancerId;
    this.clientEmail = data.clientEmail;
    this.token = data.token;
    this.status = data.status || "pending"; // pending, accepted, rejected, expired, pending_review
    this.createdAt = data.createdAt || new Date();
    this.expiresAt =
      data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    this.acceptedAt = data.acceptedAt || null;
    this.clientId = data.clientId || null;
  }

  // Create a new invitation
  static async create(invitationData) {
    try {
      const invitation = new Invitation(invitationData);
      const docRef = await db.collection("invitations").add({
        projectId: invitation.projectId,
        freelancerId: invitation.freelancerId,
        clientEmail: invitation.clientEmail,
        token: invitation.token,
        status: invitation.status,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        clientId: invitation.clientId,
      });

      return { success: true, invitationId: docRef.id, data: invitation };
    } catch (error) {
      console.error("Error creating invitation:", error);
      return { success: false, error: error.message };
    }
  }

  // Find invitation by token
  static async findByToken(token) {
    try {
      const snapshot = await db
        .collection("invitations")
        .where("token", "==", token)
        .get();

      if (snapshot.empty) {
        return { success: false, error: "Invitation not found" };
      }

      const doc = snapshot.docs[0];
      const invitationData = { id: doc.id, ...doc.data() };

      return { success: true, data: invitationData };
    } catch (error) {
      console.error("Error finding invitation:", error);
      return { success: false, error: error.message };
    }
  }

  // Find invitations by client email
  static async findByClientEmail(clientEmail) {
    try {
      const snapshot = await db
        .collection("invitations")
        .where("clientEmail", "==", clientEmail)
        .get();

      const invitations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { success: true, data: invitations };
    } catch (error) {
      console.error("Error finding invitations by email:", error);
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
        return { success: false, error: "Invitation has expired" };
      }

      // Check if invitation is already accepted
      if (invitation.status === "accepted") {
        return { success: false, error: "Invitation already accepted" };
      }

      // Check if invitation is already rejected
      if (invitation.status === "rejected") {
        return { success: false, error: "Invitation already rejected" };
      }

      // Update invitation status
      await db.collection("invitations").doc(invitation.id).update({
        status: "accepted",
        clientId: clientId,
        acceptedAt: new Date(),
      });

      // Update project with clientId and change status to pending_contract
      await db.collection("projects").doc(invitation.projectId).update({
        clientId: clientId,
        status: "pending_contract", 
        updatedAt: new Date(),
      });
      console.log(
        "Project status updated successfully - awaiting contract signatures",
      );

      return { success: true, data: invitation };
    } catch (error) {
      console.error("Error accepting invitation:", error);
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
        return { success: false, error: "Invitation has expired" };
      }

      // Check if invitation is already rejected
      if (invitation.status === "rejected") {
        return { success: false, error: "Invitation already rejected" };
      }

      // No need to check if contract has been signed; after signing, invitation should disappear

      // Update invitation status
      await db.collection("invitations").doc(invitation.id).update({
        status: "rejected",
        rejectedAt: new Date(),
      });

      // Update project status to rejected as well
      await db.collection("projects").doc(invitation.projectId).update({
        status: "rejected",
        updatedAt: new Date(),
      });

      return { success: true, data: invitation };
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      return { success: false, error: error.message };
    }
  }

  // Mark invitation for review later (client wants to think about it)
  static async markForReview(token, clientId) {
    try {
      const invitationResult = await Invitation.findByToken(token);

      if (!invitationResult.success) {
        return invitationResult;
      }

      const invitation = invitationResult.data;

      // Check if invitation is expired
      if (new Date() > invitation.expiresAt.toDate()) {
        return { success: false, error: "Invitation has expired" };
      }

      // Check if invitation is already accepted
      if (invitation.status === "accepted") {
        return { success: false, error: "Invitation already accepted" };
      }

      // Check if invitation is already rejected
      if (invitation.status === "rejected") {
        return { success: false, error: "Invitation already rejected" };
      }

      // Update invitation status to pending_review
      await db.collection("invitations").doc(invitation.id).update({
        status: "pending_review",
        clientId: clientId,
        reviewMarkedAt: new Date(),
      });

      // Update project with clientId but keep status as pending_invitation
      // Client has acknowledged but hasn't committed yet
      console.log(
        "Marking invitation for review later for project:",
        invitation.projectId,
      );
      await db.collection("projects").doc(invitation.projectId).update({
        clientId: clientId,
        status: "pending_review", // Client is considering the invitation
        updatedAt: new Date(),
      });
      console.log(
        "Project status updated to pending_review - client will decide later",
      );

      return { success: true, data: invitation };
    } catch (error) {
      console.error("Error marking invitation for review:", error);
      return { success: false, error: error.message };
    }
  }

  // Accept invitation from pending_review state
  static async acceptFromReview(invitationId, clientId) {
    try {
      const snapshot = await db
        .collection("invitations")
        .doc(invitationId)
        .get();

      if (!snapshot.exists) {
        return { success: false, error: "Invitation not found" };
      }

      const invitation = { id: snapshot.id, ...snapshot.data() };

      // Check if invitation is expired
      if (new Date() > invitation.expiresAt.toDate()) {
        return { success: false, error: "Invitation has expired" };
      }

      // Update invitation status
      await db.collection("invitations").doc(invitation.id).update({
        status: "accepted",
        acceptedAt: new Date(),
      });

      // Update project to pending_contract
      console.log(
        "Accepting invitation from review state for project:",
        invitation.projectId,
      );
      await db.collection("projects").doc(invitation.projectId).update({
        status: "pending_contract", // Wait for contract signatures before activating
        updatedAt: new Date(),
      });
      console.log(
        "Project status updated successfully - awaiting contract signatures",
      );

      return { success: true, data: invitation };
    } catch (error) {
      console.error("Error accepting invitation from review:", error);
      return { success: false, error: error.message };
    }
  }

  // Find invitations by client ID (for dashboard)
  static async findByClientId(clientId) {
    try {
      const snapshot = await db
        .collection("invitations")
        .where("clientId", "==", clientId)
        .get();

      const invitations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { success: true, data: invitations };
    } catch (error) {
      console.error("Error finding invitations by client ID:", error);
      return { success: false, error: error.message };
    }
  }

  // Generate secure token
  static generateToken() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Date.now().toString(36)
    );
  }
}

module.exports = Invitation;
