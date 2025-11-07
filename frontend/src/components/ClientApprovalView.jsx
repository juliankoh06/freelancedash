import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, DollarSign, User, Calendar, FileText, AlertCircle, MessageSquare, History } from 'lucide-react';
import { collection, query, getDocs, where, updateDoc, doc, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase-config';
import invoiceService from '../services/invoiceService';
import { INVOICE_STATUSES } from '../models/Invoice';
import InvoicePreviewModal from './InvoicePreviewModal';

const ClientApprovalView = ({ projectId, onApprovalUpdate, user }) => {
  const [completionRequest, setCompletionRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState(null);
  const [revisionHistory, setRevisionHistory] = useState([]);
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);

  useEffect(() => {
    fetchCompletionRequest();
    fetchRevisionHistory();
  }, [projectId]);

  useEffect(() => {
    console.log('showRevisionModal changed to:', showRevisionModal);
  }, [showRevisionModal]);

  const fetchRevisionHistory = async () => {
    try {
      const q = query(
        collection(db, 'revision_history'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRevisionHistory(history);
    } catch (error) {
      console.error('Error fetching revision history:', error);
    }
  };

  const fetchCompletionRequest = async () => {
    try {
      const q = query(
        collection(db, 'completion_requests'),
        where('projectId', '==', projectId),
        where('status', '==', 'pending_approval')
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const request = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setCompletionRequest(request);
      } else {
        setCompletionRequest(null);
      }
    } catch (error) {
      console.error('Error fetching completion request:', error);
      setCompletionRequest(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approved) => {
    if (!completionRequest) {
      console.error('No completion request found');
      alert('No completion request found. Please refresh the page.');
      return;
    }
    
    if (!approved) {
      // Show revision modal to get reason
      console.log('Opening revision modal... Current showRevisionModal state:', showRevisionModal);
      setShowRevisionModal(true);
      console.log('After setting showRevisionModal to true');
      return;
    }

    // For approval, show invoice preview modal
    const invoiceData = prepareInvoiceData();
    setInvoicePreviewData(invoiceData);
    setShowInvoicePreview(true);
  };

  const handleRevisionSubmit = async () => {
    if (!revisionReason.trim()) {
      alert('Please provide a reason for revision');
      return;
    }

    setApproving(true);
    setShowRevisionModal(false);
    
    try {
      // Count previous revisions
      const revisionCount = revisionHistory.length + 1;
      
      // Add to revision history
      await addDoc(collection(db, 'revision_history'), {
        projectId: projectId,
        requestId: completionRequest.id,
        revisionNumber: revisionCount,
        reason: revisionReason,
        requestedBy: user.uid,
        requestedByName: user.displayName || user.email,
        requestedAt: new Date(),
        status: 'pending',
        freelancerId: completionRequest.freelancerId,
        clientId: completionRequest.clientId
      });

      await updateDoc(doc(db, 'completion_requests', completionRequest.id), {
        status: 'rejected',
        respondedAt: new Date(),
        clientNotes: revisionReason,
        revisionCount: revisionCount
      });

      await updateDoc(doc(db, 'projects', projectId), {
        status: 'active',
        revisionCount: revisionCount,
        needsAttention: revisionCount >= 3, // Flag if 3+ revisions
        needsRevision: true, // Mark that it needs revision
        updatedAt: new Date()
      });

      await addDoc(collection(db, 'project_comments'), {
        projectId: projectId,
        freelancerId: completionRequest.freelancerId,
        clientId: completionRequest.clientId,
        clientEmail: completionRequest.clientEmail,
        comment: `Revision requested (Attempt ${revisionCount}): ${revisionReason}`,
        type: 'client_revision_request',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create notification for freelancer
      await addDoc(collection(db, 'notifications'), {
        freelancerId: completionRequest.freelancerId,
        projectId: projectId,
        type: 'completion_rejected',
        title: 'Project Completion Needs Revision',
        message: `Client has requested revisions for "${completionRequest.projectTitle || 'your project'}"`,
        revisionReason: revisionReason,
        revisionCount: revisionCount,
        createdAt: new Date(),
        read: false
      });

      if (revisionCount >= 3) {
        alert(`⚠️ This is revision #${revisionCount}. Project flagged for discussion. Consider scheduling a meeting with the freelancer.`);
      } else {
        alert('📝 Revision requested! Freelancer has been notified.');
      }
      
      setRevisionReason('');
      fetchRevisionHistory();
      onApprovalUpdate?.(false);
    } catch (error) {
      console.error('Error updating approval:', error);
      alert(`Failed to update approval: ${error.message}`);
    } finally {
      setApproving(false);
    }
  };

  const prepareInvoiceData = () => {
  const totalAmount = completionRequest.totalAmount || 0;
  const totalHours = Number(completionRequest.totalHours) || 0;
  const hourlyRate = Number(completionRequest.hourlyRate) || 0;

    // Extract client name from user data or email
    const clientName = user?.displayName || 
                       user?.email?.split('@')[0]?.replace(/[._]/g, ' ') || 
                       'Client';

    // Use pre-filled invoice data from freelancer if available
    const previewData = completionRequest.previewInvoiceData || {};

    return {
      projectId: projectId,
      projectTitle: completionRequest.projectTitle || 'Untitled Project',
      clientId: completionRequest.clientId || user?.uid || 'unknown-client',
      clientEmail: completionRequest.clientEmail || user?.email || '',
      clientName: clientName,
      freelancerId: completionRequest.freelancerId || 'unknown-freelancer',
      freelancerName: completionRequest.freelancerName || 'Freelancer',
      freelancerEmail: completionRequest.freelancerEmail || '',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: INVOICE_STATUSES.SENT,
      subtotal: totalAmount,
      taxRate: previewData.taxRate || 0.06,
      taxAmount: totalAmount * (previewData.taxRate || 0.06),
      totalAmount: totalAmount * (1 + (previewData.taxRate || 0.06)),
      currency: 'RM',
      // Use freelancer's line items if provided, otherwise generate default
      lineItems: previewData.lineItems || [
        {
          description: `${completionRequest.projectTitle || 'Project Work'} - ${totalHours.toFixed(1)} hours of development work`,
          quantity: totalHours,
          rate: hourlyRate,
          amount: totalAmount
        }
      ],
      paymentTerms: previewData.paymentTerms || 'Net 30',
      notes: previewData.notes || `Project completed and approved on ${new Date().toLocaleDateString()}. Total work time: ${totalHours.toFixed(2)} hours at RM${hourlyRate.toFixed(2)}/hour. Tasks completed: ${completionRequest.completedTasks || 0}/${completionRequest.totalTasks || 0}.`,
      terms: previewData.terms || 'Payment is due within 30 days of invoice date. Thank you for your business!'
    };
  };

  const handleConfirmInvoice = async (finalInvoiceData) => {
    setApproving(true);
    setShowInvoicePreview(false);
    
    try {
      // Update completion request status
      await updateDoc(doc(db, 'completion_requests', completionRequest.id), {
        status: 'approved',
        respondedAt: new Date(),
        clientNotes: 'Work approved'
      });

      // Update project status
      await updateDoc(doc(db, 'projects', projectId), {
        status: 'completed',
        updatedAt: new Date()
      });

      // Generate invoice with reviewed data
      try {
        const result = await invoiceService.createInvoice(finalInvoiceData);
        
        if (result.success) {
          console.log('✅ Invoice created successfully:', result.id);
          
          // Send invoice email
          try {
            await invoiceService.sendInvoiceEmail(result.id);
            alert('✅ Project approved! Invoice generated and sent to client via email.');
          } catch (emailError) {
            console.error('Email sending failed:', emailError);
            alert('✅ Project approved! Invoice generated but email sending failed. You can send it manually from the invoice list.');
          }
        } else {
          throw new Error(result.error || 'Failed to create invoice');
        }
      } catch (invoiceError) {
        console.error('Invoice generation failed:', invoiceError);
        alert('Project approved but invoice generation failed. Please check the console for details.');
      }

      onApprovalUpdate?.(true);
      
    } catch (error) {
      console.error('Error updating approval:', error);
      alert(`Failed to update approval: ${error.message}`);
    } finally {
      setApproving(false);
    }
  };

  const handleSaveDraftInvoice = async (draftInvoiceData) => {
    setApproving(true);
    setShowInvoicePreview(false);
    
    try {
      // Update completion request and project status
      await updateDoc(doc(db, 'completion_requests', completionRequest.id), {
        status: 'approved',
        respondedAt: new Date(),
        clientNotes: 'Work approved'
      });

      await updateDoc(doc(db, 'projects', projectId), {
        status: 'completed',
        updatedAt: new Date()
      });

      // Save invoice as draft
      const draftData = { ...draftInvoiceData, status: INVOICE_STATUSES.DRAFT };
      const result = await invoiceService.createInvoice(draftData);
      
      if (result.success) {
        alert('✅ Project approved! Invoice saved as draft. You can edit and send it from the invoice list.');
        onApprovalUpdate?.(true);
      } else {
        throw new Error(result.error || 'Failed to save draft invoice');
      }
    } catch (error) {
      console.error('Error saving draft invoice:', error);
      alert(`Failed to save draft invoice: ${error.message}`);
    } finally {
      setApproving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Clock className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading approval request...</span>
      </div>
    );
  }

  if (!completionRequest) {
    return (
      <div className="text-center p-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No pending approval request found.</p>
      </div>
    );
  }

  return (
    <>
      {showInvoicePreview && invoicePreviewData && (
        <InvoicePreviewModal
          invoiceData={invoicePreviewData}
          onConfirm={handleConfirmInvoice}
          onCancel={() => setShowInvoicePreview(false)}
          onSaveDraft={handleSaveDraftInvoice}
          readOnly={true}
        />
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Project Completion Approval</h3>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>Requested: {completionRequest.requestedAt?.toDate()?.toLocaleDateString()}</span>
        </div>
      </div>

      {/* Project Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <User className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Freelancer</span>
          </div>
          <p className="text-lg font-semibold text-blue-900">{completionRequest.freelancerName}</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">Progress</span>
          </div>
          <p className="text-lg font-semibold text-green-900">
            {completionRequest.completedTasks}/{completionRequest.totalTasks} tasks
          </p>
          <p className="text-sm text-green-700">
            {completionRequest.completionPercentage}% complete
          </p>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-900">Total Amount</span>
          </div>
          <p className="text-lg font-semibold text-yellow-900">
            RM{((completionRequest.totalAmount || 0) * 1.06).toFixed(2)}
          </p>
          <p className="text-sm text-yellow-700">
            {completionRequest.totalHours || 0}h × RM{completionRequest.hourlyRate || 0}/h
          </p>
        </div>
      </div>

      {/* Project Details */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 mb-3">Project Details</h4>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-700 mb-2">
            <strong>Project:</strong> {completionRequest.projectTitle || 'Untitled Project'}
          </p>
          <p className="text-sm text-gray-700 mb-2">
            <strong>Total Hours:</strong> {(completionRequest.totalHours || 0).toFixed(2)} hours
          </p>
          <p className="text-sm text-gray-700 mb-2">
            <strong>Hourly Rate:</strong> RM{completionRequest.hourlyRate || 0}/hour
          </p>
          <p className="text-sm text-gray-700">
            <strong>Notes:</strong> {completionRequest.notes || 'No additional notes provided'}
          </p>
        </div>
      </div>

      {/* Approval Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Review the work and approve to generate invoice
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleApproval(false)}
            disabled={approving}
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4 mr-2" />
            {approving ? 'Processing...' : 'Request Revision'}
          </button>
          <button
            onClick={() => handleApproval(true)}
            disabled={approving}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {approving ? 'Processing...' : 'Approve & Pay'}
          </button>
        </div>
      </div>

      {/* Revision History Section */}
      {revisionHistory.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowRevisionHistory(!showRevisionHistory)}
            className="flex items-center justify-between w-full text-left mb-4"
          >
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-gray-600" />
              <h4 className="text-md font-medium text-gray-900">
                Revision History ({revisionHistory.length})
              </h4>
              {revisionHistory.length >= 3 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  Needs Discussion
                </span>
              )}
            </div>
            <span className="text-gray-400">{showRevisionHistory ? '▼' : '▶'}</span>
          </button>

          {showRevisionHistory && (
            <div className="space-y-3">
              {revisionHistory.map((revision, index) => (
                <div key={revision.id} className="bg-gray-50 p-4 rounded-lg border-l-4 border-yellow-500">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-yellow-600" />
                      <span className="font-medium text-gray-900">
                        Revision #{revision.revisionNumber}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {revision.requestedAt?.toDate()?.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Reason:</strong> {revision.reason}
                  </p>
                  <p className="text-xs text-gray-500">
                    Requested by: {revision.requestedByName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Revision Modal */}
    {showRevisionModal && (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={(e) => {
          // Close modal if clicking the backdrop
          if (e.target === e.currentTarget) {
            console.log('Clicked backdrop');
          }
        }}
      >
        <div 
          className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border-4 border-red-500"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Revision</h3>
          <p className="text-sm text-gray-600 mb-4">
            Please explain what needs to be improved or changed:
          </p>
          <textarea
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            placeholder="e.g., The design doesn't match the mockup, colors need to be adjusted..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          {revisionHistory.length >= 2 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ This will be revision #{revisionHistory.length + 1}. 
                {revisionHistory.length >= 2 && ' Consider scheduling a meeting to discuss expectations.'}
              </p>
            </div>
          )}
          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              onClick={() => {
                console.log('Cancel button clicked');
                setShowRevisionModal(false);
                setRevisionReason('');
              }}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleRevisionSubmit}
              disabled={!revisionReason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Submit Revision Request
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ClientApprovalView;
