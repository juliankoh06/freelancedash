import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  Download,
  Loader,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import approvalService from "../services/approvalService";

const MilestoneApprovalModal = ({ milestone, onClose, onApprovalComplete }) => {
  const navigate = useNavigate();
  const [isApproving, setIsApproving] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionComment, setRevisionComment] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);

  const revisionCount = milestone.revisionCount || 0;
  const maxRevisions = milestone.maxRevisions || 2;
  const revisionsRemaining = maxRevisions - revisionCount;

  const handleApprove = async () => {
    if (isApproving) return;
    
    // Show confirmation modal instead of simple confirm
    setShowApprovalConfirm(true);
  };

  const confirmApproval = async () => {
    setShowApprovalConfirm(false);

    setIsApproving(true);
    setError("");

    try {
      // Debug log to verify milestone data
      console.log("Submitting approval with:", {
        milestoneId: milestone.milestoneId,
        projectId: milestone.projectId,
        clientId: milestone.clientId,
      });

      const result = await approvalService.approveMilestone(
        milestone.milestoneId,
        milestone.projectId,
        milestone.clientId || "unknown",
      );

      if (result.success) {
        const message = result.data.invoiceGenerated
          ? `✅ Milestone approved and invoice generated!${result.data.projectCompleted ? " Project is now complete." : ""}`
          : `✅ Milestone approved!${result.data.projectCompleted ? " All milestones complete - invoice will be generated for full project." : " No invoice yet (payment at end)."}`;

        setSuccess(message);

        setTimeout(() => {
          onApprovalComplete?.(result);
          onClose();
          // Redirect to project details page
          if (milestone.projectId) {
            navigate(`/project-tracking?project=${milestone.projectId}`);
          }
        }, 1500);
      } else {
        setError(result.error || "Failed to approve milestone");
      }
    } catch (err) {
      console.error("Error approving milestone:", err);
      setError("An error occurred while approving the milestone");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = () => {
    setShowRevisionForm(true);
    setError("");
  };

  const handleSubmitRevision = async () => {
    if (!revisionComment.trim()) {
      setError("Please provide a reason for requesting revision");
      return;
    }

    // Check if revision limit reached
    if (revisionCount >= maxRevisions) {
      setError(
        `Maximum revisions (${maxRevisions}) reached for this milestone. Please contact freelancer directly for additional changes.`,
      );
      return;
    }

    setIsApproving(true);
    setError("");

    try {
      // Debug log to verify milestone data
      console.log("Submitting revision request with:", {
        milestoneId: milestone.milestoneId,
        projectId: milestone.projectId,
        clientId: milestone.clientId,
        revisionComment,
      });

      const result = await approvalService.rejectMilestone(
        milestone.milestoneId,
        milestone.projectId,
        milestone.clientId || "unknown",
        revisionComment,
      );

      if (result.success) {
        const remaining = result.data?.revisionsRemaining || 0;
        setSuccess(
          `✅ Revision requested successfully! Freelancer has been notified. (${remaining} revision${remaining !== 1 ? "s" : ""} remaining)`,
        );
        setTimeout(() => {
          onApprovalComplete?.(result);
          onClose();
          // Redirect to project details page
          if (milestone.projectId) {
            navigate(`/project-tracking?project=${milestone.projectId}`);
          }
        }, 2000);
      } else {
        setError(result.error || "Failed to request revision");
      }
    } catch (err) {
      console.error("Error requesting revision:", err);
      setError("An error occurred while requesting revision");
    } finally {
      setIsApproving(false);
    }
  };

  const renderFile = (file, index) => {
    const isImage =
      file.type?.startsWith("image/") ||
      file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

    if (isImage) {
      return (
        <div key={index} className="relative group">
          <img
            src={file.url}
            alt={file.name || `Attachment ${index + 1}`}
            className="w-32 h-32 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(file.url, "_blank")}
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {file.name && (
            <p className="text-xs text-gray-600 mt-1 truncate max-w-[128px]">
              {file.name}
            </p>
          )}
        </div>
      );
    }

    return (
      <a
        key={index}
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
      >
        <FileText className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" />
        <span className="text-sm text-gray-700 flex-1 truncate">
          {file.name || `File ${index + 1}`}
        </span>
        <Download className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
      </a>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Review Milestone
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {milestone.projectTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          )}

          {/* Milestone Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {milestone.milestoneTitle}
            </h3>
            {milestone.milestoneDescription && (
              <p className="text-gray-700 mb-4">
                {milestone.milestoneDescription}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-600">Amount</span>
                <p className="text-2xl font-bold text-blue-600">
                  RM{Number(milestone.amount || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Payment Policy</span>
                <p className="text-lg font-semibold text-gray-900">
                  {milestone.paymentPolicy === "milestone" ? (
                    <span className="text-green-600">💳 Per Milestone</span>
                  ) : (
                    <span className="text-blue-600">📦 At Project End</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Freelancer</span>
                <p className="text-lg font-semibold text-gray-900">
                  {milestone.freelancerName || "Unknown"}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Completed</span>
                <p className="text-lg font-semibold text-gray-900">
                  {milestone.completedAt?.toDate
                    ? milestone.completedAt.toDate().toLocaleDateString()
                    : "Recently"}
                </p>
              </div>
            </div>

            {/* Revision Tracking */}
            {(revisionCount > 0 || maxRevisions > 0) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Revisions
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-lg font-bold ${revisionsRemaining > 0 ? "text-blue-600" : "text-red-600"}`}
                    >
                      {revisionCount} / {maxRevisions}
                    </span>
                    <span className="text-sm text-gray-600">
                      ({revisionsRemaining} remaining)
                    </span>
                  </div>
                </div>
                {revisionsRemaining === 0 && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ Maximum revisions reached. Contact freelancer for
                    additional changes.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Payment Policy Notice */}
          {milestone.paymentPolicy === "milestone" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>💳 Invoice will be generated immediately</strong> upon
                approval. You'll receive an email with the invoice details.
              </p>
            </div>
          )}

          {milestone.paymentPolicy === "end" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>📦 No invoice yet</strong> - Payment will be collected
                after all milestones are completed.
              </p>
            </div>
          )}

          {/* Evidence Section */}
          {milestone.evidence && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                Work Evidence
              </h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {milestone.evidence}
                </p>
              </div>
            </div>
          )}

          {/* Attachments */}
          {milestone.evidenceFiles && milestone.evidenceFiles.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                Attachments ({milestone.evidenceFiles.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {milestone.evidenceFiles.map((file, index) =>
                  renderFile(file, index),
                )}
              </div>
            </div>
          )}

          {/* Revision Form */}
          {showRevisionForm && !success && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900">
                  Request Revision
                </h4>
                <span
                  className={`text-sm font-medium ${revisionsRemaining > 0 ? "text-blue-600" : "text-red-600"}`}
                >
                  {revisionsRemaining} revision
                  {revisionsRemaining !== 1 ? "s" : ""} remaining
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Please explain what needs to be revised or improved:
              </p>
              <textarea
                value={revisionComment}
                onChange={(e) => setRevisionComment(e.target.value)}
                placeholder="E.g., The design needs to match the brand colors more closely..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                rows={4}
              />
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={handleSubmitRevision}
                  disabled={isApproving || !revisionComment.trim()}
                  className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center"
                >
                  {isApproving ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Revision Request"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowRevisionForm(false);
                    setRevisionComment("");
                    setError("");
                  }}
                  disabled={isApproving}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!showRevisionForm && !success && (
            <div className="flex space-x-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold text-lg flex items-center justify-center"
              >
                {isApproving ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin mr-2" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Approve Milestone
                  </>
                )}
              </button>
              <button
                onClick={handleReject}
                disabled={isApproving || revisionsRemaining === 0}
                className="flex-1 bg-yellow-500 text-white py-3 px-6 rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold text-lg flex items-center justify-center"
                title={
                  revisionsRemaining === 0
                    ? "Maximum revisions reached"
                    : "Request changes to this milestone"
                }
              >
                <AlertCircle className="w-5 h-5 mr-2" />
                Request Revision{" "}
                {revisionsRemaining > 0 && `(${revisionsRemaining})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Approval Confirmation Modal */}
      {showApprovalConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
              <h3 className="text-xl font-bold text-gray-900">
                Confirm Approval
              </h3>
            </div>
            
            <div className="space-y-4 mb-6">
              <p className="text-gray-700">
                You are about to approve:
              </p>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="font-semibold text-gray-900 mb-2">
                  {milestone.milestoneTitle}
                </p>
                <p className="text-lg font-bold text-blue-600">
                  RM{Number(milestone.amount || 0).toFixed(2)}
                </p>
              </div>

              {milestone.evidence && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    Freelancer's Work Evidence:
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {milestone.evidence}
                  </p>
                </div>
              )}
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  {milestone.paymentPolicy === "milestone" ? (
                    <>
                      ⚠️ <strong>An invoice will be generated immediately</strong> upon approval.
                    </>
                  ) : (
                    <>
                      ℹ️ No invoice will be generated yet. Payment will be handled at project completion.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowApprovalConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmApproval}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MilestoneApprovalModal;
