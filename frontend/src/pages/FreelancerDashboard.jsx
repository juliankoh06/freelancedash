import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FolderOpen, FileText, Users, DollarSign } from 'lucide-react';

const FreelancerDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    pendingInvoices: 0,
    monthlyEarnings: 0
  });

  useEffect(() => {
    if (!user || user.role !== 'freelancer') {
      navigate('/login');
      return;
    }
    fetchFreelancerStats();
  }, []);

  const fetchFreelancerStats = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/freelancer/stats?freelancerId=${user.id}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const features = [
    {
      name: 'Project Tracking',
      description: 'Manage and track your ongoing projects',
      icon: FolderOpen,
      href: '/project-tracking',
      color: 'bg-blue-500'
    },
    {
      name: 'Invoices',
      description: 'Create and manage invoices',
      icon: FileText,
      href: '/invoices',
      color: 'bg-green-500'
    },
    {
      name: 'Clients',
      description: 'View and manage your clients',
      icon: Users,
      href: '/clients',
      color: 'bg-purple-500'
    },
    {
      name: 'Finances',
      description: 'Track your earnings and payments',
      icon: DollarSign,
      href: '/finances',
      color: 'bg-yellow-500'
    }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Freelancer Dashboard</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Total Projects</h3>
          <p className="text-2xl font-semibold">{stats.totalProjects}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Active Projects</h3>
          <p className="text-2xl font-semibold">{stats.activeProjects}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Pending Invoices</h3>
          <p className="text-2xl font-semibold">{stats.pendingInvoices}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Monthly Earnings</h3>
          <p className="text-2xl font-semibold">${stats.monthlyEarnings}</p>
        </div>
      </div>

      {/* Quick Access Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.name}
              to={feature.href}
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className={`${feature.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                <Icon className="text-white w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">{feature.name}</h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default FreelancerDashboard;