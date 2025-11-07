// Approval Service for handling milestone and completion approvals
class ApprovalService {
  constructor() {
    this.baseURL = "http://localhost:5000/api/approvals";
  }

  // Get all pending approvals for a client (milestones + completion requests)
  async getPendingApprovals(clientId) {
    try {
      const response = await fetch(`${this.baseURL}/pending/${clientId}`);
      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          data: result.data,
        };
      } else {
        console.error("Failed to fetch pending approvals:", result.error);
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Approve a milestone
  async approveMilestone(milestoneId, projectId, clientId) {
    try {
      const response = await fetch(
        `${this.baseURL}/milestone/${milestoneId}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            clientId,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        console.log("Milestone approved successfully:", result.data);
        return {
          success: true,
          data: result.data,
          message: result.message,
        };
      } else {
        console.error("Failed to approve milestone:", result.error);
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error("Error approving milestone:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Request revision for a milestone
  async rejectMilestone(milestoneId, projectId, clientId, revisionComment) {
    try {
      if (!revisionComment || !revisionComment.trim()) {
        return {
          success: false,
          error: "Revision comment is required",
        };
      }

      const response = await fetch(
        `${this.baseURL}/milestone/${milestoneId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            clientId,
            revisionComment: revisionComment.trim(),
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        console.log("Revision requested successfully:", result.data);
        return {
          success: true,
          data: result.data,
          message: result.message,
        };
      } else {
        console.error("Failed to request revision:", result.error);
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error("Error requesting revision:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper method to format milestone data for display
  formatMilestoneForDisplay(milestone) {
    return {
      ...milestone,
      completedDate: milestone.completedAt?.toDate
        ? milestone.completedAt.toDate().toLocaleDateString()
        : "Recently",
      formattedAmount: `RM${Number(milestone.amount || 0).toFixed(2)}`,
      paymentPolicyLabel:
        milestone.paymentPolicy === "milestone"
          ? "Pay per milestone"
          : "Pay at end",
      priorityColor:
        milestone.priority === "high"
          ? "red"
          : milestone.priority === "medium"
            ? "yellow"
            : "green",
    };
  }

  // Helper method to get urgency score for sorting
  getUrgencyScore(item) {
    let score = 0;

    // Payment policy affects urgency
    if (item.paymentPolicy === "milestone") score += 10; // More urgent (blocking payment)

    // Overdue items
    if (item.dueDate && new Date(item.dueDate) < new Date()) score += 20;

    // High priority projects
    if (item.priority === "high") score += 5;
    else if (item.priority === "medium") score += 2;

    // Time waiting
    const completedDate = item.completedAt?.toDate
      ? item.completedAt.toDate()
      : new Date(item.completedAt || Date.now());
    const daysWaiting = (new Date() - completedDate) / (1000 * 60 * 60 * 24);
    score += Math.floor(daysWaiting);

    return score;
  }

  // Sort approvals by urgency
  sortByUrgency(approvals) {
    return approvals.sort(
      (a, b) => this.getUrgencyScore(b) - this.getUrgencyScore(a),
    );
  }
}

const approvalService = new ApprovalService();
export default approvalService;
