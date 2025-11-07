import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Save, DollarSign, Calendar, FileText, AlertCircle } from 'lucide-react';

const InvoicePreviewModal = ({ invoiceData, onConfirm, onCancel, readOnly = false }) => {
  const [editableData, setEditableData] = useState(invoiceData);
  const [errors, setErrors] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setEditableData(invoiceData);
  }, [invoiceData]);

  // Recalculate totals whenever line items change
  useEffect(() => {
    calculateTotals();
  }, [editableData.lineItems, editableData.taxRate]);

  const calculateTotals = () => {
    const subtotal = editableData.lineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
    }, 0);

    const taxAmount = subtotal * (editableData.taxRate || 0.06);
    const totalAmount = subtotal + taxAmount;

    setEditableData(prev => ({
      ...prev,
      subtotal,
      taxAmount,
      totalAmount
    }));
  };

  const handleLineItemChange = (index, field, value) => {
    const updatedLineItems = [...editableData.lineItems];
    updatedLineItems[index] = {
      ...updatedLineItems[index],
      [field]: value
    };

    // Recalculate amount for this line item
    if (field === 'quantity' || field === 'rate') {
      const quantity = parseFloat(updatedLineItems[index].quantity) || 0;
      const rate = parseFloat(updatedLineItems[index].rate) || 0;
      updatedLineItems[index].amount = quantity * rate;
    }

    setEditableData(prev => ({
      ...prev,
      lineItems: updatedLineItems
    }));
  };

  const addLineItem = () => {
    setEditableData(prev => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          description: '',
          quantity: 1,
          rate: 0,
          amount: 0
        }
      ]
    }));
    setIsEditing(true);
  };

  const removeLineItem = (index) => {
    if (editableData.lineItems.length <= 1) {
      alert('Invoice must have at least one line item');
      return;
    }

    setEditableData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index)
    }));
  };

  const validateInvoice = () => {
    const validationErrors = [];

    if (!editableData.clientEmail) {
      validationErrors.push('Client email is required');
    }

    if (!editableData.dueDate) {
      validationErrors.push('Due date is required');
    }

    if (editableData.lineItems.length === 0) {
      validationErrors.push('At least one line item is required');
    }

    editableData.lineItems.forEach((item, index) => {
      if (!item.description || item.description.trim() === '') {
        validationErrors.push(`Line item ${index + 1}: Description is required`);
      }
      if (item.quantity === '' || item.quantity === null || item.quantity === undefined || parseFloat(item.quantity) < 0) {
        validationErrors.push(`Line item ${index + 1}: Quantity cannot be negative`);
      }
      if (item.rate === '' || item.rate === null || item.rate === undefined || parseFloat(item.rate) < 0) {
        validationErrors.push(`Line item ${index + 1}: Rate cannot be negative`);
      }
    });

    if (editableData.totalAmount < 0) {
      validationErrors.push('Total amount cannot be negative');
    }

    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleConfirm = () => {
    if (validateInvoice()) {
      onConfirm(editableData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Invoice Preview</h2>
            <p className="text-sm text-gray-600 mt-1">{readOnly ? 'Review invoice details' : 'Review and edit invoice details before sending'}</p>
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
          {/* Invoice Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
              <input
                type="text"
                value={editableData.invoiceNumber || 'Auto-generated'}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
              <input
                type="date"
                value={editableData.issueDate ? (() => {
                  const date = editableData.issueDate.seconds ? editableData.issueDate.toDate() : new Date(editableData.issueDate);
                  return date.toISOString().split('T')[0];
                })() : ''}
                onChange={(e) => setEditableData(prev => ({ ...prev, issueDate: new Date(e.target.value) }))}
                disabled={readOnly}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md ${readOnly ? 'bg-gray-50 text-gray-600' : 'focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input
                type="date"
                value={editableData.dueDate ? (() => {
                  const date = editableData.dueDate.seconds ? editableData.dueDate.toDate() : new Date(editableData.dueDate);
                  return date.toISOString().split('T')[0];
                })() : ''}
                onChange={(e) => setEditableData(prev => ({ ...prev, dueDate: new Date(e.target.value) }))}
                disabled={readOnly}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md ${readOnly ? 'bg-gray-50 text-gray-600' : 'focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
              />
            </div>
          </div>

          {/* Client & Freelancer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">From (Freelancer)</h3>
              <p className="text-sm text-gray-700">{editableData.freelancerName || 'Freelancer'}</p>
              <p className="text-sm text-gray-600">{editableData.freelancerEmail || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">To (Client) *</h3>
              {readOnly ? (
                <>
                  <p className="text-sm text-gray-700">{editableData.clientName || 'Client'}</p>
                  <p className="text-sm text-gray-600">{editableData.clientEmail || 'N/A'}</p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Client Name"
                    value={editableData.clientName || ''}
                    onChange={(e) => setEditableData(prev => ({ ...prev, clientName: e.target.value }))}
                    className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Client Email *"
                    value={editableData.clientEmail || ''}
                    onChange={(e) => setEditableData(prev => ({ ...prev, clientEmail: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    required
                  />
                </>
              )}
            </div>
          </div>

          {/* Project Info - Optional */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Project (Optional)</h3>
            {readOnly ? (
              <p className="text-sm text-blue-700">{editableData.projectTitle || 'No project linked'}</p>
            ) : (
              <input
                type="text"
                placeholder="Project Title (Optional)"
                value={editableData.projectTitle || ''}
                onChange={(e) => setEditableData(prev => ({ ...prev, projectTitle: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              />
            )}
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
              {!readOnly && (
                <button
                  onClick={addLineItem}
                  className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </button>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase w-24">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase w-32">Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase w-32">Amount</th>
                    {!readOnly && <th className="px-4 py-3 w-16"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {editableData.lineItems.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {readOnly ? (
                          <span className="text-sm text-gray-900">{item.description}</span>
                        ) : (
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                            placeholder="Item description"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {readOnly ? (
                          <span className="text-sm text-gray-900">{item.quantity}</span>
                        ) : (
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {readOnly ? (
                          <span className="text-sm text-gray-900">{editableData.currency || 'RM'}{item.rate}</span>
                        ) : (
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => handleLineItemChange(index, 'rate', e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {editableData.currency || 'RM'}{(item.amount || 0).toFixed(2)}
                        </span>
                      </td>
                      {!readOnly && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeLineItem(index)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            disabled={editableData.lineItems.length <= 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="space-y-3 max-w-md ml-auto">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Subtotal:</span>
                <span className="text-sm font-medium text-gray-900">
                  {editableData.currency || 'RM'}{(editableData.subtotal || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">
                  Tax ({((editableData.taxRate || 0.06) * 100).toFixed(1)}%):
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {editableData.currency || 'RM'}{(editableData.taxAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                <span className="text-lg font-semibold text-gray-900">Total:</span>
                <span className="text-lg font-bold text-gray-900">
                  {editableData.currency || 'RM'}{(editableData.totalAmount || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
            {readOnly ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900">
                {editableData.paymentTerms}
              </div>
            ) : (
              <select
                value={editableData.paymentTerms}
                onChange={(e) => setEditableData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 45">Net 45</option>
                <option value="Net 60">Net 60</option>
                <option value="Due on Receipt">Due on Receipt</option>
              </select>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={editableData.notes || ''}
              onChange={(e) => setEditableData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Additional notes or comments..."
              disabled={readOnly}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md ${readOnly ? 'bg-gray-50 text-gray-900' : 'focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
            />
          </div>

          {/* Terms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
            <textarea
              value={editableData.terms || ''}
              onChange={(e) => setEditableData(prev => ({ ...prev, terms: e.target.value }))}
              rows={2}
              placeholder="Payment terms and conditions..."
              disabled={readOnly}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md ${readOnly ? 'bg-gray-50 text-gray-900' : 'focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <div className="flex items-center space-x-3">
              <button
                onClick={handleConfirm}
                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                <FileText className="w-4 h-4 mr-2" />
                Confirm & Send Invoice
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;
