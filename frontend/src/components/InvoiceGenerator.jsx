import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase-config';
import InvoicePDFGenerator from '../utils/pdfGenerator';
import { Download, Send, Eye, Clock, DollarSign } from 'lucide-react';

const InvoiceGenerator = ({ projectId, onClose }) => {
  const [project, setProject] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      
      // Fetch project details
      const projectQuery = query(
        collection(db, 'projects'),
        where('__name__', '==', projectId)
      );
      const projectSnapshot = await getDocs(projectQuery);
      const projectData = projectSnapshot.docs[0]?.data();
      
      if (projectData) {
        setProject({ id: projectId, ...projectData });
        
        // Generate invoice number
        const invoiceNumber = `INV-${Date.now()}`;
        setInvoiceData(prev => ({ ...prev, invoiceNumber }));
        
        // Fetch time entries for this project
        await fetchTimeEntries(projectId);
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeEntries = async (projectId) => {
    try {
      // Fetch tasks for this project
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Convert tasks to time entries
      const entries = tasks
        .filter(task => task.timeSpent > 0)
        .map(task => ({
          id: task.id,
          description: task.title,
          taskTitle: task.title,
          hours: task.timeSpent || 0,
          date: task.updatedAt?.toDate() || new Date(),
          status: task.status
        }));

      setTimeEntries(entries);
    } catch (error) {
      console.error('Error fetching time entries:', error);
    }
  };

  const calculateTotals = () => {
    const subtotal = timeEntries.reduce((sum, entry) => 
      sum + (entry.hours * (project?.hourlyRate || 0)), 0);
    const tax = subtotal * 0.1; // 10% tax - can be made configurable
    const total = subtotal + tax;

    return { subtotal, tax, total };
  };

  const generatePDF = () => {
    if (!project || timeEntries.length === 0) {
      alert('No time entries found for this project');
      return;
    }

    const generator = new InvoicePDFGenerator();
    const totals = calculateTotals();
    
    const pdfData = {
      invoiceNumber: invoiceData.invoiceNumber,
      date: new Date(invoiceData.date),
      dueDate: new Date(invoiceData.dueDate),
      freelancerInfo: {
        name: project.freelancerName || 'Freelancer',
        email: project.freelancerEmail || '',
        phone: project.freelancerPhone || '',
        address: project.freelancerAddress || ''
      },
      clientInfo: {
        name: project.clientName || 'Client',
        email: project.clientEmail || '',
        phone: project.clientPhone || '',
        address: project.clientAddress || ''
      },
      items: timeEntries.map(entry => ({
        description: entry.description,
        quantity: entry.hours,
        rate: project.hourlyRate || 0,
        amount: entry.hours * (project.hourlyRate || 0)
      })),
      ...totals,
      notes: invoiceData.notes
    };

    generator.generateInvoice(pdfData);
    generator.saveInvoice(`invoice-${invoiceData.invoiceNumber}.pdf`);
  };

  const saveInvoice = async () => {
    try {
      setLoading(true);
      const totals = calculateTotals();
      
      const invoiceRecord = {
        invoiceNumber: invoiceData.invoiceNumber,
        projectId: projectId,
        freelancerId: project.freelancerId,
        clientId: project.clientId,
        clientEmail: project.clientEmail,
        date: new Date(invoiceData.date),
        dueDate: new Date(invoiceData.dueDate),
        status: 'pending',
        items: timeEntries.map(entry => ({
          description: entry.description,
          hours: entry.hours,
          rate: project.hourlyRate || 0,
          amount: entry.hours * (project.hourlyRate || 0)
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        notes: invoiceData.notes,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'invoices'), invoiceRecord);
      alert('Invoice saved successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  const sendInvoice = async () => {
    // This would integrate with email service
    alert('Email sending functionality will be implemented in the next phase');
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-center">Loading project data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Generate Invoice</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {project && (
            <div className="space-y-6">
              {/* Project Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Project: {project.title}</h3>
                <p className="text-sm text-gray-600">Hourly Rate: RM{project.hourlyRate || 0}</p>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceData.invoiceNumber}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={invoiceData.date}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invoiceData.dueDate}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                  />
                </div>
              </div>

              {/* Time Entries */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Time Entries ({timeEntries.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-left">Hours</th>
                        <th className="px-4 py-2 text-left">Rate</th>
                        <th className="px-4 py-2 text-left">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeEntries.map((entry, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-2">{entry.description}</td>
                          <td className="px-4 py-2">{entry.hours.toFixed(2)}</td>
                          <td className="px-4 py-2">RM{(project.hourlyRate || 0).toFixed(2)}</td>
                          <td className="px-4 py-2">RM{(entry.hours * (project.hourlyRate || 0)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span>Subtotal:</span>
                  <span>RM{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span>Tax (10%):</span>
                  <span>RM{totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>RM{totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={invoiceData.notes}
                  onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2 border rounded-md h-20"
                  placeholder="Additional notes for the invoice..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={generatePDF}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </button>
                <button
                  onClick={saveInvoice}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Save Invoice
                </button>
                <button
                  onClick={sendInvoice}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceGenerator;
