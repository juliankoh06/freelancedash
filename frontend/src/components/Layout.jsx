import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  FolderOpen, 
  FileText, 
  Users, 
  DollarSign,
  Settings,
  LogOut,
  Search,
  Bell,
  User
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase-config';

const Layout = ({ children, user }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Project Tracking', href: '/project-tracking', icon: FolderOpen },
    { name: 'Transactions', href: '/transactions', icon: FileText },
    { name: 'Invoice', href: '/invoices', icon: FileText },
    { name: 'Finances', href: '/finances', icon: DollarSign },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const getPageTitle = () => {
    const currentNav = navigation.find(nav => nav.href === location.pathname);
    return currentNav ? currentNav.name : 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-gray-50 layout-container">
      {/* Sidebar */}
      <div 
        className="bg-teal-600 flex flex-col sidebar mr-4"
        style={{ 
          width: isSidebarOpen ? '256px' : '64px',
          transition: 'width 0.3s ease'
        }}
      >
        {/* Logo */}
        <div className="p-6 pb-8">
          <h1 className={`text-white font-bold text-2xl ${!isSidebarOpen && 'hidden'}`}>
            FREELANCEDASH
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 pt-4">
          <ul className="space-y-3">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-teal-800 text-white'
                        : 'text-teal-100 hover:bg-teal-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {isSidebarOpen && <span className="ml-3">{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 pt-6">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-teal-100 hover:bg-teal-700 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content ml-4">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="header-container">
              <div className="header-title">
                <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
              </div>
              
              <div className="header-right space-x-4">
                {/* Search - Hide on Dashboard */}
                {location.pathname !== '/dashboard' && location.pathname !== '/' && (
                  <div className="relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Notifications - Hide on Dashboard */}
                {location.pathname !== '/dashboard' && location.pathname !== '/' && (
                  <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
                  </button>
                )}

                {/* User Menu - Always show */}
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {user?.displayName || user?.email || 'User Name'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
