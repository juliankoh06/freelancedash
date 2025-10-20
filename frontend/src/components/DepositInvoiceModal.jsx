import React, { useState } from 'react';
import { X, DollarSign, Calendar, AlertCircle, FileText } from 'lucide-react';
import { Invoice, INVOICE_TYPES, INVOICE_STATUSES } from '../models/Invoice';

const DepositInvoiceModal = ({ project, onConfirm, onCancel, currentUser }) => {
  const [depositPercentage, setDepositPercentage] = useState(30);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState([]);

  const calculateDepositAmount = () => {
    const projectTotal = project.budget || project.hourlyRate * (project.estimatedHours || 0);
    return projectTotal * (depositPercentage / 100);
  };

  const handleSubmit = () => {
    const validationErrors = [];
    
    if (!depositPercentage || depositPercentage <= 0 || depositPercentage > 100) {
      validationErrors.push('Deposit percentage must be between 1 and 100');
    }
    
    if (!dueDate) {
      validationErrors.push('Due date is required');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const depositAmount = calculateDepositAmount();
    const subtotal = depositAmount;
    const taxAmount = subtotal * 0.06;
    const totalAmount = subtotal + taxAmount;

    const invoiceData = {
      invoiceType: INVOICE_TYPES.DEPOSIT,
      projectId: project.id,
      projectTitle: project.title,
      clientId: project.clientId || null, // Allow null if not set
      clientEmail: project.clientEmail,
      clientName: project.clientName || project.clientEmail || 'Client',
      freelancerId: currentUser?.uid,
      freelancerName: currentUser?.displayName || 'Freelancer',
      freelancerEmail: currentUser?.email || '',
      issueDate: new Date(),
      dueDate: new Date(dueDate),
      status: INVOICE_STATUSES.DRAFT,
      depositPercentage: depositPercentage,
      subtotal: subtotal,
      taxRate: 0.06,
      taxAmount: taxAmount,
      totalAmount: totalAmount,
      currency: 'RM',
      lineItems: [
        {
          description: `${depositPercentage}% Deposit for Project: ${project.title}`,
          quantity: 1,
          rate: depositAmount,
          amount: depositAmount
        }
      ],
      paymentTerms: 'Due on Receipt',
      notes: notes || `${depositPercentage}% deposit required before work begins. Remaining balance will be invoiced upon project completion.`,
      terms: 'This deposit is non-refundable once work has commenced. Payment is due within 7 days of invoice date.'
    };

    onConfirm(invoiceData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Request Deposit Invoice</h2>
            <p className="text-sm text-gray-600 mt-1">Request upfront payment before starting work</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-red-900 mb-2">Please fix the following errors:</h3>
                <ul className="text-sm text-red-700 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Project Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Project Details</h3>
            <p className="text-sm text-blue-700"><strong>Title:</strong> {project.title}</p>
            <p className="text-sm text-blue-700"><strong>Client:</strong> {project.clientEmail}</p>
            <p className="text-sm text-blue-700">
              <strong>Estimated Total:</strong> RM{(project.budget || project.hourlyRate * (project.estimatedHours || 0)).toFixed(2)}
            </p>
          </div>

          {/* Deposit Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deposit Percentage *
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={depositPercentage}
                onChange={(e) => setDepositPercentage(parseInt(e.target.value))}
                className="flex-1"
              />
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={depositPercentage}
                  onChange={(e) => setDepositPercentage(parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <span className="text-gray-700 font-medium">%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Common deposit amounts: 25%, 30%, 50%
            </p>
          </div>

          {/* Calculated Amount */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-purple-900">Deposit Amount:</span>
              <span className="text-lg font-bold text-purple-900">
                RM{calculateDepositAmount().toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-purple-700">Tax (6% GST):</span>
              <span className="text-sm font-medium text-purple-700">
                RM{(calculateDepositAmount() * 0.06).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-purple-200">
              <span className="text-base font-semibold text-purple-900">Total Due:</span>
              <span className="text-xl font-bold text-purple-900">
                RM{(calculateDepositAmount() * 1.06).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Due Date *
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Typically 7 days from invoice date
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any special terms or conditions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
          >
            <FileText className="w-4 h-4 mr-2" />
            Create Deposit Invoice
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepositInvoiceModal;
