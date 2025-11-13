const express = require("express");
const router = express.Router();
const { db } = require("../firebase-admin");
const admin = require("firebase-admin");
const InvoiceCalculationService = require("../services/invoiceCalculationService");
const invoiceCalculationService = new InvoiceCalculationService();
const { generateInvoicePDFBase64 } = require("../utils/pdfGenerator");
const { sendInvoiceEmailWithPDF } = require("./email");

/**
 * Calculate billable hours from project tasks
 * @param {string} projectId - The project ID
 * @param {number} hourlyRate - Hourly rate for the project
 * @param {string} contractId - Contract ID to check billable hours cap (optional)
 * @returns {Promise<{totalHours: number, totalAmount: number, cappedHours: number, cappedAmount: number, capped: boolean, warningMessage: string|null}>}
 */
async function calculateBillableHoursFromTasks(projectId, hourlyRate, contractId = null) {
  try {
    const tasksSnapshot = await db
      .collection("tasks")
      .where("projectId", "==", projectId)
      .where("billable", "==", true)
      .get();

    let totalHours = 0;
    
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      // Sum up actual hours or estimated hours for completed billable tasks
      const hours = task.actualHours || task.estimatedHours || 0;
      totalHours += hours;
    });

    // Check billable hours cap if contract ID provided
    let cappedHours = totalHours;
    let capped = false;
    let warningMessage = null;

    if (contractId) {
      try {
        const contractDoc = await db.collection("contracts").doc(contractId).get();
        if (contractDoc.exists) {
          const contract = contractDoc.data();
          
          if (contract.enableBillableHours && contract.maxBillableHours) {
            const cap = contract.maxBillableHours;
            
            if (totalHours > cap) {
              cappedHours = cap;
              capped = true;
              warningMessage = `Billable hours capped at ${cappedHours.toFixed(2)} hours (${totalHours.toFixed(2)} hours tracked, but contract cap is ${cap} hours)`;
              console.warn(` Billable hours capped for contract ${contractId}:`, warningMessage);
            }
          }
        }
      } catch (contractError) {
        console.error("Error checking contract billable hours cap:", contractError);
        // Continue without cap if contract check fails
      }
    }

    const cappedAmount = cappedHours * (hourlyRate || 0);
    const totalAmount = totalHours * (hourlyRate || 0);
    
    return { 
      totalHours, 
      totalAmount, 
      cappedHours, 
      cappedAmount,
      capped,
      warningMessage
    };
  } catch (error) {
    console.error("Error calculating billable hours:", error);
    return { totalHours: 0, totalAmount: 0, cappedHours: 0, cappedAmount: 0, capped: false, warningMessage: null };
  }
}

