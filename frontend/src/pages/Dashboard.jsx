import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  FileText, 
  Users,
  CheckCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase-config';
import { onAuthStateChanged } from 'firebase/auth';

const Dashboard = () => {
  const [stats, setStats] = useState({
    projects: { total: 0, active: 0, completed: 0, pending: 0 },
    invoices: { total: 0, paid: 0, pending: 0, overdue: 0 },
    earnings: { total: 0, thisMonth: 0, lastMonth: 0 }
  });

  const [chartData, setChartData] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchDashboardData();
      }
    });
    return unsubscribe;
  }, []);

  const fetchDashboardData = async () => {
    try {
      if (!currentUser || !currentUser.uid) {
        console.error('No current user found');
        return;
      }

      // Fetch projects filtered by user ID
      const projectsQuery = query(
        collection(db, 'projects'),
        where('freelancerId', '==', currentUser.uid)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch tasks filtered by user ID
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', currentUser.uid)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch invoices filtered by user ID
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('freelancerId', '==', currentUser.uid)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
        pending: invoices.filter(i => i.status === 'pending').length,
        overdue: invoices.filter(i => i.status === 'overdue').length
      };

      // Calculate earnings
      const totalEarnings = invoices
        .filter(i => i.status === 'paid')
        .reduce((sum, invoice) => sum + (invoice.amount || 0), 0);

      const thisMonth = new Date();
      const thisMonthEarnings = invoices
        .filter(i => {
          if (i.status !== 'paid' || !i.paidAt) return false;
          const paidDate = i.paidAt.toDate ? i.paidAt.toDate() : new Date(i.paidAt);
          return paidDate.getMonth() === thisMonth.getMonth() && 
                 paidDate.getFullYear() === thisMonth.getFullYear();
        })
        .reduce((sum, invoice) => sum + (invoice.amount || 0), 0);

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthEarnings = invoices
        .filter(i => {
          if (i.status !== 'paid' || !i.paidAt) return false;
          const paidDate = i.paidAt.toDate ? i.paidAt.toDate() : new Date(i.paidAt);
          return paidDate.getMonth() === lastMonth.getMonth() && 
                 paidDate.getFullYear() === lastMonth.getFullYear();
        })
        .reduce((sum, invoice) => sum + (invoice.amount || 0), 0);

      setStats({
        projects: projectStats,
        invoices: invoiceStats,
        earnings: { total: totalEarnings, thisMonth: thisMonthEarnings, lastMonth: lastMonthEarnings }
      });


      // Calculate chart data for last 6 months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      const currentDate = new Date();
      const chartDataCalculated = months.map((month, index) => {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1);
        const monthEarnings = invoices
          .filter(i => {
            if (i.status !== 'paid' || !i.paidAt) return false;
            const paidDate = i.paidAt.toDate ? i.paidAt.toDate() : new Date(i.paidAt);
            return paidDate.getMonth() === monthDate.getMonth() && 
                   paidDate.getFullYear() === monthDate.getFullYear();
          })
          .reduce((sum, invoice) => sum + (invoice.amount || 0), 0);
        
        return { month, earnings: monthEarnings };
      });
      
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
              <div className="p-3 bg-blue-100 rounded-lg mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.projects.total}</p>
            </div>
          </div>

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

        {/* Earnings Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="earnings" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
    </div>
  );
};

export default Dashboard;
