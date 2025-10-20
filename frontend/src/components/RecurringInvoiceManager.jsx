import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Play, Pause, Calendar, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase-config';
import { RecurringInvoice, RECURRING_FREQUENCIES } from '../models/RecurringInvoice';

const RecurringInvoiceManager = ({ project, currentUser, onUpdate }) => {
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    frequency: 'monthly',
    amount: 0,
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    paymentTerms: 'Net 30',
    notes: ''
  });

  useEffect(() => {
    fetchRecurringInvoices();
  }, [project.id]);

  const fetchRecurringInvoices = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'recurring_invoices'),
        where('projectId', '==', project.id)
      );
      const snapshot = await getDocs(q);
      const invoices = snapshot.docs.map(doc => RecurringInvoice.fromFirebase(doc));
      setRecurringInvoices(invoices);
    } catch (error) {
      console.error('Error fetching recurring invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecurring = async () => {
    try {
      const recurringInvoice = new RecurringInvoice({
        projectId: project.id,
        projectTitle: project.title,
        clientId: project.clientId,
        clientEmail: project.clientEmail,
        freelancerId: currentUser?.uid,
        freelancerName: currentUser?.displayName || 'Freelancer',
        frequency: formData.frequency,
        amount: parseFloat(formData.amount),
        currency: 'RM',
        description: formData.description,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        nextInvoiceDate: new Date(formData.startDate),
        isActive: true,
        invoiceTemplate: {
          paymentTerms: formData.paymentTerms,
          notes: formData.notes,
          terms: 'Payment is due within 30 days of invoice date.',
          lineItems: [
            {
              description: formData.description || `${formData.frequency} service for ${project.title}`,
              quantity: 1,
              rate: parseFloat(formData.amount),
              amount: parseFloat(formData.amount)
            }
          ]
        }
      });

      const validation = recurringInvoice.validate();
      if (!validation.isValid) {
        alert(`Validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      await addDoc(collection(db, 'recurring_invoices'), recurringInvoice.toFirebase());
      await fetchRecurringInvoices();
      resetForm();
      alert('✅ Recurring invoice created successfully!');
      onUpdate?.();
    } catch (error) {
      console.error('Error creating recurring invoice:', error);
      alert('Failed to create recurring invoice');
    }
  };

  const handleEditRecurring = async () => {
    try {
      const updates = {
        frequency: formData.frequency,
        amount: parseFloat(formData.amount),
        description: formData.description,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        invoiceTemplate: {
          paymentTerms: formData.paymentTerms,
          notes: formData.notes,
          terms: 'Payment is due within 30 days of invoice date.',
          lineItems: [
            {
              description: formData.description,
              quantity: 1,
              rate: parseFloat(formData.amount),
              amount: parseFloat(formData.amount)
            }
          ]
        },
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'recurring_invoices', editingRecurring.id), updates);
      await fetchRecurringInvoices();
      resetForm();
      alert('✅ Recurring invoice updated successfully!');
      onUpdate?.();
    } catch (error) {
      console.error('Error updating recurring invoice:', error);
      alert('Failed to update recurring invoice');
    }
  };

  const handleToggleActive = async (recurring) => {
    try {
      await updateDoc(doc(db, 'recurring_invoices', recurring.id), {
        isActive: !recurring.isActive,
        updatedAt: new Date()
      });
      await fetchRecurringInvoices();
      onUpdate?.();
    } catch (error) {
      console.error('Error toggling recurring invoice:', error);
      alert('Failed to toggle recurring invoice');
    }
  };

  const handleTogglePause = async (recurring) => {
    try {
      await updateDoc(doc(db, 'recurring_invoices', recurring.id), {
        isPaused: !recurring.isPaused,
        updatedAt: new Date()
      });
      await fetchRecurringInvoices();
      onUpdate?.();
    } catch (error) {
      console.error('Error pausing recurring invoice:', error);
      alert('Failed to pause recurring invoice');
    }
  };

  const handleDelete = async (recurringId) => {
    if (!window.confirm('Are you sure you want to delete this recurring invoice? This action cannot be undone.')) return;

    try {
      await deleteDoc(doc(db, 'recurring_invoices', recurringId));
      await fetchRecurringInvoices();
      alert('✅ Recurring invoice deleted successfully!');
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting recurring invoice:', error);
      alert('Failed to delete recurring invoice');
    }
  };

  const resetForm = () => {
    setFormData({
      frequency: 'monthly',
      amount: 0,
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      paymentTerms: 'Net 30',
      notes: ''
    });
    setShowAddForm(false);
    setEditingRecurring(null);
  };

  const startEdit = (recurring) => {
    setEditingRecurring(recurring);
    setFormData({
      frequency: recurring.frequency,
      amount: recurring.amount,
      description: recurring.description,
      startDate: new Date(recurring.startDate).toISOString().split('T')[0],
      endDate: recurring.endDate ? new Date(recurring.endDate).toISOString().split('T')[0] : '',
      paymentTerms: recurring.invoiceTemplate?.paymentTerms || 'Net 30',
      notes: recurring.invoiceTemplate?.notes || ''
    });
    setShowAddForm(true);
  };

  const getStatusColor = (recurring) => {
    if (!recurring.isActive) return 'bg-gray-100 text-gray-800';
    if (recurring.isPaused) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recurring Invoices</h3>
          <p className="text-sm text-gray-600">Set up automatic recurring billing</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Recurring Invoice
        </button>
      </div>


      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {editingRecurring ? 'Edit Recurring Invoice' : 'Add Recurring Invoice'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (RM) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Monthly retainer for ongoing support"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.startDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite billing</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <select
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 45">Net 45</option>
                <option value="Due on Receipt">Due on Receipt</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes for the invoice..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4">
            <button
              onClick={editingRecurring ? handleEditRecurring : handleAddRecurring}
              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
            >
              {editingRecurring ? 'Update' : 'Create'} Recurring Invoice
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

      {/* Recurring Invoices List */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading recurring invoices...</p>
        </div>
      ) : recurringInvoices.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No recurring invoices set up yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Recurring Invoice
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {recurringInvoices.map((recurring) => (
            <div
              key={recurring.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-md font-semibold text-gray-900">{recurring.description}</h4>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(recurring)}`}>
                      {recurring.getStatusText()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <RefreshCw className="w-4 h-4 mr-1" />
                      {recurring.getFrequencyLabel()}
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 mr-1" />
                      RM{recurring.amount.toFixed(2)}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      Next: {new Date(recurring.nextInvoiceDate).toLocaleDateString()}
                    </div>
                    <div>
                      Invoices: {recurring.totalInvoicesGenerated}
                    </div>
                  </div>
                  {recurring.endDate && (
                    <p className="text-xs text-gray-500 mt-2">
                      Ends: {new Date(recurring.endDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {recurring.isActive && (
                    <button
                      onClick={() => handleTogglePause(recurring)}
                      className={`p-2 rounded-md transition-colors ${
                        recurring.isPaused
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-yellow-600 hover:bg-yellow-50'
                      }`}
                      title={recurring.isPaused ? 'Resume' : 'Pause'}
                    >
                      {recurring.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(recurring)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(recurring.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringInvoiceManager;
