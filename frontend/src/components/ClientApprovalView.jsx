import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, DollarSign, User, Calendar, FileText, AlertCircle } from 'lucide-react';
import { collection, query, getDocs, where, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import invoiceService from '../services/invoiceService';
import { INVOICE_STATUSES } from '../models/Invoice';

const ClientApprovalView = ({ projectId, onApprovalUpdate, user }) => {
  const [completionRequest, setCompletionRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetchCompletionRequest();
  }, [projectId]);

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
    
    setApproving(true);
    try {

      // Update completion request status
      await updateDoc(doc(db, 'completion_requests', completionRequest.id), {
        status: approved ? 'approved' : 'rejected',
        respondedAt: new Date(),
        clientNotes: approved ? 'Work approved' : 'Work needs revision'
      });

      // Update project status
      await updateDoc(doc(db, 'projects', projectId), {
        status: approved ? 'completed' : 'active',
        updatedAt: new Date()
      });

      if (approved) {
        // Generate invoice automatically
        try {
          const invoiceResult = await generateInvoice();
          
          // Send invoice email automatically
          try {
            await invoiceService.sendInvoiceEmail(invoiceResult.invoiceId);
            alert('✅ Project approved! Invoice generated and sent to client via email.');
          } catch (emailError) {
            console.error('Email sending failed:', emailError);
            alert('✅ Project approved! Invoice generated but email sending failed. You can send it manually from the invoice list.');
          }
        } catch (invoiceError) {
          console.error('Invoice generation failed:', invoiceError);
          alert('⚠️ Project approved but invoice generation failed. Please check the console for details.');
        }
      } else {
        // Add revision comment for freelancer
        await addDoc(collection(db, 'project_comments'), {
          projectId: projectId,
          freelancerId: completionRequest.freelancerId,
          clientId: completionRequest.clientId,
          clientEmail: completionRequest.clientEmail,
          comment: 'Client requested revision. Please review and improve the work.',
          type: 'client_revision_request',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        alert('📝 Revision requested! Freelancer has been notified to improve the work.');
      }

      onApprovalUpdate?.(approved);
      
    } catch (error) {
      console.error('Error updating approval:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        completionRequestId: completionRequest?.id,
        projectId
      });
      alert(`Failed to update approval: ${error.message}. Please check the console for details.`);
    } finally {
      setApproving(false);
    }
  };

  const generateInvoice = async () => {
    try {
      const totalAmount = completionRequest.totalAmount || 0;
      const totalHours = completionRequest.totalHours || 0;
      const hourlyRate = completionRequest.hourlyRate || 0;
      
      console.log('Creating invoice with data:', {
        totalAmount,
        totalHours,
        hourlyRate,
        projectTitle: completionRequest.projectTitle,
        clientEmail: completionRequest.clientEmail,
        userEmail: user?.email
      });

      const invoiceData = {
        projectId: projectId,
        projectTitle: completionRequest.projectTitle || 'Untitled Project',
        clientId: completionRequest.clientId || 'unknown-client',
        clientEmail: completionRequest.clientEmail || user?.email || '',
        clientName: 'Client', // You might want to fetch this from user data
        freelancerId: completionRequest.freelancerId || 'unknown-freelancer',
        freelancerName: completionRequest.freelancerName || 'Freelancer',
        freelancerEmail: '', // You might want to fetch this
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: INVOICE_STATUSES.SENT,
        subtotal: totalAmount,
        taxRate: 0.06, // 6% GST
        taxAmount: totalAmount * 0.06,
        totalAmount: totalAmount * 1.06,
        currency: 'RM',
        lineItems: [
          {
            description: `Project: ${completionRequest.projectTitle || 'Untitled Project'}`,
            quantity: 1,
            rate: totalAmount,
            amount: totalAmount
          }
        ],
        paymentTerms: 'Net 30',
        notes: `Project completed and approved on ${new Date().toLocaleDateString()}. Total work time: ${(totalHours || 0).toFixed(2)} hours.`,
        terms: 'Payment is due within 30 days of invoice date. Thank you for your business!'
      };

      // Add line item for hours if we have hourly rate data
      if (totalHours > 0 && hourlyRate > 0) {
        invoiceData.lineItems.push({
          description: `Total hours worked: ${(totalHours || 0).toFixed(2)}h`,
          quantity: totalHours,
          rate: hourlyRate,
          amount: totalHours * hourlyRate
        });
      }

      console.log('Invoice data prepared:', invoiceData);

      const result = await invoiceService.createInvoice(invoiceData);
      
      if (result.success) {
        console.log('✅ Invoice created successfully:', result.id);
        console.log('Invoice data saved:', invoiceData);
        return { success: true, invoiceId: result.id, invoice: result.invoice };
      } else {
        console.error('Invoice creation failed:', result.error);
        throw new Error(result.error || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
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
    </div>
  );
};

export default ClientApprovalView;
