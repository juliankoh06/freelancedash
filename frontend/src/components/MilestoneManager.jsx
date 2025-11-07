import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { updateDoc, doc, addDoc, collection, onSnapshot, getDoc } from "firebase/firestore";
import { db, storage, auth } from "../firebase-config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import invoiceService from "../services/invoiceService";
import { INVOICE_TYPES, INVOICE_STATUSES } from "../models/Invoice";

const MilestoneManager = ({
  project,
  onUpdate,
  currentUser,
  contractStatus,
  isProjectOverdue = false,
}) => {
  const [milestones, setMilestones] = useState(project.milestones || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    percentage: 0,
    amount: 0,
    dueDate: "",
    status: "pending",
    revisionComment: "",
  });
  // Client requests revision
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [revisionMilestone, setRevisionMilestone] = useState(null);
  const [expandedRevisionHistory, setExpandedRevisionHistory] = useState({});
  
  // Client approval confirmation
  const [showApprovalConfirmModal, setShowApprovalConfirmModal] = useState(false);
  const [approvalMilestone, setApprovalMilestone] = useState(null);

  // --- Revision handlers ---
  const handleRequestRevision = (milestone) => {
    setRevisionMilestone(milestone);
    setRevisionText("");
    setShowRevisionModal(true);
  };

  const submitRevisionRequest = async () => {
    if (!revisionText.trim()) {
      alert("Please enter a comment for the revision request.");
      return;
    }
    
    // Check revision limit
    const currentRevisionCount = revisionMilestone.revisionCount || 0;
    if (currentRevisionCount >= 2) {
      alert("Maximum revision limit (2) reached for this milestone. You can either approve or reject it.");
      setShowRevisionModal(false);
      setRevisionMilestone(null);
      setRevisionText("");
      return;
    }
    
    try {
      // Create revision history entry
      const revisionHistory = revisionMilestone.revisionHistory || [];
      const newRevisionEntry = {
        requestedAt: new Date(),
        requestedBy: currentUser?.displayName || currentUser?.email || "Client",
        comment: revisionText,
        revisionNumber: currentRevisionCount + 1,
      };

      const updatedMilestones = milestones.map((m) =>
        m.id === revisionMilestone.id
          ? {
              ...m,
              status: "revision_requested",
              revisionComment: revisionText,
              clientApproved: false,
              revisionCount: currentRevisionCount + 1,
              revisionHistory: [...revisionHistory, newRevisionEntry],
            }
          : m,
      );
      await updateDoc(doc(db, "projects", project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date(),
      });
      setMilestones(updatedMilestones);
      setShowRevisionModal(false);
      setRevisionMilestone(null);
      setRevisionText("");
      alert(`Revision requested (${currentRevisionCount + 1}/2). The freelancer will be notified.`);
      onUpdate?.();
    } catch (error) {
      setShowRevisionModal(false);
      setRevisionMilestone(null);
      setRevisionText("");
      alert("Failed to request revision.");
    }
  };

  // For evidence file uploads
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceText, setEvidenceText] = useState("");
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [pendingMilestone, setPendingMilestone] = useState(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Check if contract is active (both parties signed)
  const isContractActive = contractStatus === "active";
  // Can edit milestones only if contract NOT signed yet
  const canEditMilestones = !isContractActive;

  // Check if current user is client or freelancer
  const isClient = currentUser?.uid === project.clientId;
  const isFreelancer = currentUser?.uid === project.freelancerId;

  useEffect(() => {
    // Listen for real-time updates to the project document
    if (!project?.id) return;
    const unsub = onSnapshot(
      doc(db, "projects", project.id),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMilestones(data.milestones || []);
        }
      }
    );
    return () => unsub();
  }, [project?.id]);

  const handleAddMilestone = async () => {
    const newPercentage = parseInt(formData.percentage) || 0;
    const currentTotal = milestones.reduce(
      (sum, m) => sum + (m.percentage || 0),
      0,
    );

    if (currentTotal + newPercentage > 100) {
      alert(
        `Total milestone percentage cannot exceed 100%. Current total: ${currentTotal}%, trying to add: ${newPercentage}%`,
      );
      return;
    }

    const newMilestone = {
      id: Date.now().toString(),
      ...formData,
      status: "pending",
      invoiceId: null,
      completedAt: null,
      createdAt: new Date(),
      requiresClientApproval: true,
      clientApproved: false,
      clientApprovedAt: null,
      revisionComment: "",
    };

    const updatedMilestones = [...milestones, newMilestone];

    try {
      await updateDoc(doc(db, "projects", project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date(),
      });

      setMilestones(updatedMilestones);
      setShowAddForm(false);
      resetForm();
      onUpdate?.();
    } catch (error) {
      console.error("Error adding milestone:", error);
      alert("Failed to add milestone");
    }
  };

  const handleEditMilestone = async () => {
    const updatedMilestones = milestones.map((m) =>
      m.id === editingMilestone.id ? { ...m, ...formData } : m,
    );

    try {
      await updateDoc(doc(db, "projects", project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date(),
      });

      setMilestones(updatedMilestones);
      setEditingMilestone(null);
      resetForm();
      onUpdate?.();
    } catch (error) {
      console.error("Error updating milestone:", error);
      alert("Failed to update milestone");
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    if (!window.confirm("Are you sure you want to delete this milestone?"))
      return;

    const updatedMilestones = milestones.filter((m) => m.id !== milestoneId);

    try {
      await updateDoc(doc(db, "projects", project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date(),
      });

      setMilestones(updatedMilestones);
      onUpdate?.();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      alert("Failed to delete milestone");
    }
  };

  // Show modal to collect evidence when marking milestone complete
  const handleCompleteMilestone = (milestone) => {
    setPendingMilestone(milestone);
    setEvidenceText("");
    setEvidenceFile(null);
    setShowEvidenceModal(true);
  };
  const submitMilestoneEvidence = async () => {
    const milestone = pendingMilestone;
    if (!milestone) return;
    if (!evidenceText.trim()) {
      alert("Please provide a description of what you did for this milestone.");
      return;
    }
    setUploadingEvidence(true);
    let fileUrl = "";
    try {
      if (evidenceFile) {
        const storageRef = ref(
          storage,
          `milestone_evidence/${project.id}/${milestone.id}/${Date.now()}_${evidenceFile.name}`,
        );
        await uploadBytes(storageRef, evidenceFile);
        fileUrl = await getDownloadURL(storageRef);
      }
    } catch (uploadErr) {
      setUploadingEvidence(false);
      alert("Failed to upload evidence file. Please try again.");
      return;
    }
    setUploadingEvidence(false);

    try {
      // Update milestone status to pending client approval and set evidence
      const updatedMilestones = milestones.map((m) =>
        m.id === milestone.id
          ? {
              ...m,
              status: "client_approval_pending",
              revisionComment: "",
              completedAt: new Date(),
              evidence: evidenceText,
              evidenceFiles: fileUrl ? [fileUrl] : [],
              completedBy: currentUser?.uid,
              clientApproved: false,
            }
          : m,
      );

      await updateDoc(doc(db, "projects", project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date(),
      });

      setMilestones(updatedMilestones);
      setEvidenceFile(null);
      setEvidenceText("");
      setShowEvidenceModal(false);
      setPendingMilestone(null);

      // Send email notification to client
      try {
        await fetch('/api/email/milestone-completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientEmail: project.clientEmail,
            clientName: project.clientName || 'Client',
            projectTitle: project.title,
            milestoneTitle: milestone.title,
            freelancerName: currentUser?.displayName || currentUser?.email || 'Freelancer',
            evidence: evidenceText,
            evidenceFiles: fileUrl ? [fileUrl] : []
          })
        });
        console.log('✅ Milestone completion email sent to client');
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't block the completion if email fails
      }

      alert(
        "✅ Milestone marked as completed! Client has been notified and will review your work.",
      );
      onUpdate?.();
    } catch (error) {
      setShowEvidenceModal(false);
      setPendingMilestone(null);
      console.error("Error completing milestone:", error);
      alert("Failed to complete milestone");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      percentage: 0,
      amount: 0,
      dueDate: "",
      status: "pending",
    });
    setShowAddForm(false);
    setEditingMilestone(null);
  };

  const startEdit = (milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      title: milestone.title,
      description: milestone.description || "",
      percentage: milestone.percentage,
      amount: milestone.amount,
      dueDate: milestone.dueDate
        ? new Date(milestone.dueDate).toISOString().split("T")[0]
        : "",
      status: milestone.status,
    });
    setShowAddForm(true);
  };

  const handleClientApproveMilestone = async (milestone) => {
    setApprovalMilestone(milestone);
    setShowApprovalConfirmModal(true);
  };

  const confirmMilestoneApproval = async () => {
    if (!approvalMilestone) return;
    
    try {
      // Get token from Firebase auth current user
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/approvals/milestone/${approvalMilestone.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId: project.id,
          clientId: currentUser.uid
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve milestone');
      }

      // Refresh project data to get updated milestones and status
      const projectDoc = await getDoc(doc(db, "projects", project.id));
      if (projectDoc.exists()) {
        const updatedProject = projectDoc.data();
        setMilestones(updatedProject.milestones);
      }

      setShowApprovalConfirmModal(false);
      setApprovalMilestone(null);
      
      if (data.data?.projectCompleted) {
        alert("✅ All milestones approved! Project completed and invoice generated.");
      } else {
        alert("✅ Milestone approved by client!");
      }
      
      onUpdate?.();
    } catch (error) {
      console.error("Error approving milestone:", error);
      setShowApprovalConfirmModal(false);
      setApprovalMilestone(null);
      alert(`Failed to approve milestone: ${error.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "invoiced":
        return "bg-blue-100 text-blue-800";
      case "paid":
        return "bg-purple-100 text-purple-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "client_approval_pending":
        return "bg-orange-100 text-orange-800";
      case "awaiting_approval":
        return "bg-orange-100 text-orange-800";
      case "revision_requested":
        return "bg-red-100 text-red-800";
      case "approved":
        return "bg-green-200 text-green-900";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
      case "invoiced":
      case "paid":
      case "approved":
        return <CheckCircle className="w-4 h-4" />;
      case "revision_requested":
        return <Edit2 className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const totalPercentage = milestones.reduce(
    (sum, m) => sum + (m.percentage || 0),
    0,
  );
  const completedPercentage = milestones.reduce(
    (sum, m) => (m.status === "approved" || m.clientApproved) ? sum + (m.percentage || 0) : sum,
    0,
  );
  const totalAmount = milestones.reduce((sum, m) => sum + (m.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Project Milestones
          </h3>
          <p className="text-sm text-gray-600">
            Milestones are defined in the contract and cannot be modified
          </p>
        </div>
      </div>

      {/* Contract Locked Warning */}
      {isContractActive && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>Contract Signed:</strong> Milestones are now locked as per
            the signed contract. You can only update progress and mark
            milestones as complete.
          </div>
        </div>
      )}

      {/* Summary */}
      {milestones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Total Milestones
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {milestones.length}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <DollarSign className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">
                Total Amount
              </span>
            </div>
            <p className="text-2xl font-bold text-purple-900">
              RM{totalAmount.toFixed(2)}
            </p>
          </div>
          {/* Removed Milestones Completed percentage card as requested */}
        </div>
      )}


      {/* Evidence Modal for milestone completion */}
      {showEvidenceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Complete Milestone</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What did you do for this milestone?
            </label>
            <textarea
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3"
              placeholder="Describe your work..."
              disabled={uploadingEvidence}
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload Attachment (optional, 1 file)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setEvidenceFile(e.target.files[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-2"
              disabled={uploadingEvidence}
            />
            {evidenceFile && (
              <div className="text-xs text-gray-600 mb-2">
                Selected: {evidenceFile.name}
              </div>
            )}
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowEvidenceModal(false);
                  setPendingMilestone(null);
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={uploadingEvidence}
              >
                Cancel
              </button>
              <button
                onClick={submitMilestoneEvidence}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={uploadingEvidence}
              >
                {uploadingEvidence ? "Uploading..." : "Submit Evidence"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {editingMilestone ? "Edit Milestone" : "Add New Milestone"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Design Phase Complete"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Percentage *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    percentage: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (RM) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4">
            <button
              onClick={
                editingMilestone ? handleEditMilestone : handleAddMilestone
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {editingMilestone ? "Update" : "Add"} Milestone
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Milestones List */}
      {milestones.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            No milestones defined in the contract
          </p>
          <p className="text-sm text-gray-500">
            Milestones are created automatically from the signed contract
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-md font-semibold text-gray-900">
                      {milestone.title}
                    </h4>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}
                    >
                      {getStatusIcon(milestone.status)}
                      <span className="ml-1">{milestone.status}</span>
                    </span>
                  </div>
                  {milestone.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {milestone.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <DollarSign className="w-4 h-4 mr-1" />
                      RM{milestone.amount.toFixed(2)} ({milestone.percentage}%)
                    </span>
                    {milestone.dueDate && (
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(milestone.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {/* Show revision count for completed/client_approval_pending milestones */}
                    {(milestone.status === "completed" || milestone.status === "client_approval_pending") && (
                      <button
                        onClick={() => setExpandedRevisionHistory({
                          ...expandedRevisionHistory,
                          [milestone.id]: !expandedRevisionHistory[milestone.id]
                        })}
                        className="flex items-center text-blue-600 font-medium hover:text-blue-700 transition-colors"
                      >
                        Revisions: {milestone.revisionCount || 0} / 2 ({2 - (milestone.revisionCount || 0)} remaining)
                        <span className="ml-1 text-xs">
                          {expandedRevisionHistory[milestone.id] ? "▼" : "▶"}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Revision History Section */}
                  {expandedRevisionHistory[milestone.id] && milestone.revisionHistory && milestone.revisionHistory.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="font-medium text-sm text-blue-900 mb-2">
                        Revision History
                      </div>
                      <div className="space-y-2">
                        {milestone.revisionHistory.map((revision, idx) => (
                          <div key={idx} className="bg-white p-2 rounded border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-blue-800">
                                Revision #{revision.revisionNumber}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(revision.requestedAt?.toDate?.() || revision.requestedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mb-1">
                              By: {revision.requestedBy}
                            </div>
                            <div className="text-sm text-gray-800">
                              {revision.comment}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evidence Text Section */}
                  {milestone.evidence && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="font-medium text-sm text-gray-700 mb-2">
                        Work Evidence:
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {milestone.evidence}
                      </p>
                    </div>
                  )}

                  {/* Evidence Files Section */}
                  {milestone.evidenceFiles &&
                    milestone.evidenceFiles.length > 0 && (
                      <div className="mt-3">
                        <div className="font-medium text-sm text-gray-700 mb-1">
                          Evidence Files:
                        </div>
                        <ul className="space-y-1">
                          {milestone.evidenceFiles.map((url, idx) => {
                            const isImage = url.match(
                              /\.(jpeg|jpg|gif|png|webp)$/i,
                            );
                            return (
                              <li
                                key={idx}
                                className="flex items-center space-x-2"
                              >
                                {isImage ? (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <img
                                      src={url}
                                      alt={`evidence-${idx}`}
                                      className="w-16 h-16 object-cover rounded border"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 underline"
                                  >
                                    View File {idx + 1}
                                  </a>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  {/* End Evidence Files Section */}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {/* Freelancer action: mark as complete */}
                  {milestone.status === "pending" && isFreelancer && (
                    <button
                      onClick={() => {
                        console.log("🔍 Mark Complete clicked:", {
                          currentUser,
                          milestone,
                        });
                        handleCompleteMilestone(milestone);
                      }}
                      disabled={isProjectOverdue}
                      className={`p-2 rounded-md transition-colors ${
                        isProjectOverdue
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-green-600 hover:bg-green-50"
                      }`}
                      title={
                        isProjectOverdue
                          ? "Project is overdue - cannot complete milestone"
                          : "Mark as Complete"
                      }
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                  {/* Client actions: approve or request revision */}
                  {(milestone.status === "completed" ||
                    milestone.status === "client_approval_pending") &&
                    !milestone.clientApproved &&
                    isClient && (
                      <>
                        <button
                          onClick={() =>
                            handleClientApproveMilestone(milestone)
                          }
                          className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                          title="Approve Milestone"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleRequestRevision(milestone)}
                          disabled={(milestone.revisionCount || 0) >= 2}
                          className={`p-2 rounded-md transition-colors ${
                            (milestone.revisionCount || 0) >= 2
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-yellow-600 hover:bg-yellow-50"
                          }`}
                          title={
                            (milestone.revisionCount || 0) >= 2
                              ? "Maximum revisions reached"
                              : "Request Revision"
                          }
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                </div>
              </div>

              {/* Show revision comment and resubmit button if revision requested */}
              {milestone.status === "revision_requested" && (
                <div className="mt-3 p-4 bg-red-50 border-l-4 border-red-500 rounded-r">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                        <div className="font-semibold text-red-800">
                          Revision Requested
                        </div>
                      </div>
                      {milestone.revisionComment && (
                        <p className="text-sm text-red-900 mb-3">
                          {milestone.revisionComment}
                        </p>
                      )}
                    </div>
                    {/* Only freelancer can resubmit */}
                    {isFreelancer && (
                      <button
                        onClick={() => {
                          handleCompleteMilestone(milestone);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                        title="Resubmit Milestone"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Resubmit
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {showApprovalConfirmModal && approvalMilestone && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-green-900">Approve Milestone</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-3">
                Are you sure you want to approve this milestone? This action will:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-3">
                <li>Mark the milestone as approved</li>
                <li>Trigger invoice generation if all milestones are completed</li>
                <li>Allow the freelancer to proceed with the next phase</li>
              </ul>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="font-medium text-sm text-blue-900 mb-1">
                  {approvalMilestone.title}
                </div>
                <div className="text-sm text-blue-800">
                  Amount: RM{approvalMilestone.amount.toFixed(2)} ({approvalMilestone.percentage}%)
                </div>
                {approvalMilestone.evidence && (
                  <div className="mt-2 text-xs text-gray-700">
                    <span className="font-medium">Evidence:</span> {approvalMilestone.evidence.substring(0, 100)}...
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowApprovalConfirmModal(false);
                  setApprovalMilestone(null);
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmMilestoneApproval}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Yes, Approve Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Request Revision</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What needs to be revised?
            </label>
            <textarea
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3"
              placeholder="Describe what needs to be changed..."
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowRevisionModal(false);
                  setRevisionMilestone(null);
                  setRevisionText("");
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRevisionRequest}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
              >
                Submit Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MilestoneManager;