// Get all pending approvals for a client (milestones + completion requests)
router.get("/pending/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }

    // Get client's email from user document
    const clientDoc = await db.collection("users").doc(clientId).get();
    if (!clientDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Client not found",
      });
    }
    const clientEmail = clientDoc.data().email;

    // Fetch all client projects
    const projectsSnapshot = await db
      .collection("projects")
      .where("clientEmail", "==", clientEmail)
      .get();

    const pendingMilestones = [];
    const projectsData = [];

    // Process each project
    for (const projectDoc of projectsSnapshot.docs) {
      const project = { id: projectDoc.id, ...projectDoc.data() };
      projectsData.push(project);

      // Find pending milestones (completed but not approved)
      if (project.milestones && project.milestones.length > 0) {
        const pendingMilestonesInProject = project.milestones.filter(
          (m) => m.status === "completed" && !m.clientApproved,
        );

        // Fetch freelancer name
        let freelancerName = "Unknown";
        let freelancerEmail = "";
        try {
          if (project.freelancerId) {
            const freelancerDoc = await db
              .collection("users")
              .doc(project.freelancerId)
              .get();
            if (freelancerDoc.exists) {
              const freelancerData = freelancerDoc.data();
              freelancerName =
                freelancerData.username || freelancerData.email || "Unknown";
              freelancerEmail = freelancerData.email || "";
            }
          }
        } catch (err) {
          console.error("Error fetching freelancer:", err);
        }

        pendingMilestonesInProject.forEach((milestone) => {
          pendingMilestones.push({
            type: "milestone",
            milestoneId: milestone.id,
            projectId: project.id,
            projectTitle: project.title,
            milestoneTitle: milestone.title,
            milestoneDescription: milestone.description,
            amount: milestone.amount || 0,
            completedAt: milestone.completedAt,
            evidence: milestone.evidence,
            evidenceFiles: milestone.evidenceFiles || [],
            freelancerName: freelancerName,
            freelancerEmail: freelancerEmail,
            freelancerId: project.freelancerId,
            paymentPolicy: project.paymentPolicy || "milestone",
            priority: project.priority || "medium",
            hourlyRate: project.hourlyRate,
            dueDate: milestone.dueDate,
            revisionCount: milestone.revisionCount || 0,
            maxRevisions: milestone.maxRevisions || 2,
          });
        });
      }
    }

    // Fetch completion requests (for non-milestone or legacy projects)
    const completionRequestsSnapshot = await db
      .collection("completion_requests")
      .where("clientEmail", "==", clientEmail)
      .where("status", "==", "pending_approval")
      .get();

    const pendingCompletions = completionRequestsSnapshot.docs.map((doc) => ({
      type: "completion",
      requestId: doc.id,
      ...doc.data(),
    }));

    // Sort milestones by priority and completion date
    pendingMilestones.sort((a, b) => {
      // Payment policy affects urgency
      if (a.paymentPolicy === "milestone" && b.paymentPolicy !== "milestone")
        return -1;
      if (a.paymentPolicy !== "milestone" && b.paymentPolicy === "milestone")
        return 1;

      // Higher priority first
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff =
        (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      if (priorityDiff !== 0) return priorityDiff;

      // Then by completion date (older first)
      const dateA = a.completedAt?.toDate
        ? a.completedAt.toDate()
        : new Date(a.completedAt || 0);
      const dateB = b.completedAt?.toDate
        ? b.completedAt.toDate()
        : new Date(b.completedAt || 0);
      return dateA - dateB;
    });

    res.json({
      success: true,
      data: {
        milestones: pendingMilestones,
        completions: pendingCompletions,
        totalPending: pendingMilestones.length + pendingCompletions.length,
      },
    });
  } catch (error) {
    console.error("Error fetching pending approvals:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Approve a milestone
router.post("/milestone/:milestoneId/approve", async (req, res) => {
  try {
    const { milestoneId } = req.params;
    const { projectId, clientId } = req.body;

    if (!projectId || !clientId) {
      return res.status(400).json({
        success: false,
        error: "Project ID and Client ID are required",
      });
    }

    // Get project
    const projectRef = db.collection("projects").doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    const project = projectDoc.data();
    const milestoneIndex = project.milestones.findIndex(
      (m) => m.id === milestoneId,
    );

    if (milestoneIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Milestone not found",
      });
    }

    const milestone = project.milestones[milestoneIndex];

    // Check if milestone is past due date
    let isMilestoneOverdue = false;
    let daysOverdue = 0;
    if (milestone.dueDate) {
      const milestoneDueDate = milestone.dueDate?.toDate 
        ? milestone.dueDate.toDate() 
        : new Date(milestone.dueDate);
      const now = new Date();
      if (!isNaN(milestoneDueDate.getTime()) && milestoneDueDate < now) {
        isMilestoneOverdue = true;
        daysOverdue = Math.floor((now - milestoneDueDate) / (1000 * 60 * 60 * 24));
        console.log(`⚠️ WARNING: Milestone "${milestone.title}" is ${daysOverdue} days overdue. Invoice will still be generated.`);
      }
    }

    // Fetch client details early (needed for emails later)
    let clientData = {};
    if (clientId) {
      try {
        const clientDoc = await db.collection("users").doc(clientId).get();
        if (clientDoc.exists) {
          const cData = clientDoc.data();
          clientData = {
            clientName: cData.fullName || cData.username || "Client",
            clientEmail: cData.email
          };
        }
      } catch (err) {
        console.warn("Could not fetch client details:", err.message);
      }
    }

    // Update milestone status
    milestone.status = "approved";
    milestone.approvedAt = admin.firestore.Timestamp.now();
    milestone.approvedBy = clientId;
    milestone.clientApproved = true;

    // Initialize revision tracking if not exists
    if (!milestone.maxRevisions) {
      milestone.maxRevisions = 2; // Default 2 revisions allowed
    }
    if (!milestone.revisionCount) {
      milestone.revisionCount = 0;
    }

    let invoiceId = null;
    let invoiceGenerated = false;

    // Handle payment policy
    if (project.paymentPolicy === "milestone") {
      // Generate invoice immediately for this milestone
      try {
        // Fetch freelancer details
        let freelancerData = {};
        try {
          const freelancerDoc = await db
            .collection("users")
            .doc(project.freelancerId)
            .get();
          if (freelancerDoc.exists) {
            const fData = freelancerDoc.data();
            freelancerData = {
              freelancerName: fData.fullName || fData.username || "Freelancer",
              freelancerEmail: fData.email,
            };
          }
        } catch (err) {
          console.warn("Could not fetch freelancer details:", err.message);
        }

        // Client details already fetched earlier (clientData variable)

        // Prepare invoice data for service
        const taxRate = project.taxRate || 0;
        const paymentTermsDays = project.paymentTerms || 30;
        const subtotal = milestone.amount || 0;

        // Check if this is the final milestone (or only milestone)
        const totalMilestones = project.milestones.length;
        const isFinalMilestone = milestoneIndex === totalMilestones - 1;
        
        // Base line items
        const lineItems = [
          {
            description: `${milestone.title} - ${milestone.description || "Milestone payment"}`,
            quantity: 1,
            rate: milestone.amount || 0,
            amount: milestone.amount || 0,
          },
        ];

        // Add billable hours to final milestone invoice
        let billableHoursNote = "";
        if (isFinalMilestone) {
          const billableResult = await calculateBillableHoursFromTasks(
            projectId, 
            project.hourlyRate,
            project.contractId // Pass contract ID to check billable hours cap
          );
          
          const { cappedHours, cappedAmount, capped, warningMessage } = billableResult;
          
          if (cappedHours > 0) {
            const description = capped 
              ? `Billable Hours - Capped (${cappedHours.toFixed(2)} hours @ ${project.hourlyRate}/hr) - ${warningMessage}`
              : `Billable Hours - Time tracked on tasks (${cappedHours.toFixed(2)} hours @ ${project.hourlyRate}/hr)`;
            
            lineItems.push({
              description,
              quantity: cappedHours,
              rate: project.hourlyRate || 0,
              amount: cappedAmount,
            });
            billableHoursNote = ` (includes ${cappedHours.toFixed(2)} billable hours${capped ? ' - CAPPED' : ''})`;
          }
        }

        const invoiceData = {
          projectId: projectId,
          projectTitle: project.title,
          clientId: clientId,
          clientEmail: project.clientEmail,
          freelancerId: project.freelancerId,
          type: "milestone",
          milestoneId: milestoneId,
          milestoneTitle: milestone.title,
          issueDate: admin.firestore.Timestamp.now(),
          dueDate: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + paymentTermsDays * 24 * 60 * 60 * 1000),
          ),
          taxRate: taxRate,
          paymentTerms: `Net ${paymentTermsDays}`,
          lineItems: lineItems,
          notes: isMilestoneOverdue 
            ? `Payment for milestone: ${milestone.title}${billableHoursNote} (Note: Milestone was ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue)`
            : `Payment for milestone: ${milestone.title}${billableHoursNote}`,
          ...freelancerData,
          ...clientData,
        };

        // Use invoice calculation service to create invoice with validation and proper numbering
        const invoiceResult = await invoiceCalculationService.createInvoice(invoiceData);
        invoiceId = invoiceResult.id;
        const createdInvoice = invoiceResult.invoice;
        
        milestone.invoiceId = invoiceId;
        milestone.status = "invoiced";
        invoiceGenerated = true;

        // Send invoice email to client with PDF attachment
        try {
          // Generate PDF attachment
          let pdfAttachment = null;
          try {
            const invoiceDocData = { ...createdInvoice, id: invoiceId };
            pdfAttachment = await generateInvoicePDFBase64(invoiceDocData);
            console.log(`✅ PDF generated for invoice ${invoiceId}`);
          } catch (pdfError) {
            console.error("❌ Error generating PDF:", pdfError);
            // Continue without PDF attachment
          }

          // Prepare invoice data for email (convert timestamps to dates for email template)
          const emailInvoiceData = {
            ...createdInvoice,
            id: invoiceId,
            clientEmail: createdInvoice.clientEmail || project.clientEmail,
            clientName: createdInvoice.clientName || clientData.clientName || "Client",
            issueDate: createdInvoice.issueDate?.toDate ? createdInvoice.issueDate.toDate() : new Date(createdInvoice.issueDate),
            dueDate: createdInvoice.dueDate?.toDate ? createdInvoice.dueDate.toDate() : new Date(createdInvoice.dueDate),
            milestoneTitle: milestone.title,
          };

          // Use shared email service helper
          await sendInvoiceEmailWithPDF(invoiceId, emailInvoiceData, pdfAttachment, true);
          console.log(`✅ Invoice email sent to ${project.clientEmail}${pdfAttachment ? ' with PDF attachment' : ''}`);
        } catch (emailError) {
          console.error("❌ Error sending invoice email:", emailError);
          // Don't fail the invoice generation if email fails
        }
      } catch (invoiceError) {
        console.error("Error generating invoice:", invoiceError);
      }
    }

    // Update project with modified milestone
    project.milestones[milestoneIndex] = milestone;
    await projectRef.update({
      milestones: project.milestones,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Check if all milestones are approved
    const allMilestonesApproved = project.milestones.every(
      (m) =>
        m.status === "approved" ||
        m.status === "invoiced" ||
        m.status === "paid",
    );

    if (allMilestonesApproved) {
      console.log(`✅ All milestones approved for project: ${projectId}`);

      // For 'end' payment policy, generate single invoice for all milestones
      if (project.paymentPolicy === "end") {
        try {
          // Fetch freelancer details
          let freelancerData = {};
          try {
            const freelancerDoc = await db
              .collection("users")
              .doc(project.freelancerId)
              .get();
            if (freelancerDoc.exists) {
              const fData = freelancerDoc.data();
              freelancerData = {
                freelancerName:
                  fData.fullName || fData.username || "Freelancer",
                freelancerEmail: fData.email,
              };
            }
          } catch (err) {
            console.warn("Could not fetch freelancer details:", err.message);
          }

          // Client details already fetched earlier (clientData variable)

          // Prepare invoice data for service
          const taxRate = project.taxRate || 0;
          const paymentTermsDays = project.paymentTerms || 30;
          
          const lineItems = project.milestones.map((m) => ({
            description: `${m.title} - ${m.description || "Milestone payment"}`,
            quantity: 1,
            rate: m.amount || 0,
            amount: m.amount || 0,
          }));

          // Check for overdue milestones
          const overdueMilestones = [];
          const now = new Date();
          project.milestones.forEach((m) => {
            if (m.dueDate) {
              const milestoneDueDate = m.dueDate?.toDate 
                ? m.dueDate.toDate() 
                : new Date(m.dueDate);
              if (!isNaN(milestoneDueDate.getTime()) && milestoneDueDate < now) {
                const daysOverdue = Math.floor((now - milestoneDueDate) / (1000 * 60 * 60 * 24));
                overdueMilestones.push({ title: m.title, daysOverdue });
                console.log(`⚠️ WARNING: Milestone "${m.title}" was ${daysOverdue} days overdue when project completed.`);
              }
            }
          });

          // Add billable hours to project completion invoice
          const billableResult = await calculateBillableHoursFromTasks(
            projectId, 
            project.hourlyRate,
            project.contractId // Pass contract ID to check billable hours cap
          );
          
          const { cappedHours, cappedAmount, capped, warningMessage } = billableResult;
          
          let billableHoursNote = "";
          if (cappedHours > 0) {
            const description = capped 
              ? `Billable Hours - Capped (${cappedHours.toFixed(2)} hours @ ${project.hourlyRate}/hr) - ${warningMessage}`
              : `Billable Hours - Time tracked on tasks (${cappedHours.toFixed(2)} hours @ ${project.hourlyRate}/hr)`;
            
            lineItems.push({
              description,
              quantity: cappedHours,
              rate: project.hourlyRate || 0,
              amount: cappedAmount,
            });
            billableHoursNote = ` + ${cappedHours.toFixed(2)} billable hours${capped ? ' (CAPPED)' : ''}`;
          }

          // Build notes with overdue milestone information
          let notes = `Final payment for all milestones${billableHoursNote} - Project: ${project.title}`;
          if (overdueMilestones.length > 0) {
            const overdueNote = overdueMilestones.map(m => 
              `${m.title} (${m.daysOverdue} day${m.daysOverdue !== 1 ? 's' : ''} overdue)`
            ).join(', ');
            notes += ` (Note: Some milestones were overdue: ${overdueNote})`;
          }

          const invoiceData = {
            projectId: projectId,
            projectTitle: project.title,
            clientId: clientId,
            clientEmail: project.clientEmail,
            freelancerId: project.freelancerId,
            type: "project_completion",
            issueDate: admin.firestore.Timestamp.now(),
            dueDate: admin.firestore.Timestamp.fromDate(
              new Date(Date.now() + paymentTermsDays * 24 * 60 * 60 * 1000),
            ),
            taxRate: taxRate,
            paymentTerms: `Net ${paymentTermsDays}`,
            lineItems: lineItems,
            notes: notes,
            ...freelancerData,
            ...clientData,
          };

          // Use invoice calculation service to create invoice with validation and proper numbering
          const invoiceResult = await invoiceCalculationService.createInvoice(invoiceData);
          invoiceId = invoiceResult.id;
          const createdInvoice = invoiceResult.invoice;
          invoiceGenerated = true;

          // Update all milestones to invoiced
          project.milestones.forEach((m) => {
            if (m.status === "approved") {
              m.status = "invoiced";
              m.invoiceId = invoiceId;
            }
          });

          await projectRef.update({ milestones: project.milestones });

          console.log(`✅ Project completion invoice generated: ${invoiceId}`);

          // Send project completion invoice email to client with PDF attachment
          try {
            // Generate PDF attachment
            let pdfAttachment = null;
            try {
              const invoiceDocData = { ...createdInvoice, id: invoiceId };
              pdfAttachment = await generateInvoicePDFBase64(invoiceDocData);
              console.log(`✅ PDF generated for project completion invoice ${invoiceId}`);
            } catch (pdfError) {
              console.error(" Error generating PDF:", pdfError);
              // Continue without PDF attachment
            }

            // Prepare invoice data for email (convert timestamps to dates for email template)
            const emailInvoiceData = {
              ...createdInvoice,
              id: invoiceId,
              clientEmail: createdInvoice.clientEmail || project.clientEmail,
              clientName: createdInvoice.clientName || clientData.clientName || "Client",
              issueDate: createdInvoice.issueDate?.toDate ? createdInvoice.issueDate.toDate() : new Date(createdInvoice.issueDate),
              dueDate: createdInvoice.dueDate?.toDate ? createdInvoice.dueDate.toDate() : new Date(createdInvoice.dueDate),
            };

            // Use shared email service helper
            await sendInvoiceEmailWithPDF(invoiceId, emailInvoiceData, pdfAttachment, true);
            console.log(
              ` Project completion invoice email sent to ${project.clientEmail}${pdfAttachment ? ' with PDF attachment' : ''}`,
            );
          } catch (emailError) {
            console.error(
              " Error sending project completion invoice email:",
              emailError,
            );
            // Don't fail the invoice generation if email fails
          }
        } catch (invoiceError) {
          console.error(
            "Error generating project completion invoice:",
            invoiceError,
          );
        }
      }

      // Mark project as completed
      await projectRef.update({
        status: "completed",
        completedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Create notification for freelancer
      await db.collection("notifications").add({
        freelancerId: project.freelancerId,
        projectId: projectId,
        type: "project_completed",
        title: "Project Completed",
        message: `All milestones approved! Project "${project.title}" is now complete.`,
        invoiceGenerated: invoiceGenerated,
        invoiceId: invoiceId,
        createdAt: admin.firestore.Timestamp.now()
      });
    } else {
      // Create notification for single milestone approval
      await db.collection("notifications").add({
        freelancerId: project.freelancerId,
        projectId: projectId,
        milestoneId: milestoneId,
        type: "milestone_approved",
        title: "Milestone Approved",
        message: `Client approved "${milestone.title}" for project "${project.title}"`,
        invoiceGenerated: invoiceGenerated,
        invoiceId: invoiceId,
        createdAt: admin.firestore.Timestamp.now()
      });

      // Send email notification to freelancer
      try {
        const freelancerDoc = await db.collection("users").doc(project.freelancerId).get();
        if (freelancerDoc.exists) {
          const freelancerEmail = freelancerDoc.data().email;
          const { sendMilestoneApprovalEmail } = require("../services/emailService");
          
          await sendMilestoneApprovalEmail({
            freelancerEmail: freelancerEmail,
            freelancerName: freelancerDoc.data().fullName || freelancerDoc.data().username || "Freelancer",
            projectTitle: project.title,
            milestoneTitle: milestone.title,
            clientName: clientData.clientName || project.clientName || "Client",
            invoiceGenerated: invoiceGenerated
          });
          console.log(`✅ Milestone approval email sent to ${freelancerEmail}`);
        }
      } catch (emailError) {
        console.error("❌ Error sending milestone approval email:", emailError);
        // Don't fail the approval if email fails
      }
    }

    res.json({
      success: true,
      message: "Milestone approved successfully",
      data: {
        milestoneId: milestoneId,
        projectCompleted: allMilestonesApproved,
        invoiceGenerated: invoiceGenerated,
        invoiceId: invoiceId,
      },
    });
  } catch (error) {
    console.error("Error approving milestone:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Request revision for a milestone
router.post("/milestone/:milestoneId/reject", async (req, res) => {
  console.log("🔍 Reject endpoint hit:", {
    milestoneId: req.params.milestoneId,
    body: req.body,
    method: req.method,
    path: req.path,
  });

  try {
    const { milestoneId } = req.params;
    const { projectId, clientId, revisionComment } = req.body;

    if (!projectId || !clientId || !revisionComment) {
      return res.status(400).json({
        success: false,
        error: "Project ID, Client ID, and revision comment are required",
      });
    }

    // Get project
    const projectRef = db.collection("projects").doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      });
    }

    const project = projectDoc.data();
    const milestoneIndex = project.milestones.findIndex(
      (m) => m.id === milestoneId,
    );

    if (milestoneIndex === -1) {
      return res.status(404).json({
        success: false,
        error: "Milestone not found",
      });
    }

    const milestone = project.milestones[milestoneIndex];

    // Initialize revision tracking if not exists
    if (!milestone.revisionCount) {
      milestone.revisionCount = 0;
    }
    if (!milestone.maxRevisions) {
      milestone.maxRevisions = 2; 
    }

    // Check if revision limit exceeded
    if (milestone.revisionCount >= milestone.maxRevisions) {
      return res.status(400).json({
        success: false,
        error: `Maximum revisions (${milestone.maxRevisions}) reached for this milestone. Please contact freelancer to discuss additional revisions.`,
      });
    }

    // Increment revision count
    milestone.revisionCount = (milestone.revisionCount || 0) + 1;

    // Update milestone status
    milestone.status = "revision_requested";
    milestone.revisionComment = revisionComment;
    milestone.revisionRequestedAt = admin.firestore.Timestamp.now();
    milestone.revisionRequestedBy = clientId;
    milestone.clientApproved = false;

    // Track revision history
    if (!milestone.revisionHistory) {
      milestone.revisionHistory = [];
    }
    milestone.revisionHistory.push({
      revisionNumber: milestone.revisionCount,
      comment: revisionComment,
      requestedAt: admin.firestore.Timestamp.now(),
      requestedBy: clientId,
    });

    // Update project
    project.milestones[milestoneIndex] = milestone;
    await projectRef.update({
      milestones: project.milestones,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Add comment to project
    await db.collection("project_comments").add({
      projectId: projectId,
      freelancerId: project.freelancerId,
      clientId: clientId,
      milestoneId: milestoneId,
      comment: `Revision requested for "${milestone.title}": ${revisionComment}`,
      type: "milestone_revision_request",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Create notification for freelancer
    await db.collection("notifications").add({
      freelancerId: project.freelancerId,
      projectId: projectId,
      milestoneId: milestoneId,
      type: "milestone_revision_requested",
      title: "Revision Requested",
      message: `Client requested revision for "${milestone.title}" in project "${project.title}"`,
      revisionComment: revisionComment,
      createdAt: admin.firestore.Timestamp.now()
    });

    res.json({
      success: true,
      message: "Revision requested successfully",
      data: {
        milestoneId: milestoneId,
        revisionCount: milestone.revisionCount,
        maxRevisions: milestone.maxRevisions,
        revisionsRemaining: milestone.maxRevisions - milestone.revisionCount,
      },
    });
  } catch (error) {
    console.error("Error requesting revision:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});



module.exports = router;
