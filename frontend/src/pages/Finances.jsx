import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase-config';

const Finances = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState({
    totalEarnings: 0,
    monthlyEarnings: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    averagePaymentTime: 0,
    topClients: [],
    paymentMethods: {},
    monthlyTrend: [],
    recentTransactions: [],
    projectEarnings: []
  });

  useEffect(() => {
    if (user && user.role === 'freelancer') {
      fetchFinancialData();
    }
  }, [user]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      
      // Fetch invoices
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('freelancerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch transactions
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('freelancerId', '==', user.uid),
        orderBy('createdAt', 'desc')
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
      const totalEarnings = invoices
        .filter(invoice => invoice.status === 'paid')
        .reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);

      const monthlyEarnings = invoices
        .filter(invoice => {
          if (invoice.status !== 'paid' || !invoice.paidAt) return false;
          const paidDate = invoice.paidAt.toDate ? invoice.paidAt.toDate() : new Date(invoice.paidAt);
          const now = new Date();
          return paidDate.getMonth() === now.getMonth() && 
                 paidDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);

      const pendingAmount = invoices
        .filter(invoice => invoice.status === 'sent')
        .reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);

      const overdueAmount = invoices
        .filter(invoice => invoice.status === 'overdue')
        .reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);

      // Calculate average payment time
      const paidInvoices = invoices.filter(invoice => 
        invoice.status === 'paid' && invoice.createdAt && invoice.paidAt
      );
      const averagePaymentTime = paidInvoices.length > 0 
        ? paidInvoices.reduce((sum, invoice) => {
            const created = invoice.createdAt.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
            const paid = invoice.paidAt.toDate ? invoice.paidAt.toDate() : new Date(invoice.paidAt);
            return sum + (paid - created) / (1000 * 60 * 60 * 24); // days
          }, 0) / paidInvoices.length
        : 0;

      // Top clients by earnings
      const clientEarnings = {};
      invoices
        .filter(invoice => invoice.status === 'paid')
        .forEach(invoice => {
          const clientId = invoice.clientId;
          if (!clientEarnings[clientId]) {
            clientEarnings[clientId] = {
              clientId,
              clientEmail: invoice.clientEmail,
              totalEarnings: 0,
              projectCount: 0
            };
          }
          clientEarnings[clientId].totalEarnings += invoice.totalAmount || 0;
          clientEarnings[clientId].projectCount += 1;
        });

      const topClients = Object.values(clientEarnings)
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, 5);

      // Payment methods analysis
      const paymentMethods = {};
      transactions
        .filter(transaction => transaction.status === 'paid')
        .forEach(transaction => {
          const method = transaction.paymentMethod || 'Unknown';
          if (!paymentMethods[method]) {
            paymentMethods[method] = { count: 0, amount: 0 };
          }
          paymentMethods[method].count += 1;
          paymentMethods[method].amount += transaction.amount || 0;
        });

      // Monthly trend (last 6 months)
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const monthEarnings = invoices
          .filter(invoice => {
            if (invoice.status !== 'paid' || !invoice.paidAt) return false;
            const paidDate = invoice.paidAt.toDate ? invoice.paidAt.toDate() : new Date(invoice.paidAt);
            return paidDate.getMonth() === date.getMonth() && 
                   paidDate.getFullYear() === date.getFullYear();
          })
          .reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);

        monthlyTrend.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          earnings: monthEarnings
        });
      }

      // Recent transactions
      const recentTransactions = transactions
        .filter(transaction => transaction.status === 'paid')
        .slice(0, 10);

      // Project earnings
      const projectEarnings = projects.map(project => {
        const projectInvoices = invoices.filter(invoice => invoice.projectId === project.id);
        const projectTotal = projectInvoices
          .filter(invoice => invoice.status === 'paid')
          .reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
        
        return {
          projectId: project.id,
          projectTitle: project.title,
          clientEmail: project.clientEmail,
          totalEarnings: projectTotal,
          invoiceCount: projectInvoices.length,
          status: project.status
        };
      }).sort((a, b) => b.totalEarnings - a.totalEarnings);

      setFinancialData({
        totalEarnings,
        monthlyEarnings,
        pendingAmount,
        overdueAmount,
        averagePaymentTime: Math.round(averagePaymentTime),
        topClients,
        paymentMethods,
        monthlyTrend,
        recentTransactions,
        projectEarnings
      });

    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Earnings Trend</h3>
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
                    <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                    <p className="text-xs text-gray-500">{transaction.paymentMethod}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">RM{transaction.amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">
                    {transaction.paidAt ? 
                      (transaction.paidAt.toDate ? transaction.paidAt.toDate() : new Date(transaction.paidAt))
                        .toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project Earnings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Earnings</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoices</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earnings</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {financialData.projectEarnings.map((project) => (
                <tr key={project.projectId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {project.projectTitle}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {project.clientEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      project.status === 'completed' ? 'bg-green-100 text-green-800' :
                      project.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {project.invoiceCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    RM{project.totalEarnings.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Insights */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{financialData.averagePaymentTime}</div>
            <p className="text-sm text-gray-600">Average Payment Time (days)</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {financialData.totalEarnings > 0 ? 
                Math.round((financialData.monthlyEarnings / financialData.totalEarnings) * 100) : 0}%
            </div>
            <p className="text-sm text-gray-600">This Month's Share</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{financialData.topClients.length}</div>
            <p className="text-sm text-gray-600">Active Clients</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Finances;
