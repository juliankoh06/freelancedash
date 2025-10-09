import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase-config';
import { CreditCard, FileText, Calendar, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import MockPaymentModal from '../components/MockPaymentModal';
import mockPaymentService from '../services/mockPaymentService';

const ClientPayments = ({ user }) => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPaidInvoices, setShowPaidInvoices] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'client') {
      navigate('/login');
      return;
    }
    fetchInvoices();
  }, [user]);

  const fetchInvoices = async () => {
    try {
      if (!user || !user.email) {
        console.error('No user email found');
        setInvoices([]);
        setLoading(false);
        return;
      }

      // Fetch invoices for the client
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('clientEmail', '==', user.email)
      );
      
      const invoicesSnapshot = await getDocs(invoicesQuery);
      const invoicesData = invoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Store all invoices
      setAllInvoices(invoicesData);
      
      // Filter out paid invoices and sort by status priority
      const filteredInvoices = invoicesData
        .filter(invoice => invoice.status !== 'paid') // Hide paid invoices by default
        .sort((a, b) => {
          // Sort by status priority: overdue > sent > others
          const statusPriority = { 'overdue': 1, 'sent': 2, 'pending': 3 };
          const aPriority = statusPriority[a.status] || 4;
          const bPriority = statusPriority[b.status] || 4;
          return aPriority - bPriority;
        });
      
      setInvoices(filteredInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4" />;
      case 'sent':
        return <FileText className="w-4 h-4" />;
      case 'overdue':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const handlePayment = (invoice) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const togglePaidInvoices = () => {
    setShowPaidInvoices(!showPaidInvoices);
    if (!showPaidInvoices) {
      // Show all invoices including paid ones
      const allInvoicesSorted = allInvoices.sort((a, b) => {
        const statusPriority = { 'overdue': 1, 'sent': 2, 'pending': 3, 'paid': 4 };
        const aPriority = statusPriority[a.status] || 5;
        const bPriority = statusPriority[b.status] || 5;
        return aPriority - bPriority;
      });
      setInvoices(allInvoicesSorted);
    } else {
      // Hide paid invoices again
      const filteredInvoices = allInvoices
        .filter(invoice => invoice.status !== 'paid')
        .sort((a, b) => {
          const statusPriority = { 'overdue': 1, 'sent': 2, 'pending': 3 };
          const aPriority = statusPriority[a.status] || 4;
          const bPriority = statusPriority[b.status] || 4;
          return aPriority - bPriority;
        });
      setInvoices(filteredInvoices);
    }
  };

  const handlePaymentSuccess = async (paymentData) => {
    try {
      // Validate that we have the selected invoice
      if (!selectedInvoice || !selectedInvoice.id) {
        console.error('No selected invoice found for payment processing');
        alert('Payment failed: No invoice selected');
        setShowPaymentModal(false);
        setSelectedInvoice(null);
        return;
      }

      // Process payment through mock payment service
      const result = await mockPaymentService.processPayment({
        amount: selectedInvoice.totalAmount,
        currency: selectedInvoice.currency,
        paymentMethod: paymentData.paymentMethod,
        paymentDetails: paymentData.paymentDetails,
        paymentId: `mock_${Date.now()}`,
        reference: `REF_${Date.now()}`,
        paidAt: new Date()
      }, selectedInvoice);

      if (result.success) {
        // Refresh invoices
        await fetchInvoices();
        setShowPaymentModal(false);
        setSelectedInvoice(null);
        alert('Payment processed successfully! Transaction created. Please refresh the Transactions page to see the new transaction.');
      } else {
        alert('Payment failed: ' + result.error);
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      alert('Payment processing failed: ' + error.message);
    }
  };

  const formatCurrency = (amount, currency = 'RM') => {
    return `${currency} ${amount?.toFixed(2) || '0.00'}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date.seconds ? date.seconds * 1000 : date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Make Payment</h1>
            <p className="text-gray-600">Select an invoice to make a payment</p>
          </div>
          <button
            onClick={togglePaidInvoices}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {showPaidInvoices ? 'Hide Paid Invoices' : 'Show Paid Invoices'}
          </button>
        </div>
      </div>
      
      {invoices.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <div className="text-gray-500 text-lg">No invoices found</div>
          <p className="text-gray-400 mt-2">Invoices will appear here once you have projects with pending payments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="bg-white shadow rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {invoice.projectTitle || 'Untitled Project'}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        <span className="ml-1">{invoice.status || 'sent'}</span>
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4" />
                        <span>Invoice #{invoice.invoiceNumber}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {formatDate(invoice.dueDate)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold text-lg text-gray-900">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="ml-6 flex-shrink-0">
                    {invoice.status === 'paid' ? (
                      <div className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Paid
                      </div>
                    ) : (invoice.status === 'sent' || invoice.status === 'overdue') ? (
                      <button
                        onClick={() => handlePayment(invoice)}
                        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                          invoice.status === 'overdue' 
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        {invoice.status === 'overdue' ? 'Pay Overdue' : 'Pay Now'}
                      </button>
                    ) : (
                      <div className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-500 bg-gray-50 rounded-md">
                        <FileText className="w-4 h-4 mr-2" />
                        {invoice.status || 'sent'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <MockPaymentModal
          isOpen={showPaymentModal}
          invoiceData={selectedInvoice}
          onPaymentSuccess={handlePaymentSuccess}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
};

export default ClientPayments;
