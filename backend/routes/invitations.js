const express = require("express");
const router = express.Router();
const Invitation = require("../models/Invitation");
const Contract = require("../models/Contract");
const { db } = require("../firebase-admin");
const { sendEmail, sendInvitationAcceptanceEmail, sendInvitationRejectionEmail } = require("../services/emailService");

// Create invitation
router.post("/create", async (req, res) => {
  try {
    const { projectId, freelancerId, clientEmail } = req.body;

    if (!projectId || !freelancerId || !clientEmail) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: projectId, freelancerId, clientEmail",
      });
    }

    // Generate unique token
    const token = Invitation.generateToken();

    // Create invitation
    const invitationData = {
      projectId,
      freelancerId,
      clientEmail,
      token,
    };

    const result = await Invitation.create(invitationData);

    if (result.success) {
      const invitationLink = `${process.env.CLIENT_URL || "http://localhost:3000"}/invite/${token}`;

      // Get project and freelancer details for the email
      const projectDoc = await db.collection("projects").doc(projectId).get();
      const freelancerDoc = await db
        .collection("users")
        .doc(freelancerId)
        .get();

      const projectData = projectDoc.exists ? projectDoc.data() : {};
      const freelancerData = freelancerDoc.exists ? freelancerDoc.data() : {};

      // Pre-generate contract for this project with freelancer auto-signed
      const contractData = {
        projectId,
        freelancerId,
        clientId: null, // Will be filled when client accepts
        title: projectData.title || "Project Contract",
        scope: projectData.description || "Project scope to be defined",
        deliverables: projectData.deliverables || [],
        paymentTerms: projectData.paymentTerms || "Payment upon completion",
        hourlyRate: projectData.hourlyRate || null,
        fixedPrice: projectData.budget || null,
        startDate: projectData.startDate || new Date(),
        endDate: projectData.dueDate || null,
        milestones: projectData.milestones || [],
        revisionPolicy:
          "Standard revisions included as per project requirements",
        paymentPolicy: projectData.paymentPolicy || "milestone", // 'milestone' or 'end'

        // Billable hours cap (not-to-exceed contract)
        enableBillableHours: projectData.enableBillableHours || false,
        maxBillableHours: projectData.maxBillableHours || null,

        // Additional contract terms
        invoicingSchedule:
          projectData.invoicingSchedule || "Upon milestone completion",
        invoicingTerms: "Payment due within 7 days of invoice issuance",
        lateFeePolicy: "5% late fee applied after 14 days overdue",
        terminationClause:
          "This contract may be terminated by the client if the freelancer fails to complete the project as agreed. Failure to deliver the required work, meet deadlines, or achieve key project milestones will result in contract termination at the client's discretion.",
        confidentialityClause:
          "Both parties agree to maintain confidentiality of all project information and materials.",
        intellectualPropertyClause:
          "Upon receipt of full payment, all intellectual property rights for work created under this contract transfer to the client.",

        // Freelancer information (auto-filled)
        freelancerName: freelancerData.username || freelancerData.email,
        freelancerAddress: freelancerData.address || "Address not provided",
        freelancerPhone: freelancerData.phone || "Phone not provided",

        // Client information (will be filled when client accepts)
        clientName: null,
        clientAddress: null,
        clientPhone: null,

        status: "pending",

        // Auto-sign for freelancer (since they're creating the project)
        freelancerSignature: freelancerData.username || freelancerData.email,
        freelancerSignedAt: new Date(),

        clientSignature: null,
        clientSignedAt: null,
      };

      // Update project status to 'pending_invitation' so frontend can categorize it correctly
      try {
        await db.collection("projects").doc(projectId).update({
          status: "pending_invitation",
          updatedAt: new Date(),
        });
        console.log(
          "Project status updated to pending_invitation for project:",
          projectId,
        );
      } catch (updateError) {
        console.error(
          "Failed to update project status to pending_invitation:",
          updateError,
        );
      }

      const contractResult = await Contract.create(contractData);
      console.log(
        "✅ Contract created and auto-signed by freelancer:",
        contractResult.contractId,
      );

      // Update project status to 'pending_invitation' so frontend can categorize it correctly
      try {
        await db.collection("projects").doc(projectId).update({
          status: "pending_invitation",
          updatedAt: new Date(),
        });
        console.log(
          "Project status updated to pending_invitation for project:",
          projectId,
        );
      } catch (updateError) {
        console.error(
          "Failed to update project status to pending_invitation:",
          updateError,
        );
      }

      // Send invitation email with contract preview
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER || "your-email@gmail.com",
          to: clientEmail,
          subject: `🎯 Project Collaboration Invitation: ${projectData.title || "New Project"}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
              <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; text-align: center; border-bottom: 3px solid #007bff; padding-bottom: 15px;">🎯 Project Collaboration Invitation</h2>
                <p>Hello,</p>
                <p><strong>${freelancerData.username || freelancerData.email || "A freelancer"}</strong> has invited you to collaborate on a project:</p>
                <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #007bff;">
                  <h3 style="margin-top: 0; color: #333;">${projectData.title || "New Project"}</h3>
                  ${projectData.description ? `<p><strong>📝 Description:</strong><br>${projectData.description}</p>` : ""}
                  ${projectData.hourlyRate ? `<p><strong>💰 Hourly Rate:</strong> RM${projectData.hourlyRate}/hour</p>` : ""}
                  ${projectData.startDate || projectData.dueDate ? `<p><strong>📅 Timeline:</strong><br>${projectData.startDate ? `Start: ${new Date(projectData.startDate).toLocaleDateString()}` : ""}${projectData.startDate && projectData.dueDate ? "<br>" : ""}${projectData.dueDate ? `Due: ${new Date(projectData.dueDate).toLocaleDateString()}` : ""}</p>` : ""}
                </div>
                <!-- Contract Preview Section -->
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
                  <h3 style="margin-top: 0; color: #856404;">📄 Contract Terms Preview</h3>
                  <p style="color: #856404; margin-bottom: 15px;">
                    <em>By accepting this invitation, you will be asked to review and sign a contract with the following terms:</em>
                  </p>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Payment Terms:</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;">${contractData.paymentTerms}</td>
                    </tr>
                    ${
                      contractData.hourlyRate
                        ? `
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Hourly Rate:</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;">RM${contractData.hourlyRate}/hour</td>
                    </tr>
                    `
                        : ""
                    }
                    ${
                      contractData.fixedPrice
                        ? `
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Fixed Price:</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;">RM${contractData.fixedPrice}</td>
                    </tr>
                    `
                        : ""
                    }
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Start Date:</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;">${new Date(contractData.startDate).toLocaleDateString()}</td>
                    </tr>
                    ${
                      contractData.endDate
                        ? `
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>End Date:</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;">${new Date(contractData.endDate).toLocaleDateString()}</td>
                    </tr>
                    `
                        : ""
                    }
                    <tr>
                      <td style="padding: 10px;"><strong>Revision Policy:</strong></td>
                      <td style="padding: 10px;">${contractData.revisionPolicy}</td>
                    </tr>
                  </table>
                  <p style="color: #856404; margin-top: 15px; font-size: 13px;">
                    <strong>⚠️ Important:</strong> You will need to review and sign the complete contract before work can begin on this project.
                  </p>
                </div>
                <div style="background-color: #e3f2fd; padding: 20px; border-radius: 6px; margin: 20px 0;">
                  <h4 style="margin-top: 0; color: #1976d2;">📞 Contact Information</h4>
                  <p><strong>Freelancer:</strong> ${freelancerData.username || "Unknown"}</p>
                  <p><strong>Email:</strong> ${freelancerData.email || "Not provided"}</p>
                  ${freelancerData.phone ? `<p><strong>Phone:</strong> ${freelancerData.phone}</p>` : ""}
                </div>
                <p style="color: #666; font-size: 14px;">
                  <strong>⏰ This invitation will expire in 7 days.</strong> If you have any questions about this project, feel free to contact the freelancer directly using the information above.
                </p>
                <p style="color: #666; font-size: 14px;">
                  If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>
            </div>
          `,
        };
        await sendEmail(mailOptions);
        console.log("Invitation email sent successfully to:", clientEmail);
      } catch (emailError) {
        console.error("Error sending invitation email:", emailError);
        // Don't fail the invitation creation if email fails
      }

      res.json({
        success: true,
        invitationId: result.invitationId,
        token: token,
        invitationLink: invitationLink,
        contractId: contractResult.contractId,
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error("Error creating invitation:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invitation by token
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const result = await Invitation.findByToken(token);

    if (result.success) {
      // Check if invitation is expired
      if (new Date() > result.data.expiresAt.toDate()) {
        return res.status(400).json({
          success: false,
          error: "Invitation has expired",
        });
      }

      // Check if already accepted
      if (result.data.status === "accepted") {
        return res.status(400).json({
          success: false,
          error: "Invitation already accepted",
        });
      }

      res.json({
        success: true,
        invitation: result.data,
      });
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error("Error getting invitation:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Accept invitation
router.post("/accept", async (req, res) => {
  try {
    const { token, clientId } = req.body;

    if (!token || !clientId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: token, clientId",
      });
    }

    const result = await Invitation.accept(token, clientId);

    if (result.success) {
      // Get invitation and project details
      const invitationData = result.data;
      const projectDoc = await db
        .collection("projects")
        .doc(invitationData.projectId)
        .get();

      if (projectDoc.exists) {
        const projectData = projectDoc.data();

        // Find existing contract (created when invitation was sent)
        console.log(
          "🔍 Looking for contract for project:",
          invitationData.projectId,
        );
        const contractResult = await Contract.findByProjectId(
          invitationData.projectId,
        );
        console.log("📄 Contract lookup result:", contractResult);

        if (contractResult.success) {
          console.log("✅ Found existing contract:", contractResult.data.id);
          // Update contract with client ID now that we know who they are
          await db.collection("contracts").doc(contractResult.data.id).update({
            clientId: clientId,
            updatedAt: new Date(),
          });

          console.log("✅ Contract updated with clientId:", clientId);

          // Send email notification to freelancer
          try {
            const freelancerDoc = await db
              .collection("users")
              .doc(invitationData.freelancerId)
              .get();
            const clientDoc = await db.collection("users").doc(clientId).get();

            if (freelancerDoc.exists()) {
              const freelancerEmail = freelancerDoc.data().email;
              const clientName =
                clientDoc.exists() && clientDoc.data().fullName
                  ? clientDoc.data().fullName
                  : invitationData.clientEmail;

              await sendInvitationAcceptanceEmail(freelancerEmail, projectData.title, clientName);
              console.log(`✅ Invitation acceptance email sent to freelancer`);
            }
          } catch (emailError) {
            console.error(
              "❌ Error sending invitation acceptance email:",
              emailError,
            );
          }

          res.json({
            success: true,
            message:
              "Invitation accepted successfully. Please review and sign the contract to begin work.",
            projectId: result.data.projectId,
            contractId: contractResult.data.id,
            requiresSignature: true,
          });
        } else {
          // Fallback: Create contract if it doesn't exist
          console.log("⚠️ No existing contract found, creating new one...");
          const contractData = {
            projectId: invitationData.projectId,
            freelancerId: invitationData.freelancerId,
            clientId: clientId,
            title: projectData.title || "Project Contract",
            scope: projectData.description || "Project scope to be defined",
            deliverables: projectData.deliverables || [],
            paymentTerms: projectData.paymentTerms || "Payment upon completion",
            hourlyRate: projectData.hourlyRate || null,
            fixedPrice: projectData.budget || null,
            startDate: projectData.startDate || new Date(),
            endDate: projectData.dueDate || null,
            milestones: projectData.milestones || [],
            revisionPolicy:
              "Standard revisions included as per project requirements",
            status: "pending",
          };

          const newContractResult = await Contract.create(contractData);

          res.json({
            success: true,
            message:
              "Invitation accepted successfully. Contract generated - please review and sign to begin work.",
            projectId: result.data.projectId,
            contractId: newContractResult.contractId,
            requiresSignature: true,
          });
        }
      } else {
        res.json({
          success: true,
          message: "Invitation accepted successfully",
          projectId: result.data.projectId,
        });
      }
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject invitation
router.post("/reject", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: token",
      });
    }

    const result = await Invitation.reject(token);

    if (result.success) {
      // Send email notification to freelancer
      try {
        const invitationData = result.data;
        const projectDoc = await db
          .collection("projects")
          .doc(invitationData.projectId)
          .get();
        const freelancerDoc = await db
          .collection("users")
          .doc(invitationData.freelancerId)
          .get();

        if (projectDoc.exists && freelancerDoc.exists) {
          const projectData = projectDoc.data();
          const freelancerEmail = freelancerDoc.data().email;

          await sendInvitationRejectionEmail(freelancerEmail, projectData.title, clientName, reason);
          console.log(`✅ Rejection notification email sent to freelancer`);
        }
      } catch (emailError) {
        console.error(
          "❌ Error sending rejection notification email:",
          emailError,
        );
        // Don't fail the rejection if email fails
      }

      res.json({
        success: true,
        message: "Invitation rejected successfully",
        projectId: result.data.projectId,
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error rejecting invitation:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check if client exists by email
router.post("/check-client", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    // Check if user exists with this email
    const snapshot = await db
      .collection("users")
      .where("email", "==", email)
      .where("role", "==", "client")
      .get();

    if (snapshot.empty) {
      res.json({
        success: true,
        exists: false,
        message: "Client not found",
      });
    } else {
      const userData = snapshot.docs[0].data();
      res.json({
        success: true,
        exists: true,
        clientId: snapshot.docs[0].id,
        client: userData,
      });
    }
  } catch (error) {
    console.error("Error checking client:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get project details for invitation
router.get("/:token/project", async (req, res) => {
  try {
    const { token } = req.params;

    // Get invitation first
    const invitationResult = await Invitation.findByToken(token);

    if (!invitationResult.success) {
      return res.status(404).json(invitationResult);
    }

    // Get project details
    const projectDoc = await db
      .collection("projects")
      .doc(invitationResult.data.projectId)
      .get();

    if (!projectDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    const projectData = { id: projectDoc.id, ...projectDoc.data() };

    // Get freelancer details
    const freelancerDoc = await db
      .collection("users")
      .doc(projectData.freelancerId)
      .get();
    const freelancerData = freelancerDoc.exists ? freelancerDoc.data() : null;

    res.json({
      success: true,
      project: projectData,
      freelancer: freelancerData,
    });
  } catch (error) {
    console.error("Error getting project details:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark invitation for review later
router.post("/review-later", async (req, res) => {
  try {
    const { token, clientId } = req.body;

    if (!token || !clientId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: token, clientId",
      });
    }

    const result = await Invitation.markForReview(token, clientId);

    if (result.success) {
      res.json({
        success: true,
        message:
          "Invitation saved for later review. You can accept it from your dashboard when ready.",
        projectId: result.data.projectId,
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error marking invitation for review:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Accept invitation from pending_review state
router.post("/accept-from-review", async (req, res) => {
  try {
    const { invitationId, clientId } = req.body;

    if (!invitationId || !clientId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: invitationId, clientId",
      });
    }

    const result = await Invitation.acceptFromReview(invitationId, clientId);

    if (result.success) {
      // Get invitation and project details
      const invitationData = result.data;
      const projectDoc = await db
        .collection("projects")
        .doc(invitationData.projectId)
        .get();

      if (projectDoc.exists) {
        // Find existing contract (created when invitation was sent)
        const contractResult = await Contract.findByProjectId(
          invitationData.projectId,
        );

        if (contractResult.success) {
          // Update contract with client ID if not already set
          const contractDoc = await db
            .collection("contracts")
            .doc(contractResult.data.id)
            .get();
          const contractData = contractDoc.data();

          if (!contractData.clientId) {
            await db
              .collection("contracts")
              .doc(contractResult.data.id)
              .update({
                clientId: clientId,
                updatedAt: new Date(),
              });
          }

          res.json({
            success: true,
            message:
              "Invitation accepted successfully. Please review and sign the contract to begin work.",
            projectId: result.data.projectId,
            contractId: contractResult.data.id,
            requiresSignature: true,
          });
        } else {
          // Fallback: Create contract if it doesn't exist
          const projectData = projectDoc.data();
          const contractData = {
            projectId: invitationData.projectId,
            freelancerId: invitationData.freelancerId,
            clientId: clientId,
            title: projectData.title || "Project Contract",
            scope: projectData.description || "Project scope to be defined",
            deliverables: projectData.deliverables || [],
            paymentTerms: projectData.paymentTerms || "Payment upon completion",
            hourlyRate: projectData.hourlyRate || null,
            fixedPrice: projectData.budget || null,
            startDate: projectData.startDate || new Date(),
            endDate: projectData.dueDate || null,
            milestones: projectData.milestones || [],
            revisionPolicy:
              "Standard revisions included as per project requirements",
            status: "pending",
          };

          const newContractResult = await Contract.create(contractData);

          res.json({
            success: true,
            message:
              "Invitation accepted successfully. Contract generated - please review and sign to begin work.",
            projectId: result.data.projectId,
            contractId: newContractResult.contractId,
            requiresSignature: true,
          });
        }
      } else {
        res.json({
          success: true,
          message: "Invitation accepted successfully",
          projectId: result.data.projectId,
        });
      }
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error accepting invitation from review:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invitations by client ID (for client dashboard)
router.get("/client/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }

    const result = await Invitation.findByClientId(clientId);

    if (result.success) {
      // Enrich invitations with project details
      const enrichedInvitations = await Promise.all(
        result.data.map(async (invitation) => {
          try {
            const projectDoc = await db
              .collection("projects")
              .doc(invitation.projectId)
              .get();
            const freelancerDoc = await db
              .collection("users")
              .doc(invitation.freelancerId)
              .get();

            return {
              ...invitation,
              project: projectDoc.exists
                ? { id: projectDoc.id, ...projectDoc.data() }
                : null,
              freelancer: freelancerDoc.exists
                ? { id: freelancerDoc.id, ...freelancerDoc.data() }
                : null,
            };
          } catch (err) {
            console.error("Error enriching invitation:", invitation.id, err);
            return invitation;
          }
        }),
      );

      res.json({
        success: true,
        invitations: enrichedInvitations,
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error("Error getting client invitations:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invitations by client email (for client dashboard when logged in)
router.get("/by-email/:email", async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const result = await Invitation.findByClientEmail(email);

    if (result.success) {
      // Enrich invitations with project details
      const enrichedInvitations = await Promise.all(
        result.data.map(async (invitation) => {
          try {
            const projectDoc = await db
              .collection("projects")
              .doc(invitation.projectId)
              .get();
            const freelancerDoc = await db
              .collection("users")
              .doc(invitation.freelancerId)
              .get();

            // Get contract if exists
            let contract = null;
            try {
              const contractResult = await Contract.findByProjectId(
                invitation.projectId,
              );
              if (contractResult.success) {
                contract = contractResult.data;
              }
            } catch (contractErr) {
              console.log(
                "No contract found for project:",
                invitation.projectId,
              );
            }

            return {
              ...invitation,
              project: projectDoc.exists
                ? { id: projectDoc.id, ...projectDoc.data() }
                : null,
              freelancer: freelancerDoc.exists
                ? { id: freelancerDoc.id, ...freelancerDoc.data() }
                : null,
              contract: contract,
            };
          } catch (err) {
            console.error("Error enriching invitation:", invitation.id, err);
            return invitation;
          }
        }),
      );

      res.json({
        success: true,
        invitations: enrichedInvitations,
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error("Error getting invitations by email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
