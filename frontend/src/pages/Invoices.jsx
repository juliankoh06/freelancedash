import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Download, 
  Edit, 
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Send,
  DollarSign,
  Bell,
  Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import invoiceService from '../services/invoiceService';
import contractService from '../services/contractService';
import { downloadInvoicePDF } from '../utils/pdfGenerator';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import ReminderSettingsModal from '../components/ReminderSettingsModal';

const Invoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [newInvoiceData, setNewInvoiceData] = useState(null);
  // const [projects, setProjects] = useState([]);
  // const [selectedProjectForInvoice, setSelectedProjectForInvoice] = useState(null);
  // const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [invoiceContracts, setInvoiceContracts] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, statusFilter]);

  // Fetch contract information for invoices with projects
  useEffect(() => {
    const fetchContractsForInvoices = async () => {
      const contractPromises = invoices
        .filter(invoice => invoice.projectId)
        .map(async (invoice) => {
          try {
            const result = await contractService.getContractByProject(invoice.projectId);
            if (result.success && result.contract) {
              return { invoiceId: invoice.id, contract: result.contract };
            }
          } catch (error) {
            console.error(`Error fetching contract for project ${invoice.projectId}:`, error);
          }
          return null;
        });

      const results = await Promise.all(contractPromises);
      const contractsMap = {};
      results.forEach(result => {
        if (result) {
          contractsMap[result.invoiceId] = result.contract;
        }
      });
      setInvoiceContracts(contractsMap);
    };

    if (invoices.length > 0) {
      fetchContractsForInvoices();
    }
  }, [invoices]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setInvoices([]);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'invoices'),
      where('freelancerId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(invoicesData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching invoices:', error);
      setInvoices([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const filterInvoices = () => {
    let filtered = invoices;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.projectTitle?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'sent': return 'text-blue-600 bg-blue-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const calculateTotalAmount = (invoices) => {
    return invoices
      .filter(invoice => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
  };

  const calculatePendingAmount = (invoices) => {
    return invoices
      .filter(invoice => invoice.status === 'sent')
      .reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
  };

  const handleDownloadInvoice = (invoice) => {
    try {
      downloadInvoicePDF(invoice);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Failed to download invoice PDF');
    }
  };

  const handleDownloadContract = async (invoice) => {
    try {
      const contract = invoiceContracts[invoice.id];
      
      if (!contract || !contract.signedContractPdfUrl) {
        alert('No signed contract available for this invoice');
        return;
      }

      window.open(contract.signedContractPdfUrl, '_blank');
    } catch (error) {
      console.error('Error downloading contract:', error);
      alert('Failed to download contract: ' + error.message);
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
  await invoiceService.deleteInvoice(invoiceId);
  alert('Invoice deleted successfully');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice');
    }
  };

  const handleSendInvoice = async (invoice) => {
    if (!window.confirm(`Send invoice ${invoice.invoiceNumber} to ${invoice.clientEmail}?`)) return;
    
    try {
      const result = await invoiceService.sendInvoice(invoice.id);
      if (result.success) {
        alert('✅ Invoice sent successfully!');
      } else {
        throw new Error(result.error || 'Failed to send invoice');
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice: ' + error.message);
    }
  };

  const handleMarkAsPaid = async (invoiceId) => {
    if (!window.confirm('Mark this invoice as paid?')) return;
    
    try {
  await invoiceService.markInvoiceAsPaid(invoiceId);
  alert('✅ Invoice marked as paid!');
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      alert('Failed to mark invoice as paid');
    }
  };

  // Project selector logic removed

  const handleCreateInvoice = () => {
    // Create blank invoice data without project link
    const invoiceData = {
      projectId: null,
      projectTitle: '',
      clientId: null,
      clientName: '',
      clientEmail: '',
      freelancerId: currentUser?.uid,
      freelancerName: currentUser?.displayName || currentUser?.email,
      freelancerEmail: currentUser?.email,
      invoiceNumber: `INV-${Date.now()}`,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      currency: 'RM',
      lineItems: [
        {
          description: '',
          quantity: 1,
          rate: 0,
          amount: 0
        }
      ],
      subtotal: 0,
      taxRate: 0.06,
      taxAmount: 0,
      totalAmount: 0,
      paymentTerms: 'Net 30',
      notes: '',
      terms: 'Payment is due within 30 days of invoice date.',
      status: 'sent'
    };
    
    setNewInvoiceData(invoiceData);
    setShowCreateInvoice(true);
  };

  const getInvoiceTypeColor = (invoiceType) => {
    switch (invoiceType) {
      case 'deposit': return 'bg-purple-100 text-purple-800';
      case 'milestone': return 'bg-blue-100 text-blue-800';
      case 'final': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };


  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">All Invoices</h1>
        <p className="text-teal-100">
          View and manage all your invoices across all projects in one place. Track payments, send invoices, and monitor your revenue.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Paid Amount</p>
              <p className="text-2xl font-bold text-gray-900">RM{calculateTotalAmount(invoices).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Amount</p>
              <p className="text-2xl font-bold text-gray-900">RM{calculatePendingAmount(invoices).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoices, clients, or projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">All Invoices</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>

          <button 
            onClick={() => setShowReminderSettings(true)}
            className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            title="Configure automatic payment reminders"
          >
            <Bell className="w-4 h-4 mr-2" />
            Reminder Settings
          </button>

          <button 
            onClick={handleCreateInvoice}
            className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="space-y-3">
                      <p className="text-gray-500">No invoices found. Create your first invoice to get started.</p>
                      <button 
                        onClick={handleCreateInvoice}
                        className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Invoice
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          {invoice.invoiceNumber || `INV-${invoice.id.slice(-4)}`}
                          {invoice.invoiceType && invoice.invoiceType !== 'standard' && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getInvoiceTypeColor(invoice.invoiceType)}`}>
                              {invoice.getTypeLabel?.() || invoice.invoiceType}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {invoice.issueDate ? new Date(invoice.issueDate.seconds ? invoice.issueDate.toDate() : invoice.issueDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        {invoice.projectTitle || (invoice.projectId ? 'N/A' : 
                          <span className="text-gray-500 italic">Custom Invoice</span>
                        )}
                        {!invoice.projectId && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            No Project
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.clientName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.currency}{(invoice.totalAmount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        <span className="ml-1">{invoice.getStatusText?.() || invoice.status || 'sent'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {invoice.dueDate ? new Date(invoice.dueDate.seconds ? invoice.dueDate.toDate() : invoice.dueDate).toLocaleDateString() : 'N/A'}
                        {invoice.paidDate && (
                          <div className="text-xs text-gray-500">
                            Paid: {new Date(invoice.paidDate.seconds ? invoice.paidDate.toDate() : invoice.paidDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {invoice.status === 'sent' && (
                          <button 
                            onClick={() => handleMarkAsPaid(invoice.id)}
                            className="text-green-600 hover:text-green-800"
                            title="Mark as Paid"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDownloadInvoice(invoice)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Download Invoice PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {(() => {
                          const contract = invoiceContracts[invoice.id];
                          if (!contract) return null;
                          
                          const hasPdfUrl = contract?.signedContractPdfUrl;
                          const freelancerSigned = contract?.freelancerSigned ?? contract?.freelancerSignedAt;
                          const clientSigned = contract?.clientSigned ?? contract?.clientSignedAt;
                          const bothSigned = !!(freelancerSigned && clientSigned);
                          
                          // If both signed but no PDF, show a message
                          if (bothSigned && !hasPdfUrl) {
                            return (
                              <button 
                                className="text-gray-400 cursor-not-allowed"
                                title="Contract PDF is being generated..."
                                disabled
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            );
                          }
                          
                          // If PDF exists, show download button
                          if (hasPdfUrl) {
                            return (
                              <button 
                                onClick={() => handleDownloadContract(invoice)}
                                className="text-teal-600 hover:text-teal-800"
                                title="Download Signed Contract PDF"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            );
                          }
                          
                          // Not fully signed yet
                          return null;
                        })()}
                        {/* Delete button removed to prevent invoice deletion by any user */}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Create Invoice Modal */}
      {showCreateInvoice && newInvoiceData && (
        <InvoicePreviewModal
          invoiceData={newInvoiceData}
          onConfirm={async (editedData) => {
            try {
              const result = await invoiceService.createInvoice({
                ...editedData,
                status: 'sent',
                createdAt: new Date(),
                updatedAt: new Date()
              });

              if (result.success) {
                alert('✅ Invoice created and sent successfully!');
                setShowCreateInvoice(false);
                setNewInvoiceData(null);
              } else {
                throw new Error(result.error || 'Failed to create invoice');
              }
            } catch (error) {
              console.error('Error creating invoice:', error);
              alert('Failed to create invoice: ' + error.message);
            }
          }}
          onCancel={() => {
            setShowCreateInvoice(false);
            setNewInvoiceData(null);
          }}
        />
      )}

      {/* Reminder Settings Modal */}
      {showReminderSettings && currentUser && (
        <ReminderSettingsModal
          currentUser={currentUser}
          onClose={() => setShowReminderSettings(false)}
          onSave={() => {
            console.log('Reminder settings saved!');
          }}
        />
      )}
    </div>
  );
};

export default Invoices;