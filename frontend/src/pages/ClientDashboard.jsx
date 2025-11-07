import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase-config";
import apiService from "../services/api";
import MilestoneApprovalModal from "../components/MilestoneApprovalModal";
import MilestoneManager from "../components/MilestoneManager";
import { downloadInvoicePDF } from "../utils/pdfGenerator";
import {
  CheckCircle,
  AlertCircle,
  FileText,
  MessageCircle,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Eye,
  Send,
  ArrowLeft,
  ArrowRight,
  X,
  Target,
  Clock,
  Archive,
  RefreshCw,
  Trash2,
} from "lucide-react";

const ClientDashboard = ({ user, initialProjectId }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [freelancerUsernames, setFreelancerUsernames] = useState({});
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [updateComments, setUpdateComments] = useState({});
  const [expandedUpdates, setExpandedUpdates] = useState({});
  const [newUpdateComments, setNewUpdateComments] = useState({});
  const [pendingMilestones, setPendingMilestones] = useState([]);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [projectInvoices, setProjectInvoices] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");


  // Keep refs to unsubscribe functions for cleanup
  const unsubProjectsRef = useRef(null);
  const unsubInvitationsRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== "client") {
      navigate("/login");
      return;
    }

    // Real-time listener for projects
    const q = query(
      collection(db, "projects"),
      where("clientEmail", "==", user.email)
    );
    unsubProjectsRef.current = onSnapshot(q, async (snapshot) => {
      const allProjects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Auto-update overdue active projects
      const now = new Date();
      allProjects.forEach(async (project) => {
        // Check if active project is overdue
        if (project.status === "active" && project.dueDate) {
          const dueDate = project.dueDate.toDate ? project.dueDate.toDate() : new Date(project.dueDate);
          if (!isNaN(dueDate) && dueDate < now) {
            console.log(` Auto-marking project ${project.id} as overdue`);
            try {
              await updateDoc(doc(db, "projects", project.id), {
                status: "overdue",
                overdueAt: new Date().toISOString(),
              });
            } catch (error) {
              console.error("Error auto-updating project to overdue:", error);
            }
          }
        }
      });
      
      // Filter projects based on clientVisible flag and excluded statuses
      let filteredProjects = allProjects.filter(
        (project) => {
          const isVisibleToClient = project.clientVisible !== false;
          
          // Exclude projects that clients shouldn't see
          const excludedStatuses = [
            "pending_contract", 
            "pending_invitation",
            "invitation_expired",
            "contract_rejected"
          ];
          const isNotExcluded = !excludedStatuses.includes(project.status);
          
          return isVisibleToClient && isNotExcluded;
        }
      );

      // Apply status filter
      if (statusFilter !== "all") {
        filteredProjects = filteredProjects.filter((project) => project.status === statusFilter);
      } else {
        // When showing "all", exclude archived from main list
        filteredProjects = filteredProjects.filter((project) => project.status !== "archived");
      }

      setProjects(filteredProjects);

      // Fetch freelancer usernames for all projects
      const freelancerIds = [
        ...new Set(filteredProjects.map((project) => project.freelancerId).filter(Boolean)),
      ];
      const usernamePromises = freelancerIds.map(async (freelancerId) => {
        const username = await fetchFreelancerUsername(freelancerId);
        return { freelancerId, username };
      });
      const usernameResults = await Promise.all(usernamePromises);
      const usernameMap = {};
      usernameResults.forEach(({ freelancerId, username }) => {
        usernameMap[freelancerId] = username;
      });
      setFreelancerUsernames((prev) => ({ ...prev, ...usernameMap }));

      // Recalculate pending milestones whenever projects change
      fetchPendingApprovalsFromProjects(allProjects, usernameMap);
    });

    // Real-time listener for pending invitations (only 'pending_approval')
    const pendingInvitationsQuery = query(
      collection(db, "projects"),
      where("clientEmail", "==", user.email),
      where("status", "==", "pending_approval")
    );
    const unsub = onSnapshot(pendingInvitationsQuery, (snapshot) => {
      const invitations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPendingInvitations(invitations);
    });

    // Cleanup listener on unmount
    return () => {
      if (unsubProjectsRef.current) unsubProjectsRef.current();
      unsub();
    };
  }, [user, navigate, statusFilter]);

  // Auto-select project if initialProjectId is provided
  useEffect(() => {
    if (initialProjectId && projects.length > 0 && !selectedProject) {
      const project = projects.find(p => p.id === initialProjectId);
      if (project) {
        setSelectedProject(project);
        setLoadingDetails(true);
        fetchProjectDetails(project.id)
          .then(() => setLoadingDetails(false))
          .catch((error) => {
            console.error("Error fetching project details:", error);
            setLoadingDetails(false);
          });
      }
    }
  }, [initialProjectId, projects, selectedProject]);

  // Helper to recalculate pending milestones from all projects
  const fetchPendingApprovalsFromProjects = (projectsData, usernameMap) => {
    try {
      const milestones = [];
      for (const project of projectsData) {
        if (project.milestones && project.milestones.length > 0) {
          const pendingMilestonesInProject = project.milestones.filter(
            (m) =>
              (m.status === "completed" || m.status === "client_approval_pending") &&
              !m.clientApproved,
          );
          pendingMilestonesInProject.forEach((milestone) => {
            milestones.push({
              ...milestone,
              milestoneId: milestone.id,
              projectId: project.id,
              projectTitle: project.title,
              paymentPolicy: project.paymentPolicy,
              priority: project.priority,
              freelancerName:
                usernameMap?.[project.freelancerId] || "Unknown",
              hourlyRate: project.hourlyRate,
            });
          });
        }
      }
      // Sort milestones by priority and date
      milestones.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff =
          (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.completedAt) - new Date(b.completedAt);
      });
      setPendingMilestones(milestones);
    } catch (error) {
      console.error("Error calculating pending milestones:", error);
      setPendingMilestones([]);
    }
  };

  const fetchFreelancerUsername = async (freelancerId) => {
    try {
      if (!freelancerId) return "Unknown";

      const userDoc = await getDoc(doc(db, "users", freelancerId));
      if (userDoc.exists()) {
        return userDoc.data().username || "Unknown";
      }
      return "Unknown";
    } catch (error) {
      console.error("Error fetching freelancer username:", error);
      return "Unknown";
    }
  };


  const acceptProjectInvitation = async (projectId) => {
    try {
      // Update project status from pending_approval to active
      await updateDoc(doc(db, "projects", projectId), {
        status: "active",
        clientId: user.uid,
        updatedAt: new Date(),
      });

      // Refresh data
  // No need to manually refresh projects or invitations; real-time listeners handle updates

      alert("✅ Project invitation accepted! The project is now active.");
    } catch (error) {
      console.error("Error accepting project invitation:", error);
      alert("Failed to accept project invitation. Please try again.");
    }
  };

  const rejectProjectInvitation = async (projectId) => {
    try {
      const confirmed = window.confirm(
        "Are you sure you want to reject this project invitation? This action cannot be undone.",
      );
      if (!confirmed) return;

      // Update project status to rejected
      await updateDoc(doc(db, "projects", projectId), {
        status: "rejected",
        clientId: user.uid,
        updatedAt: new Date(),
      });

      // Refresh data
  // No need to manually refresh invitations; real-time listeners handle updates

      alert("Project invitation rejected.");
    } catch (error) {
      console.error("Error rejecting project invitation:", error);
      alert("Failed to reject project invitation. Please try again.");
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
      case "rejected":
        return "bg-red-100 text-red-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "text-red-600 bg-red-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "low":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const handleViewProgress = async (project) => {
    // Navigate to persistent progress route
    navigate(`/client/project/${project.id}/progress`);
  };

  const handleArchiveProject = async (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const archiveReason = project.status === "overdue" 
      ? "overdue and past deadline"
      : project.status === "cancelled"
      ? "project cancelled"
      : "archived by client";

    try {
      const confirmed = window.confirm(
        `Archive this project?\n\nReason: ${archiveReason}\n\nYou can view archived projects by selecting 'Archived' in the status filter.`
      );
      if (!confirmed) return;

      await updateDoc(doc(db, "projects", projectId), {
        status: "archived",
        archivedAt: new Date().toISOString(),
        archivedReason: archiveReason,
        previousStatus: project.status,
        updatedAt: new Date(),
      });

      alert("✅ Project archived successfully.");
    } catch (error) {
      console.error("Error archiving project:", error);
      alert("Failed to archive project. Please try again.");
    }
  };

  const handleUnarchiveProject = async (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project || !project.previousStatus) return;

    try {
      const confirmed = window.confirm("Restore this archived project?");
      if (!confirmed) return;

      await updateDoc(doc(db, "projects", projectId), {
        status: project.previousStatus,
        unarchivedAt: new Date().toISOString(),
        updatedAt: new Date(),
      });

      alert("✅ Project restored successfully.");
    } catch (error) {
      console.error("Error restoring project:", error);
      alert("Failed to restore project. Please try again.");
    }
  };

  const handleDeleteProject = async (projectId, projectTitle) => {
    try {
      const confirmed = window.confirm(
        `⚠️ WARNING: Are you sure you want to permanently delete "${projectTitle}"?\n\nThis action CANNOT be undone. All project data will be permanently removed.`
      );
      if (!confirmed) return;

      const finalConfirm = prompt('Type "DELETE" (in capitals) to confirm:');
      if (finalConfirm !== 'DELETE') {
        alert('Deletion cancelled.');
        return;
      }

      await deleteDoc(doc(db, "projects", projectId));
      alert('🗑️ Project permanently deleted.');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  const fetchProjectDetails = async (projectId) => {
    try {
      // Fetch project tasks
      const tasksQuery = query(
        collection(db, "tasks"),
        where("projectId", "==", projectId),
        orderBy("createdAt", "desc"),
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(tasksData);

      // Fetch progress updates
      const progressQuery = query(
        collection(db, "progress_updates"),
        where("projectId", "==", projectId),
        orderBy("updatedAt", "desc"),
      );
      const progressSnapshot = await getDocs(progressQuery);
      const progressData = progressSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProgressUpdates(progressData);

      // Fetch comments for each progress update
      await fetchUpdateComments(progressData);

      // Calculate time entries from tasks
      const timeEntriesData = tasksData
        .filter((task) => task.timeSpent > 0)
        .map((task) => ({
          id: task.id,
          taskTitle: task.title,
          hours: task.timeSpent,
          date: task.updatedAt?.toDate() || new Date(),
          status: task.status,
        }));
      setTimeEntries(timeEntriesData);

      // Fetch invoices for this project
      const invoicesQuery = query(
        collection(db, "invoices"),
        where("projectId", "==", projectId),
        orderBy("createdAt", "desc"),
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      const invoicesData = invoicesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProjectInvoices(invoicesData);
    } catch (error) {
      console.error("Error fetching project details:", error);
    }
  };

  const fetchUpdateComments = async (updates) => {
    try {
      const commentsPromises = updates.map(async (update) => {
        // Now we use project_comments for unified threads
        const commentsQuery = query(
          collection(db, "project_comments"),
          where("updateId", "==", update.id),
          orderBy("createdAt", "asc"),
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        const comments = commentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        return { updateId: update.id, comments };
      });

      const commentsResults = await Promise.all(commentsPromises);
      const commentsMap = {};
      commentsResults.forEach(({ updateId, comments }) => {
        commentsMap[updateId] = comments;
      });
      setUpdateComments(commentsMap);
    } catch (error) {
      console.error("Error fetching update comments:", error);
    }
  };

  const toNumber = (value) => {
    const numeric = typeof value === "string" ? parseFloat(value) : value;
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const calculateProjectStats = () => {
    if (!selectedProject) return {};

    // Milestone-based completion calculation (same as freelancer view)
    const milestones = selectedProject.milestones || [];
    const totalMilestonePercent = milestones.reduce(
      (sum, m) => sum + (parseFloat(m.percentage) || 0),
      0
    );
    const completedMilestonePercent = milestones
      .filter((m) => m.status === "completed" || m.status === "approved")
      .reduce((sum, m) => sum + (parseFloat(m.percentage) || 0), 0);

    // Calculate completion percentage based on milestones
    const completionPercentage =
      totalMilestonePercent > 0
        ? Math.round((completedMilestonePercent / totalMilestonePercent) * 100)
        : 0;

    // Keep task stats for display
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (task) => task.status === "completed",
    ).length;
    const inProgressTasks = tasks.filter(
      (task) => task.status === "in-progress",
    ).length;
    const totalHours = tasks.reduce(
      (sum, task) => sum + toNumber(task.timeSpent || 0),
      0,
    );
    const estimatedHours = tasks.reduce(
      (sum, task) => sum + toNumber(task.estimatedHours || 0),
      0,
    );
    const hourlyRate = toNumber(selectedProject.hourlyRate || 0);
    const currentCost = totalHours * hourlyRate;
    const estimatedCost = estimatedHours * hourlyRate;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      totalHours,
      estimatedHours,
      currentCost,
      estimatedCost,
      completionPercentage,
    };
  };

  const handleSendUpdateComment = async (updateId) => {
    const comment = newUpdateComments[updateId];
    if (!comment?.trim() || !selectedProject) return;

    try {
      // Ensure we have valid client identification
      const clientId = selectedProject.clientId || user?.uid || null;
      const clientEmail = selectedProject.clientEmail || user?.email || null;

      if (!clientId && !clientEmail) {
        alert(
          "Unable to identify client. Please refresh the page and try again.",
        );
        return;
      }

      const commentData = {
  updateId: updateId,
  projectId: selectedProject.id,
  userId: clientId,
  userName: user?.displayName || user?.email || "Client",
  userRole: "client",
  comment: comment.trim(),
  createdAt: new Date(),
  updatedAt: new Date(),
      };

      // Remove undefined fields to prevent Firebase errors
      const cleanCommentData = Object.fromEntries(
        Object.entries(commentData).filter(([_, value]) => value !== undefined),
      );

      await addDoc(collection(db, "project_comments"), cleanCommentData);

      // Send email notification to freelancer
      try {
        const response = await fetch("/api/email/send-comment-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProject.id,
            recipientEmail: selectedProject.freelancerEmail,
            commenterName: user?.displayName || user?.email || "Client",
            commenterRole: "client",
            commentText: comment.trim(),
            projectTitle: selectedProject.title
          })
        });
        
        if (!response.ok) {
          console.error("Email API response:", await response.text());
        }
      } catch (emailErr) {
        console.error("Failed to send comment notification email:", emailErr);
      }

      // Clear the input and refresh comments
      setNewUpdateComments((prev) => ({ ...prev, [updateId]: "" }));
      await fetchUpdateComments(progressUpdates);

      alert("Comment sent successfully!");
    } catch (error) {
      console.error("Error sending update comment:", error);
      alert("Failed to send comment. Please try again.");
    }
  };

  const toggleUpdateExpansion = (updateId) => {
    setExpandedUpdates((prev) => ({
      ...prev,
      [updateId]: !prev[updateId],
    }));
  };

  const handleMilestoneClick = async (milestone) => {
    // Navigate to the project and auto-select milestones tab
    const project = projects.find(p => p.id === milestone.projectId);
    if (project) {
      setSelectedProject(project);
      setActiveTab("milestones");
      setLoadingDetails(true);
      try {
        await fetchProjectDetails(project.id);
      } catch (error) {
        console.error("Error fetching project details:", error);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const handleApprovalComplete = (result) => {
    console.log("Approval completed:", result);
    setShowMilestoneModal(false);
    setSelectedMilestone(null);

  };

  const handleDownloadInvoice = (invoice) => {
    downloadInvoicePDF(invoice);
  };

  const stats = calculateProjectStats();

  return (
    <div className="p-6">
      {!selectedProject ? (
        // Show project list when no project is selected
        <>
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  My Projects
                </h1>
                <p className="text-gray-600">
                  Track the progress of your projects
                </p>
              </div>
              <button
                onClick={() => navigate("/client-invitations")}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium"
              >
                View Invitations
              </button>
            </div>
          </div>

          {/* Pending Approvals Section */}
          {pendingMilestones.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Pending Approvals ({pendingMilestones.length})
              </h2>

              {/* Milestone Approvals - Higher Priority */}
              {pendingMilestones.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center mb-3">
                    <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-800">
                      🎯 Milestone Approvals ({pendingMilestones.length})
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Review and approve completed milestones.
                    {pendingMilestones.some(
                      (m) => m.paymentPolicy === "milestone",
                    ) &&
                      " Invoices will be generated immediately upon approval for per-milestone payment projects."}
                  </p>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Project / Milestone
                            </th>
                            <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Freelancer
                            </th>
                            <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Payment Policy
                            </th>
                            <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Completed
                            </th>
                            <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pendingMilestones.map((milestone) => (
                            <tr
                              key={`${milestone.projectId}-${milestone.id}`}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-8 py-5">
                                <div className="text-sm font-medium text-gray-900">
                                  {milestone.projectTitle}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  📍 {milestone.title}
                                </div>
                                {milestone.description && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {milestone.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-8 py-5 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {milestone.freelancerName}
                                </div>
                              </td>
                              <td className="px-8 py-5 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  RM{Number(milestone.amount || 0).toFixed(2)}
                                </div>
                              </td>
                              <td className="px-8 py-5 whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    milestone.paymentPolicy === "milestone"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {milestone.paymentPolicy === "milestone"
                                    ? "💳 Pay per milestone"
                                    : "📦 Pay at end"}
                                </span>
                              </td>
                              <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-900">
                                {milestone.completedAt?.toDate
                                  ? new Date(
                                      milestone.completedAt.toDate(),
                                    ).toLocaleDateString()
                                  : "Recently"}
                              </td>
                              <td className="px-8 py-5 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() =>
                                    handleMilestoneClick(milestone)
                                  }
                                  className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors duration-200 font-medium"
                                >
                                  Review & Approve
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Projects Section */}
          {Array.isArray(projects) && projects.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Active Projects
                </h2>
                <div className="flex items-center gap-3">
                  {/* Show "Clear Filter" button when a specific status is selected */}
                  {statusFilter !== "all" && (
                    <button
                      onClick={() => setStatusFilter("all")}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Clear Filter
                    </button>
                  )}
                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="rejected">Rejected</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Freelancer
                        </th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Start Date
                        </th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Due Date
                        </th>
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rate
                        </th>
                        
                        <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Array.isArray(projects) &&
                        projects.map((project) => (
                          <tr key={project.id} className="hover:bg-gray-50">
                            <td className="px-8 py-5 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {freelancerUsernames[project.freelancerId] ||
                                  "Unknown"}
                              </div>
                            </td>
                            <td className="px-8 py-5 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {project.title}
                              </div>
                            </td>
                            <td className="px-8 py-5 whitespace-nowrap">
                              <span
                                className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}
                              >
                                {project.status || "Active"}
                              </span>
                            </td>
                            <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-900">
                              {project.startDate
                                ? new Date(
                                    project.startDate,
                                  ).toLocaleDateString()
                                : "N/A"}
                            </td>
                            <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-900">
                              {project.dueDate
                                ? new Date(project.dueDate).toLocaleDateString()
                                : "N/A"}
                            </td>
                            <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-900">
                              {project.hourlyRate
                                ? `RM${project.hourlyRate}/hr`
                                : "N/A"}
                            </td>
                            
                            <td className="px-8 py-5 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleViewProgress(project)}
                                  className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md transition-colors duration-200 font-medium"
                                >
                                  View Progress
                                </button>
                                
                                {/* Unarchive button - only for archived projects */}
                                {project.status === "archived" ? (
                                  <button
                                    onClick={() => handleUnarchiveProject(project.id)}
                                    className="text-green-600 hover:text-green-900 inline-flex items-center px-2 py-1 hover:bg-green-50 rounded transition-colors"
                                    title="Restore Project"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                ) : (project.status === "overdue" || project.status === "cancelled" || project.status === "completed") && (
                                  <button
                                    onClick={() => handleArchiveProject(project.id)}
                                    className="text-orange-600 hover:text-orange-900 inline-flex items-center px-2 py-1 hover:bg-orange-50 rounded transition-colors"
                                    title="Archive Project"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
                                )}
                                
                                {/* Delete button - only for archived projects */}
                                {project.status === "archived" && (
                                  <button
                                    onClick={() => handleDeleteProject(project.id, project.title)}
                                    className="text-red-600 hover:text-red-900 inline-flex items-center px-2 py-1 hover:bg-red-50 rounded transition-colors"
                                    title="Delete Project Permanently"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        // Show project progress details when a project is selected
        <div className="space-y-6">
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate("/client-dashboard")}
                className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {selectedProject.title}
                </h1>
                <p className="text-gray-600">Project Progress & Updates</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Freelancer:{" "}
                {freelancerUsernames[selectedProject.freelancerId] || "Unknown"}
              </span>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">
                  {stats.completionPercentage || 0}%
                </span>
              </div>
            </div>
          </div>

          {loadingDetails ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading project details...</p>
            </div>
          ) : (
            <>
              {/* Progress Overview */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Project Overview
                  </h3>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">
                      {stats.completionPercentage || 0}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${stats.completionPercentage || 0}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.totalTasks || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Tasks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.completedTasks || 0}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {Number(stats.totalHours || 0).toFixed(1)}h
                    </div>
                    <div className="text-sm text-gray-600">Hours Worked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      ${Number(stats.currentCost || 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Current Cost</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: "overview", name: "Overview", icon: Eye },
                    { id: "tasks", name: "Tasks", icon: CheckCircle },
                    { id: "milestones", name: "Milestones", icon: Target },
                    { id: "invoices", name: "Invoices", icon: FileText },
                    {
                      id: "updates",
                      name: "Progress Updates",
                      icon: MessageCircle,
                    },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === tab.id
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {tab.name}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Project Timeline */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold mb-3 flex items-center">
                          <Calendar className="w-5 h-5 mr-2" />
                          Project Timeline
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Start Date:
                            </span>
                            <span className="text-sm font-medium">
                              {selectedProject.startDate
                                ? new Date(
                                    selectedProject.startDate,
                                  ).toLocaleDateString()
                                : "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Due Date:
                            </span>
                            <span className="text-sm font-medium">
                              {selectedProject.dueDate
                                ? new Date(
                                    selectedProject.dueDate,
                                  ).toLocaleDateString()
                                : "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Priority:
                            </span>
                            <span
                              className={`text-sm font-medium px-2 py-1 rounded ${
                                selectedProject.priority === "high"
                                  ? "bg-red-100 text-red-800"
                                  : selectedProject.priority === "medium"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
                              }`}
                            >
                              {selectedProject.priority || "Medium"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold mb-3 flex items-center">
                          <DollarSign className="w-5 h-5 mr-2" />
                          Financial Summary
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Hourly Rate:
                            </span>
                            <span className="text-sm font-medium">
                              ${selectedProject.hourlyRate || 0}/hr
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Hours Worked:
                            </span>
                            <span className="text-sm font-medium">
                              {Number(stats.totalHours || 0).toFixed(1)}h
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Estimated Hours:
                            </span>
                            <span className="text-sm font-medium">
                              {Number(stats.estimatedHours || 0).toFixed(1)}h
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-2">
                            <span className="text-sm font-semibold">
                              Current Cost:
                            </span>
                            <span className="text-sm font-bold text-green-600">
                              ${Number(stats.currentCost || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "milestones" && (
                  <div className="space-y-4">
                    <MilestoneManager
                      project={selectedProject}
                      currentUser={user}
                      onUpdate={() => fetchProjectDetails(selectedProject.id)}
                      viewMode="client"
                    />
                  </div>
                )}

                {activeTab === "tasks" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Project Tasks</h3>
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="bg-white border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">
                              {task.title}
                            </h4>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                task.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : task.status === "in-progress"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {task.status || "Pending"}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>Progress: {task.progress || 0}%</span>
                            <span>
                              Hours: {task.timeSpent || 0}h /{" "}
                              {task.estimatedHours || 0}h
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${task.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "updates" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Progress Updates</h3>
                    <div className="space-y-4">
                      {progressUpdates.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>No progress updates yet.</p>
                        </div>
                      ) : (
                        progressUpdates.map((update) => (
                          <div
                            key={update.id}
                            className="bg-white border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-start space-x-3">
                              <div
                                className={`p-2 rounded-full ${
                                  update.type === "comment"
                                    ? "bg-blue-100"
                                    : update.type === "task_progress"
                                      ? "bg-green-100"
                                      : "bg-gray-100"
                                }`}
                              >
                                {update.type === "comment" ? (
                                  <MessageCircle className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                )}
                              </div>

                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <span className="font-medium text-gray-900">
                                      {update.freelancerName || "Freelancer"}
                                    </span>
                                    <span className="text-sm text-gray-500 ml-2">
                                      {update.createdAt?.toDate
                                        ? update.createdAt
                                            .toDate()
                                            .toLocaleString()
                                        : update.updatedAt?.toDate
                                          ? update.updatedAt
                                              .toDate()
                                              .toLocaleString()
                                          : ""}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() =>
                                        toggleUpdateExpansion(update.id)
                                      }
                                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                                    >
                                      <MessageCircle className="w-4 h-4 mr-1" />
                                      {updateComments[update.id]?.length ||
                                        0}{" "}
                                      comments
                                    </button>
                                  </div>
                                </div>

                                {update.type === "comment" && (
                                  <div>
                                    <p className="text-gray-700 whitespace-pre-wrap">
                                      {update.data?.comment || update.comment}
                                    </p>

                                    {update.data?.attachments &&
                                      update.data.attachments.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-sm text-gray-600 mb-2">
                                            Attachments:
                                          </p>
                                          <div className="flex flex-wrap gap-2">
                                            {update.data.attachments.map(
                                              (attachment, idx) => (
                                                <div
                                                  key={idx}
                                                  className="relative"
                                                >
                                                  {attachment.type?.startsWith(
                                                    "image/",
                                                  ) ? (
                                                    <div className="group">
                                                      <img
                                                        src={attachment.url}
                                                        alt={attachment.name}
                                                        className="w-24 h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => {
                                                          if (
                                                            attachment.url.startsWith(
                                                              "data:",
                                                            )
                                                          ) {
                                                            const link =
                                                              document.createElement(
                                                                "a",
                                                              );
                                                            link.href =
                                                              attachment.url;
                                                            link.download =
                                                              attachment.name;
                                                            link.click();
                                                          } else {
                                                            window.open(
                                                              attachment.url,
                                                              "_blank",
                                                            );
                                                          }
                                                        }}
                                                      />
                                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center">
                                                        <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <a
                                                      href={attachment.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="flex items-center p-2 bg-gray-100 rounded border hover:bg-gray-200 transition-colors"
                                                    >
                                                      <FileText className="w-4 h-4 text-gray-600 mr-2" />
                                                      <span className="text-sm text-gray-700 truncate max-w-32">
                                                        {attachment.name}
                                                      </span>
                                                      <Download className="w-3 h-3 text-gray-500 ml-1" />
                                                    </a>
                                                  )}
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                )}

                                {update.type === "task_progress" && (
                                  <div>
                                    <p className="text-gray-700 mb-2">
                                      Updated{" "}
                                      <strong>{update.taskTitle}</strong>
                                    </p>
                                    <div className="flex items-center space-x-2 text-sm">
                                      <span className="text-gray-600">
                                        {update.oldProgress}%
                                      </span>
                                      <ArrowRight className="w-4 h-4 text-gray-400" />
                                      <span className="font-medium text-green-600">
                                        {update.newProgress}%
                                      </span>
                                      <span className="text-xs text-green-600">
                                        +{update.progressChange}%
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Comments Section */}
                                {expandedUpdates[update.id] && (
                                  <div className="mt-4 border-t pt-4">
                                    <div className="space-y-3">
                                      {/* Existing Comments */}
                                      {updateComments[update.id]?.map(
                                        (comment) => (
                                          <div
                                            key={comment.id}
                                            className="bg-gray-50 rounded-lg p-3"
                                          >
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="flex items-center space-x-2">
                                                <span className="text-sm font-medium text-gray-900">
                                                  {comment.userId ===
                                                    user?.uid ||
                                                  comment.clientEmail ===
                                                    user?.email
                                                    ? "You"
                                                    : comment.userName ||
                                                      "Unknown"}
                                                </span>
                                                <span
                                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                                    comment.userRole ===
                                                    "freelancer"
                                                      ? "bg-blue-100 text-blue-600"
                                                      : "bg-green-100 text-green-600"
                                                  }`}
                                                >
                                                  {comment.userRole ===
                                                  "freelancer"
                                                    ? "Freelancer"
                                                    : "Client"}
                                                </span>
                                              </div>
                                              <span className="text-xs text-gray-500">
                                                {comment.createdAt?.toDate
                                                  ? comment.createdAt
                                                      .toDate()
                                                      .toLocaleString()
                                                  : "Just now"}
                                              </span>
                                            </div>
                                            <p className="text-sm text-gray-700">
                                              {comment.comment}
                                            </p>
                                          </div>
                                        ),
                                      )}

                                      {/* Add Comment Form */}
                                      <div className="flex space-x-2">
                                        <input
                                          type="text"
                                          value={
                                            newUpdateComments[update.id] || ""
                                          }
                                          onChange={(e) =>
                                            setNewUpdateComments((prev) => ({
                                              ...prev,
                                              [update.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Add a comment..."
                                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <button
                                          onClick={() =>
                                            handleSendUpdateComment(update.id)
                                          }
                                          disabled={
                                            !newUpdateComments[
                                              update.id
                                            ]?.trim()
                                          }
                                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                        >
                                          <Send className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "invoices" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Project Invoices</h3>
                    {projectInvoices.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600">No invoices found for this project</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {projectInvoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h4 className="text-md font-semibold text-gray-900">
                                    Invoice #{invoice.invoiceNumber || invoice.id.slice(0, 8)}
                                  </h4>
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      invoice.status === "paid"
                                        ? "bg-green-100 text-green-800"
                                        : invoice.status === "pending"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : invoice.status === "overdue"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {invoice.status?.toUpperCase()}
                                  </span>
                                </div>
                                {invoice.description && (
                                  <p className="text-sm text-gray-600 mb-2">
                                    {invoice.description}
                                  </p>
                                )}
                                <div className="flex items-center space-x-4 text-sm text-gray-600">
                                  <span className="flex items-center">
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    RM{(invoice.amount || 0).toFixed(2)}
                                  </span>
                                  {invoice.dueDate && (
                                    <span className="flex items-center">
                                      <Calendar className="w-4 h-4 mr-1" />
                                      Due: {new Date(invoice.dueDate.toDate?.() || invoice.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                  {invoice.createdAt && (
                                    <span className="flex items-center">
                                      <Clock className="w-4 h-4 mr-1" />
                                      Sent: {new Date(invoice.createdAt.toDate?.() || invoice.createdAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                {invoice.type && (
                                  <div className="mt-2">
                                    <span className="text-xs text-gray-500">
                                      Type: {invoice.type === "milestone" ? "Milestone Payment" : invoice.type === "deposit" ? "Deposit" : "Final Payment"}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end space-y-2 ml-4">
                                <button
                                  onClick={() => handleDownloadInvoice(invoice)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center space-x-2"
                                  title="Download PDF"
                                >
                                  <Download className="w-4 h-4" />
                                  <span>Download PDF</span>
                                </button>
                                {invoice.status === "pending" && (
                                  <button
                                    onClick={() => navigate("/client-payments")}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                                  >
                                    Pay Now
                                  </button>
                                )}
                                {invoice.status === "paid" && invoice.paidAt && (
                                  <div className="text-xs text-green-600">
                                    Paid: {new Date(invoice.paidAt.toDate?.() || invoice.paidAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Billing tab removed */}
              </div>
            </>
          )}
        </div>
      )}
      {/* Milestone Approval Modal */}
      {showMilestoneModal && selectedMilestone && (
        <MilestoneApprovalModal
          milestone={selectedMilestone}
          onClose={() => {
            setShowMilestoneModal(false);
            setSelectedMilestone(null);
          }}
          onApprovalComplete={handleApprovalComplete}
        />
      )}
    </div>
  );
};

export default ClientDashboard;
