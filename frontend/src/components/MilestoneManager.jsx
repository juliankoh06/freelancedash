import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, Clock, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { updateDoc, doc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase-config';
import invoiceService from '../services/invoiceService';
import { INVOICE_TYPES, INVOICE_STATUSES } from '../models/Invoice';

const MilestoneManager = ({ project, onUpdate, currentUser, contractStatus }) => {
  const [milestones, setMilestones] = useState(project.milestones || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    percentage: 0,
    amount: 0,
    dueDate: '',
    status: 'pending'
  });
  
  // Check if contract is active (both parties signed)
  const isContractActive = contractStatus === 'active';
  // Can edit milestones only if contract NOT signed yet
  const canEditMilestones = !isContractActive;

  useEffect(() => {
    setMilestones(project.milestones || []);
  }, [project.milestones]);

  const handleAddMilestone = async () => {
    // Validate milestone percentage doesn't exceed 100%
    const newPercentage = parseInt(formData.percentage) || 0;
    const currentTotal = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
    
    if (currentTotal + newPercentage > 100) {
      alert(`Total milestone percentage cannot exceed 100%. Current total: ${currentTotal}%, trying to add: ${newPercentage}%`);
      return;
    }

    const newMilestone = {
      id: Date.now().toString(),
      ...formData,
      status: 'pending',
      invoiceId: null,
      completedAt: null,
      createdAt: new Date(),
      requiresClientApproval: true,
      clientApproved: false,
      clientApprovedAt: null
    };

    const updatedMilestones = [...milestones, newMilestone];
    
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date()
      });
      
      setMilestones(updatedMilestones);
      setShowAddForm(false);
      resetForm();
      onUpdate?.();
    } catch (error) {
      console.error('Error adding milestone:', error);
      alert('Failed to add milestone');
    }
  };

  const handleEditMilestone = async () => {
    const updatedMilestones = milestones.map(m => 
      m.id === editingMilestone.id ? { ...m, ...formData } : m
    );
    
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date()
      });
      
      setMilestones(updatedMilestones);
      setEditingMilestone(null);
      resetForm();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating milestone:', error);
      alert('Failed to update milestone');
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    
    const updatedMilestones = milestones.filter(m => m.id !== milestoneId);
    
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date()
      });
      
      setMilestones(updatedMilestones);
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting milestone:', error);
      alert('Failed to delete milestone');
    }
  };

  const handleCompleteMilestone = async (milestone) => {
    // Check if milestone requires client approval
    if (milestone.requiresClientApproval && !milestone.clientApproved) {
      alert('This milestone requires client approval before completion. Please wait for client approval.');
      return;
    }

    // Validate milestone completion with evidence
    const hasEvidence = milestone.evidence && milestone.evidence.length > 0;
    if (!hasEvidence) {
      const evidence = prompt('Please provide evidence of milestone completion (description of work done):');
      if (!evidence || evidence.trim() === '') {
        alert('Evidence of completion is required to mark milestone as complete.');
        return;
      }
    }
    
    try {
      // Update milestone status to completed
      const updatedMilestones = milestones.map(m => 
        m.id === milestone.id 
          ? { 
              ...m, 
              status: 'completed', 
              completedAt: new Date(),
              evidence: milestone.evidence || prompt('Evidence of completion:'),
              completedBy: currentUser?.uid
            }
          : m
      );

      await updateDoc(doc(db, 'projects', project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date()
      });

      setMilestones(updatedMilestones);
      alert('✅ Milestone marked as completed! Invoice will be created.');

      // Auto-generate invoice for completed milestone
      const invoiceData = {
        projectId: project.id,
        projectTitle: project.title,
        milestoneId: milestone.id,
        milestoneName: milestone.title,
        freelancerId: currentUser?.uid,
        freelancerName: currentUser?.displayName || currentUser?.email,
        freelancerEmail: currentUser?.email,
        clientId: project.clientId,
        clientName: project.clientName,
        clientEmail: project.clientEmail,
        invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        issueDate: new Date(),
        dueDate: milestone.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: 'RM',
        lineItems: [{
          description: `${milestone.title} - ${milestone.description || 'Milestone payment'}`,
          quantity: 1,
          rate: milestone.amount,
          amount: milestone.amount
        }],
        subtotal: milestone.amount,
        taxRate: 0,
        taxAmount: 0,
        totalAmount: milestone.amount,
        status: 'pending',
        paymentTerms: 'Net 30',
        notes: `Invoice for milestone: ${milestone.title} (${milestone.percentage}% of project)`,
        terms: 'Payment is due by the specified due date.',
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'milestone',
        autoGenerated: true
      };

      await addDoc(collection(db, 'invoices'), invoiceData);
      console.log(`✅ Created invoice for milestone: ${milestone.title}`);

      onUpdate?.();
    } catch (error) {
      console.error('Error completing milestone:', error);
      alert('Failed to complete milestone');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      percentage: 0,
      amount: 0,
      dueDate: '',
      status: 'pending'
    });
    setShowAddForm(false);
    setEditingMilestone(null);
  };

  const startEdit = (milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      title: milestone.title,
      description: milestone.description || '',
      percentage: milestone.percentage,
      amount: milestone.amount,
      dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString().split('T')[0] : '',
      status: milestone.status
    });
    setShowAddForm(true);
  };

  const handleClientApproveMilestone = async (milestone) => {
    try {
      const updatedMilestones = milestones.map(m => 
        m.id === milestone.id 
          ? { ...m, clientApproved: true, clientApprovedAt: new Date() }
          : m
      );
      
      await updateDoc(doc(db, 'projects', project.id), {
        milestones: updatedMilestones,
        updatedAt: new Date()
      });
      
      setMilestones(updatedMilestones);
      alert('✅ Milestone approved by client!');
      onUpdate?.();
    } catch (error) {
      console.error('Error approving milestone:', error);
      alert('Failed to approve milestone');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'invoiced': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-purple-100 text-purple-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'client_approval_pending': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'invoiced':
      case 'paid':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const totalPercentage = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
  const totalAmount = milestones.reduce((sum, m) => sum + (m.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Project Milestones</h3>
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
            <strong>Contract Signed:</strong> Milestones are now locked as per the signed contract. 
            You can only update progress and mark milestones as complete.
          </div>
        </div>
      )}

      {/* Summary */}
      {milestones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Milestones</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{milestones.length}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <DollarSign className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Total Amount</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">RM{totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Total Coverage</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{totalPercentage}%</p>
          </div>
        </div>
      )}

      {/* Warning if total > 100% */}
      {totalPercentage > 100 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-sm text-red-800">
              Warning: Total milestone percentage ({totalPercentage}%) exceeds 100%. Please adjust milestone percentages.
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {editingMilestone ? 'Edit Milestone' : 'Add New Milestone'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Design Phase Complete"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Percentage *</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (RM) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4">
            <button
              onClick={editingMilestone ? handleEditMilestone : handleAddMilestone}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {editingMilestone ? 'Update' : 'Add'} Milestone
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
          <p className="text-gray-600 mb-2">No milestones defined in the contract</p>
          <p className="text-sm text-gray-500">Milestones are created automatically from the signed contract</p>
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
                    <h4 className="text-md font-semibold text-gray-900">{milestone.title}</h4>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                      {getStatusIcon(milestone.status)}
                      <span className="ml-1">{milestone.status}</span>
                    </span>
                  </div>
                  {milestone.description && (
                    <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
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
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {milestone.status === 'pending' && (
                    <button
                      onClick={() => handleCompleteMilestone(milestone)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      title="Mark as Complete"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                  {milestone.status === 'invoiced' && milestone.invoiceId && (
                    <span className="text-xs text-blue-600">
                      Invoice: {milestone.invoiceId.slice(-6)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MilestoneManager;
