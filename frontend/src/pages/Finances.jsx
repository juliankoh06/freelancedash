import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  Clock,
  CheckCircle,
  AlertCircle,
  Briefcase,
  Target,
  TrendingDown
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase-config';

const Finances = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState(6); // default to 6 months
  const [financialData, setFinancialData] = useState({
    totalEarnings: 0,
    monthlyEarnings: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    topClients: [],
    paymentMethods: {},
    monthlyTrend: [],
    recentTransactions: [],
  invoiceStats: { pending: 0, paid: 0, overdue: 0, total: 0 },
  });


  useEffect(() => {
    if (user && user.role === 'freelancer') {
      fetchFinancialData();
    }
  }, [user, selectedMonths]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      
      // Helper function for transaction amounts
      const getTransactionAmount = (transaction) => {
        return transaction.amount || transaction.total || 0;
      };
      
      // Fetch invoices 
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('freelancerId', '==', user.uid)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch transactions
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('freelancerId', '==', user.uid)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch projects for project earnings
      const projectsQuery = query(
        collection(db, 'projects'),
        where('freelancerId', '==', user.uid)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate financial metrics
      const paidTransactions = transactions.filter(transaction => transaction.status === 'paid');
      const pendingTransactions = transactions.filter(transaction => transaction.status === 'pending');
      const overdueTransactions = transactions.filter(transaction => transaction.status === 'overdue');
      
      // getTransactionAmount is already defined at the top of the function
      
      const totalEarnings = paidTransactions.reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);
      
      const monthlyEarnings = paidTransactions
        .filter(transaction => {
          if (!transaction.createdAt) return false;
          const transactionDate = transaction.createdAt.toDate ? 
            transaction.createdAt.toDate() : new Date(transaction.createdAt);
          const now = new Date();
          return transactionDate.getMonth() === now.getMonth() && 
                 transactionDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);

      const pendingAmount = pendingTransactions.reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);
      const overdueAmount = overdueTransactions.reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);
        

      // Calculate average payment time
      // (Removed) Calculate average payment time

      // Top clients by earnings (from transactions)
      const clientEarnings = {};
      paidTransactions.forEach(transaction => {
        const clientId = transaction.clientEmail || transaction.clientId;
        if (!clientEarnings[clientId]) {
          clientEarnings[clientId] = {
            clientId,
            clientEmail: transaction.clientEmail,
            totalEarnings: 0,
            projectCount: 0
          };
        }
        clientEarnings[clientId].totalEarnings += getTransactionAmount(transaction);
        clientEarnings[clientId].projectCount += 1;
      });

      const topClients = Object.values(clientEarnings)
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, 5);

      // Payment methods analysis (from transactions)
      const paymentMethods = {};
      paidTransactions.forEach(transaction => {
        const method = transaction.paymentMethod || 'Unknown';
        if (!paymentMethods[method]) {
          paymentMethods[method] = { count: 0, amount: 0 };
        }
        paymentMethods[method].count += 1;
        paymentMethods[method].amount += getTransactionAmount(transaction);
      });

      // Monthly trend (user selectable)
      const monthlyTrend = [];
      for (let i = selectedMonths - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthEarnings = paidTransactions
          .filter(transaction => {
            if (!transaction.createdAt) return false;
            const transactionDate = transaction.createdAt.toDate ? 
              transaction.createdAt.toDate() : new Date(transaction.createdAt);
            return transactionDate.getMonth() === date.getMonth() && 
                   transactionDate.getFullYear() === date.getFullYear();
          })
          .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);
        monthlyTrend.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          earnings: monthEarnings
        });
      }

      // Recent transactions: sort by createdAt descending to get latest
      const recentTransactions = paidTransactions
        .slice() 
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA;
        })
        .slice(0, 10);

      // Invoice status breakdown (only those displayed)
      const invoiceStats = {
        pending: invoices.filter(inv => inv.status === 'sent').length, // Fixed: 'sent' invoices are pending payment
        paid: invoices.filter(inv => inv.status === 'paid').length,
        overdue: invoices.filter(inv => inv.status === 'overdue').length,
        total: invoices.length
      };


      
      setFinancialData({
        totalEarnings,
        monthlyEarnings,
        pendingAmount,
        overdueAmount,
        topClients,
        paymentMethods,
        monthlyTrend,
        recentTransactions,
        invoiceStats
      });

    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };


  // Helper function for transaction amounts (available in render scope)
  const getTransactionAmount = (transaction) => {
    return transaction.amount || transaction.total || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Financial Dashboard</h2>
            <p className="text-gray-600">Track your earnings, payments, and financial insights</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Last updated</p>
            <p className="text-sm font-medium">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900">RM{financialData.totalEarnings.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">RM{financialData.monthlyEarnings.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">RM{financialData.pendingAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">RM{financialData.overdueAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Earnings Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Earnings Trend</h3>
            <div className="flex items-center">
              <label htmlFor="monthRange" className="mr-2 text-sm font-medium text-gray-700">Show:</label>
              <select
                id="monthRange"
                value={selectedMonths}
                onChange={e => setSelectedMonths(Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
                <option value={24}>Last 24 months</option>
              </select>
            </div>
          </div>
          <div className="h-64 flex items-end space-x-2">
            {financialData.monthlyTrend.map((month, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="bg-blue-500 rounded-t w-full mb-2"
                  style={{ 
                    height: `${Math.max(20, (month.earnings / Math.max(...financialData.monthlyTrend.map(m => m.earnings), 1)) * 200)}px` 
                  }}
                ></div>
                <p className="text-xs text-gray-600">{month.month}</p>
                <p className="text-xs font-medium">RM{month.earnings.toFixed(0)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h3>
          <div className="space-y-3">
            {Object.entries(financialData.paymentMethods).map(([method, data]) => (
              <div key={method} className="flex items-center justify-between">
                <div className="flex items-center">
                  <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 capitalize">{method}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">RM{data.amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{data.count} payments</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Clients</h3>
          <div className="space-y-3">
            {financialData.topClients.map((client, index) => (
              <div key={client.clientId} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-semibold text-gray-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{client.clientEmail}</p>
                    <p className="text-xs text-gray-500">{client.projectCount} projects</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900">RM{client.totalEarnings.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {financialData.recentTransactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{transaction.description || 'Payment'}</p>
                    <p className="text-xs text-gray-500">{transaction.paymentMethod}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">RM{getTransactionAmount(transaction).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">
                    {transaction.createdAt ? 
                      (transaction.createdAt.toDate ? transaction.createdAt.toDate() : new Date(transaction.createdAt))
                        .toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Finances;
