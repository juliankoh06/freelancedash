import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  FileText, 
  CheckCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase-config';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({
    projects: { total: 0, active: 0, completed: 0, pending: 0 },
    invoices: { total: 0, paid: 0, pending: 0, overdue: 0 },
    earnings: { total: 0, thisMonth: 0, lastMonth: 0 }
  });

  const [chartData, setChartData] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      if (!user || !user.uid) {
        console.error('No current user found');
        return;
      }

      // Fetch projects filtered by user ID
      const projectsQuery = query(
        collection(db, 'projects'),
        where('freelancerId', '==', user.uid)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch tasks filtered by user ID
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', user.uid)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch invoices filtered by user ID
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('freelancerId', '==', user.uid)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(invoices); // Store invoices for display

      // Fetch transactions filtered by user ID (for consistent earnings calculation)
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('freelancerId', '==', user.uid)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Calculate project stats
      const projectStats = {
        total: projects.length,
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        pending: projects.filter(p => p.status === 'pending').length
      };

      // Calculate invoice stats
      const invoiceStats = {
        total: invoices.length,
        paid: invoices.filter(i => i.status === 'paid').length,
        pending: invoices.filter(i => i.status === 'sent').length, // Fixed: sent invoices are pending payment
        overdue: invoices.filter(i => i.status === 'overdue').length
      };

      // Helper function for transaction amounts (consistent with Finances page)
      const getTransactionAmount = (transaction) => {
        return transaction.amount || transaction.total || 0;
      };

      // Calculate earnings from TRANSACTIONS (consistent with Finances page)
      const paidTransactions = transactions.filter(transaction => transaction.status === 'paid');
      const totalEarnings = paidTransactions.reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);

      const thisMonth = new Date();
      const thisMonthEarnings = paidTransactions
        .filter(transaction => {
          if (!transaction.createdAt) return false;
          const transactionDate = transaction.createdAt.toDate ? 
            transaction.createdAt.toDate() : new Date(transaction.createdAt);
          return transactionDate.getMonth() === thisMonth.getMonth() && 
                 transactionDate.getFullYear() === thisMonth.getFullYear();
        })
        .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthEarnings = paidTransactions
        .filter(transaction => {
          if (!transaction.createdAt) return false;
          const transactionDate = transaction.createdAt.toDate ? 
            transaction.createdAt.toDate() : new Date(transaction.createdAt);
          return transactionDate.getMonth() === lastMonth.getMonth() && 
                 transactionDate.getFullYear() === lastMonth.getFullYear();
        })
        .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);

      const finalStats = {
        projects: projectStats,
        invoices: invoiceStats,
        earnings: { total: totalEarnings, thisMonth: thisMonthEarnings, lastMonth: lastMonthEarnings }
      };
      
      setStats(finalStats);


      // Calculate chart data for last 12 months with better formatting
      const currentDate = new Date();
      const chartDataCalculated = [];
      
      // Generate last 12 months
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
        const year = monthDate.getFullYear();
        
        const monthEarnings = paidTransactions
          .filter(transaction => {
            if (!transaction.createdAt) return false;
            const transactionDate = transaction.createdAt.toDate ? 
              transaction.createdAt.toDate() : new Date(transaction.createdAt);
            return transactionDate.getMonth() === monthDate.getMonth() && 
                   transactionDate.getFullYear() === monthDate.getFullYear();
          })
          .reduce((sum, transaction) => sum + getTransactionAmount(transaction), 0);
        
        chartDataCalculated.push({ 
          month: monthName, 
          year: year,
          earnings: monthEarnings,
          fullDate: monthDate.toISOString().split('T')[0]
        });
      }
      
      setChartData(chartDataCalculated);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };


  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="mb-8">
        <p className="text-gray-600">Welcome back! Here's what's happening with your freelance business.</p>
      </div>

        {/* Stats Cards */}
        <div className="dashboard-stats mb-8">
          <div className="bg-white rounded-lg shadow p-4 dashboard-stat-card">
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-green-100 rounded-lg mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.projects.active}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 dashboard-stat-card">
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-yellow-100 rounded-lg mb-3">
                <FileText className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Pending Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{stats.invoices.pending}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 dashboard-stat-card">
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-purple-100 rounded-lg mb-3">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">This Month</p>
              <p className="text-2xl font-bold text-gray-900">${stats.earnings.thisMonth.toLocaleString()}</p>
            </div>
          </div>
        </div>


        {/* Financial Overview */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Overview</h3>
          
          {stats.earnings.total > 0 ? (
            // Show enhanced chart if there's earnings data
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Monthly Earnings</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Total: <span className="font-semibold text-gray-900">${stats.earnings.total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Last 12 months
                </div>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      `$${value.toLocaleString()}`, 
                      'Earnings'
                    ]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return `${payload[0].payload.month} ${payload[0].payload.year}`;
                      }
                      return label;
                    }}
                  />
                  <Bar 
                    dataKey="earnings" 
                    fill="url(#earningsGradient)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            // Show engaging empty state if no earnings data
            <div className="text-center py-16">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="w-10 h-10 text-purple-500" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-xs">💡</span>
                </div>
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Ready to Track Your Earnings?</h4>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Create your first project, send invoices to clients, and watch your earnings grow over time.
              </p>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600 mb-1">{stats.projects.total}</div>
                  <div className="text-sm font-medium text-blue-800">Active Projects</div>
                  <div className="text-xs text-blue-600 mt-1">Keep them moving!</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                  <div className="text-3xl font-bold text-green-600 mb-1">{stats.invoices.total}</div>
                  <div className="text-sm font-medium text-green-800">Total Invoices</div>
                  <div className="text-xs text-green-600 mt-1">Track your billing</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-600 mb-1">{stats.invoices.pending}</div>
                  <div className="text-sm font-medium text-yellow-800">Awaiting Payment</div>
                  <div className="text-xs text-yellow-600 mt-1">Follow up needed</div>
                </div>
              </div>
              
              {/* Call to Action */}
              <div className="mt-8">
                <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
                  <span>💼</span>
                  <span>Start by creating a project or sending your first invoice</span>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};

export default Dashboard;
