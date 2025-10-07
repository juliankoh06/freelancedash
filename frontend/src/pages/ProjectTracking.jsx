import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye, Play, Pause, Clock, TrendingUp, CheckCircle, AlertCircle, FileText, MessageCircle, Download, Calendar, DollarSign, ArrowLeft, Send, CreditCard, Receipt, Square, StopCircle, XCircle, RefreshCw } from 'lucide-react';
import { collection, query, getDocs, addDoc, doc, deleteDoc, updateDoc, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import transactionService from '../services/transactionService';
import invoiceService from '../services/invoiceService';
import { Transaction, TRANSACTION_TYPES, TRANSACTION_STATUSES } from '../models/Transaction';
import { Invoice, INVOICE_STATUSES } from '../models/Invoice';
import { downloadInvoicePDF } from '../utils/pdfGenerator';
import { useIdleDetection } from '../hooks/useIdleDetection';
import IdleWarningModal from '../components/IdleWarningModal';
import enhancedTimeTrackingService from '../services/enhancedTimeTrackingService';
import emailScheduler from '../services/emailScheduler';
import invitationService from '../services/invitationService';

const ProjectTracking = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');
  const [selectedProject, setSelectedProject] = useState(null);
  const [trackingProject, setTrackingProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [progressTab, setProgressTab] = useState('overview');
  const [newComment, setNewComment] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [transactionFormData, setTransactionFormData] = useState({
    type: TRANSACTION_TYPES.PAYMENT,
    amount: '',
    description: '',
    dueDate: '',
    paymentMethod: '',
    notes: ''
  });
  const [invoiceFormData, setInvoiceFormData] = useState({
    dueDate: '',
    paymentTerms: 'Net 30',
    notes: '',
    terms: 'Payment is due within 30 days of invoice date.'
  });
  const [formMode, setFormMode] = useState('add');
  const [projectTasks, setProjectTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    estimatedHours: ''
  });
  const [trackingStates, setTrackingStates] = useState({});
  const [trackingTimes, setTrackingTimes] = useState({});
  const [activeSessions, setActiveSessions] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    priority: 'medium',
    startDate: '',
    dueDate: '',
    hourlyRate: '',
    clientEmail: ''
  });
  const [revisionRequests, setRevisionRequests] = useState([]);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [emailSchedulerStatus, setEmailSchedulerStatus] = useState(false);

  // Idle detection hook
  const { isIdle, idleWarning, timeUntilIdle, resetTimer } = useIdleDetection(
    300000, // 5 minutes
    () => handleIdleDetected(),
    () => handleActivityDetected()
  );

  useEffect(() => {
    console.log('ProjectTracking useEffect triggered');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', {
        user: user ? { uid: user.uid, email: user.email } : null,
        timestamp: new Date().toISOString()
      });
      setCurrentUser(user);
      if (user) {
        console.log('User authenticated, fetching projects for UID:', user.uid);
        fetchProjects(user.uid);
        fetchRevisionRequests(user.uid);
      } else {
        console.log('No user authenticated, clearing projects');
        setProjects([]);
        setFilteredProjects([]);
        setRevisionRequests([]);
      }
    });
    return unsubscribe;
  }, []);


  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm, priorityFilter, statusFilter, showCompleted]);

  useEffect(() => {
    if (selectedProject && formMode === 'view') {
      fetchProjectTasks(selectedProject.id);
    }
  }, [selectedProject, formMode]);

  // Load tasks when tracking a project
  useEffect(() => {
    if (trackingProject) {
      fetchProjectTasks(trackingProject.id);
    }
  }, [trackingProject]);

  const fetchProjects = async (userId = null) => {
    try {
      const uid = userId || currentUser?.uid;
      console.log('fetchProjects called with:', {
        userId,
        currentUserUid: currentUser?.uid,
        finalUid: uid,
        timestamp: new Date().toISOString()
      });
      
      if (!uid) {
        console.error('No user ID found for fetching projects');
        setProjects([]);
        setFilteredProjects([]);
        return;
      }

      console.log('Querying projects for freelancerId:', uid);
      // Fetch projects filtered by user ID
      const projectsQuery = query(
        collection(db, 'projects'),
        where('freelancerId', '==', uid)
      );
      
      console.log('Executing Firebase query...');
      const projectsSnapshot = await getDocs(projectsQuery);
      
      console.log('Query result:', {
        empty: projectsSnapshot.empty,
        size: projectsSnapshot.size,
        docs: projectsSnapshot.docs.length
      });
      
      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Fetched projects successfully:', projectsData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      setProjects([]);
      setFilteredProjects([]);
    }
  };

  const fetchRevisionRequests = async (userId = null) => {
    try {
      const uid = userId || currentUser?.uid;
      if (!uid) return;

      const q = query(
        collection(db, 'project_comments'),
        where('freelancerId', '==', uid),
        where('type', '==', 'client_revision_request'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const revisionData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Revision requests fetched:', revisionData.length);
      setRevisionRequests(revisionData);
    } catch (error) {
      console.error('Error fetching revision requests:', error);
    }
  };

  const filterProjects = () => {
    console.log('filterProjects called:', {
      searchTerm,
      priorityFilter,
      statusFilter,
      showCompleted,
      projectsCount: projects.length,
      projects: projects.map(p => ({ id: p.id, title: p.title, status: p.status }))
    });
    
    let filtered = projects;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filter by priority
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(project => project.priority === priorityFilter);
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter);
    }
    
    // Filter by completion status
    if (!showCompleted) {
      filtered = filtered.filter(project => project.status !== 'completed');
    }
    
    console.log('Filtered projects:', {
      searchTerm,
      priorityFilter,
      statusFilter,
      showCompleted,
      originalCount: projects.length,
      filteredCount: filtered.length,
      filtered: filtered.map(p => ({ id: p.id, title: p.title, status: p.status }))
    });
    
    setFilteredProjects(filtered);
  };

  // Function to get project status display
  const getProjectStatus = (project) => {
    if (!project.status) return { text: 'Active', color: 'bg-blue-100 text-blue-800' };
    
    switch (project.status) {
      case 'completed':
        return { text: 'Completed', color: 'bg-green-100 text-green-800' };
      case 'pending_approval':
        return { text: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' };
      case 'in_progress':
        return { text: 'In Progress', color: 'bg-blue-100 text-blue-800' };
      case 'on_hold':
        return { text: 'On Hold', color: 'bg-gray-100 text-gray-800' };
      case 'cancelled':
        return { text: 'Cancelled', color: 'bg-red-100 text-red-800' };
      default:
        return { text: 'Active', color: 'bg-blue-100 text-blue-800' };
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.title || !formData.startDate || !formData.dueDate || !formData.hourlyRate) {
        alert('Please fill in all required fields');
        setLoading(false);
        return;
      }

      if (!currentUser || !currentUser.uid) {
        alert('User not found. Please log in again.');
        setLoading(false);
        return;
      }

      const projectData = {
        ...formData,
        freelancerId: currentUser.uid, // Add the user ID to associate project with user
        status: 'active', // Set default status
        createdAt: new Date(),
        updatedAt: new Date()
      };
      console.log('Creating project with data:', projectData);
      const docRef = await addDoc(collection(db, 'projects'), projectData);
      console.log('Project created with ID:', docRef.id);
      
      // Generate invitation if client email is provided
      if (formData.clientEmail) {
        // Prevent freelancer from inviting themselves
        if (formData.clientEmail.toLowerCase() === currentUser.email.toLowerCase()) {
          alert('You cannot invite yourself as a client. Please use a different email address.');
          return;
        }
        
        try {
          const invitationResult = await invitationService.createInvitation(
            docRef.id,
            currentUser.uid,
            formData.clientEmail
          );
          
          if (invitationResult.success) {
            // Send invitation email
            await invitationService.sendInvitationEmail(
              formData.clientEmail,
              invitationResult.data.invitationLink,
              formData.title,
              currentUser.displayName || currentUser.email,
              currentUser.email
            );
            
            alert(`Project created! Invitation sent to ${formData.clientEmail}`);
          } else {
            console.warn('Failed to create invitation:', invitationResult.error);
            alert('✅ Project created, but invitation could not be sent. You can invite the client manually later.');
          }
        } catch (invitationError) {
          console.error('Error creating invitation:', invitationError);
          alert('✅ Project created, but invitation could not be sent. You can invite the client manually later.');
        }
      }
      
      await fetchProjects();
      setActiveTab('projects');
      setFormData({
        title: '',
        priority: 'medium',
        startDate: '',
        dueDate: '',
        hourlyRate: '',
        clientEmail: ''
      });
    } catch (error) {
      console.error('Error adding project:', error);
      alert('Failed to add project: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditProject = async (e) => {
    e.preventDefault();
    try {
      if (!formData.title || !formData.startDate || !formData.dueDate || !formData.hourlyRate) {
        alert('Please fill in all required fields');
        return;
      }
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        ...formData,
        updatedAt: new Date()
      });
      await fetchProjects();
      setActiveTab('projects');
      setSelectedProject(null);
      setFormData({
        title: '',
        priority: 'medium',
        startDate: '',
        dueDate: '',
        hourlyRate: '',
        clientEmail: ''
      });
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project: ' + error.message);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
        await fetchProjects();
      } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project: ' + error.message);
      }
    }
  };

  const handleViewProject = (project) => {
    setSelectedProject(project);
    setFormData(project);
    setFormMode('view');
    setActiveTab('form');
  };

  const handleEditClick = (project) => {
    setSelectedProject(project);
    setFormData(project);
    setFormMode('edit');
    setActiveTab('form');
  };

  const handleTrackProgress = async (project) => {
    console.log('🔍 Track Progress button clicked');
    console.log('🔍 Project data:', project);
    console.log('🔍 Project ID:', project.id);
    
    setTrackingProject(project);
    setProjectDetails(project);
    setLoadingDetails(true);
    
    try {
      // Fetch detailed project data
      await fetchProjectDetails(project.id);
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchProjectDetails = async (projectId) => {
    try {
      console.log('🔍 Fetching project details for ID:', projectId);
      
      // Fetch project tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTasks(tasksData);
      console.log('✅ Tasks fetched:', tasksData.length);

      // Fetch progress updates
      const progressQuery = query(
        collection(db, 'progress_updates'),
        where('projectId', '==', projectId),
        orderBy('updatedAt', 'desc')
      );
      const progressSnapshot = await getDocs(progressQuery);
      const progressData = progressSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProgressUpdates(progressData);
      console.log('✅ Progress updates fetched:', progressData.length);

      // Calculate time entries from tasks
      const timeEntriesData = tasksData
        .filter(task => task.timeSpent > 0)
        .map(task => ({
          id: task.id,
          taskTitle: task.title,
          hours: task.timeSpent,
          date: task.updatedAt?.toDate() || new Date(),
          status: task.status
        }));
      setTimeEntries(timeEntriesData);
      console.log('✅ Time entries calculated:', timeEntriesData.length);

      // Fetch project transactions
      await fetchProjectTransactions(projectId);

      // Fetch project invoices
      await fetchProjectInvoices(projectId);

    } catch (error) {
      console.error('Error fetching project details:', error);
    }
  };

  const calculateProjectStats = () => {
    if (!trackingProject) return {};
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
    const totalHours = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
    const estimatedHours = tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
    const currentCost = totalHours * (trackingProject.hourlyRate || 0);
    const estimatedCost = estimatedHours * (trackingProject.hourlyRate || 0);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      totalHours,
      estimatedHours,
      currentCost,
      estimatedCost,
      completionPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !trackingProject) return;

    try {
      const commentData = {
        projectId: trackingProject.id,
        freelancerId: trackingProject.freelancerId,
        clientEmail: trackingProject.clientEmail,
        comment: newComment.trim(),
        type: 'freelancer_comment',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'project_comments'), commentData);
      setNewComment('');
      alert('Comment sent successfully!');
    } catch (error) {
      console.error('Error sending comment:', error);
      alert('Failed to send comment. Please try again.');
    }
  };

  // Transaction Management Functions
  const fetchProjectTransactions = async (projectId) => {
    try {
      console.log('🔍 Fetching transactions for project:', projectId);
      const result = await transactionService.getProjectTransactions(projectId);
      if (result.success) {
        setTransactions(result.transactions);
        console.log('✅ Project transactions loaded:', result.transactions.length);
      }
    } catch (error) {
      console.error('❌ Error fetching project transactions:', error);
      setTransactions([]);
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    if (!trackingProject) return;

    try {
      const transactionData = {
        ...transactionFormData,
        projectId: trackingProject.id,
        projectTitle: trackingProject.title,
        clientId: trackingProject.clientId,
        clientEmail: trackingProject.clientEmail,
        freelancerId: trackingProject.freelancerId,
        freelancerName: currentUser?.displayName || 'Unknown',
        amount: parseFloat(transactionFormData.amount),
        dueDate: new Date(transactionFormData.dueDate),
        status: TRANSACTION_STATUSES.PENDING
      };

      const result = await transactionService.createTransaction(transactionData);
      if (result.success) {
        await fetchProjectTransactions(trackingProject.id);
        setShowTransactionForm(false);
        setTransactionFormData({
          type: TRANSACTION_TYPES.PAYMENT,
          amount: '',
          description: '',
          dueDate: '',
          paymentMethod: '',
          notes: ''
        });
        alert('Transaction created successfully!');
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Failed to create transaction. Please try again.');
    }
  };

  const handleUpdateTransactionStatus = async (transactionId, status) => {
    try {
      const result = await transactionService.updateTransactionStatus(transactionId, status);
      if (result.success) {
        await fetchProjectTransactions(trackingProject.id);
        alert('Transaction status updated successfully!');
      }
    } catch (error) {
      console.error('Error updating transaction status:', error);
      alert('Failed to update transaction status. Please try again.');
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const result = await transactionService.deleteTransaction(transactionId);
      if (result.success) {
        await fetchProjectTransactions(trackingProject.id);
        alert('Transaction deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    }
  };

  const handleTransactionFormChange = (e) => {
    setTransactionFormData({
      ...transactionFormData,
      [e.target.name]: e.target.value
    });
  };

  // Invoice Management Functions
  const fetchProjectInvoices = async (projectId) => {
    try {
      console.log('🔍 Fetching invoices for project:', projectId);
      const result = await invoiceService.getProjectInvoices(projectId);
      if (result.success) {
        setInvoices(result.invoices);
        console.log('✅ Project invoices loaded:', result.invoices.length);
      }
    } catch (error) {
      console.error('❌ Error fetching project invoices:', error);
      setInvoices([]);
    }
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!trackingProject) return;

    try {
      const invoiceData = {
        ...invoiceFormData,
        projectId: trackingProject.id,
        projectTitle: trackingProject.title,
        clientId: trackingProject.clientId,
        clientEmail: trackingProject.clientEmail,
        clientName: 'Client', // Would get from client data
        freelancerId: trackingProject.freelancerId,
        freelancerName: currentUser?.displayName || 'Freelancer',
        freelancerEmail: currentUser?.email || '',
        issueDate: new Date(),
        dueDate: new Date(invoiceFormData.dueDate),
        status: INVOICE_STATUSES.DRAFT,
        lineItems: [
          {
            description: `Work for project: ${trackingProject.title}`,
            quantity: 1,
            rate: trackingProject.hourlyRate || 0,
            amount: trackingProject.hourlyRate || 0
          }
        ]
      };

      const result = await invoiceService.createInvoice(invoiceData);
      if (result.success) {
        await fetchProjectInvoices(trackingProject.id);
        setShowInvoiceForm(false);
        setInvoiceFormData({
          dueDate: '',
          paymentTerms: 'Net 30',
          notes: '',
          terms: 'Payment is due within 30 days of invoice date.'
        });
        alert('Invoice created successfully!');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice. Please try again.');
    }
  };

  const handleCreateInvoiceFromTransaction = async (transaction) => {
    try {
      const result = await invoiceService.createInvoiceFromTransaction(
        transaction,
        trackingProject,
        currentUser,
        { email: trackingProject.clientEmail }
      );
      
      if (result.success) {
        await fetchProjectInvoices(trackingProject.id);
        alert('Invoice created from transaction successfully!');
      }
    } catch (error) {
      console.error('Error creating invoice from transaction:', error);
      alert('Failed to create invoice from transaction. Please try again.');
    }
  };

  const handleDownloadInvoice = (invoice) => {
    try {
      downloadInvoicePDF(invoice);
    } catch (error) {
      console.error('Error downloading invoice PDF:', error);
      alert('Failed to download invoice PDF. Please try again.');
    }
  };

  const handleSendInvoice = async (invoiceId) => {
    try {
      const result = await invoiceService.sendInvoiceEmail(invoiceId);
      if (result.success) {
        await fetchProjectInvoices(trackingProject.id);
        alert('Invoice sent successfully!');
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice. Please try again.');
    }
  };

  const handleSendFollowUp = async (invoiceId, followUpType = 'reminder') => {
    try {
      const result = await invoiceService.sendFollowUpEmail(invoiceId, followUpType);
      if (result.success) {
        alert(`${followUpType === 'overdue' ? 'Overdue' : 'Reminder'} email sent successfully!`);
      }
    } catch (error) {
      console.error('Error sending follow-up email:', error);
      alert('Failed to send follow-up email. Please try again.');
    }
  };

  const handleCheckUnpaidInvoices = async () => {
    try {
      const result = await invoiceService.checkUnpaidInvoices(currentUser?.uid);
      if (result.success) {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error checking unpaid invoices:', error);
      alert('Failed to check unpaid invoices. Please try again.');
    }
  };

  const handleToggleEmailScheduler = () => {
    if (emailSchedulerStatus) {
      emailScheduler.stopScheduler();
      setEmailSchedulerStatus(false);
      alert('Email scheduler stopped');
    } else {
      emailScheduler.startScheduler(currentUser?.uid, 60); // Check every hour
      setEmailSchedulerStatus(true);
      alert('Email scheduler started - will check for unpaid invoices every hour');
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId, status) => {
    try {
      const result = await invoiceService.updateInvoiceStatus(invoiceId, status);
      if (result.success) {
        await fetchProjectInvoices(trackingProject.id);
        alert('Invoice status updated successfully!');
      }
    } catch (error) {
      console.error('Error updating invoice status:', error);
      alert('Failed to update invoice status. Please try again.');
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const result = await invoiceService.deleteInvoice(invoiceId);
      if (result.success) {
        await fetchProjectInvoices(trackingProject.id);
        alert('Invoice deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice. Please try again.');
    }
  };

  const handleInvoiceFormChange = (e) => {
    setInvoiceFormData({
      ...invoiceFormData,
      [e.target.name]: e.target.value
    });
  };

  // Enhanced Time Tracking Functions
  const handleIdleDetected = async () => {
    console.log('🕒 Idle detected, pausing active sessions');
    const activeSessions = enhancedTimeTrackingService.getActiveSessions();
    
    for (const session of activeSessions) {
      await enhancedTimeTrackingService.pauseTracking(session.taskId, 'idle');
    }
    
    // Update UI state
    setActiveSessions([]);
    setTrackingStates({});
  };

  const handleActivityDetected = async () => {
    console.log('🕒 Activity detected, resuming sessions');
    const activeSessions = enhancedTimeTrackingService.getActiveSessions();
    
    for (const session of activeSessions) {
      await enhancedTimeTrackingService.resumeTracking(session.taskId);
    }
    
    // Update UI state
    setActiveSessions(activeSessions);
  };

  const handleStartEnhancedTracking = async (taskId) => {
    try {
      console.log('🕒 Starting enhanced time tracking for task:', taskId);
      console.log('🕒 Current user:', currentUser?.uid);
      console.log('🕒 Tracking project:', trackingProject?.id);
      console.log('🕒 Selected project:', selectedProject?.id);
      
      // Use selectedProject.id if trackingProject is not available
      const projectId = trackingProject?.id || selectedProject?.id;
      
      if (!projectId) {
        throw new Error('No project selected for time tracking');
      }
      
      if (!currentUser?.uid) {
        throw new Error('User not authenticated');
      }
      
      const result = await enhancedTimeTrackingService.startTracking(
        taskId, 
        projectId, 
        currentUser.uid
      );
      
      if (result.success) {
        // Update tracking state
        setTrackingStates(prev => ({
          ...prev,
          [taskId]: 'running'
        }));
        
        // Update active sessions
        const sessions = enhancedTimeTrackingService.getActiveSessions();
        setActiveSessions(sessions);
        
        console.log('✅ Enhanced time tracking started');
        console.log('✅ Active sessions:', sessions);
      }
    } catch (error) {
      console.error('❌ Error starting enhanced time tracking:', error);
      alert('Failed to start time tracking: ' + error.message);
    }
  };

  const handleStopEnhancedTracking = async (taskId) => {
    try {
      console.log('🕒 Stopping enhanced time tracking for task:', taskId);
      
      const result = await enhancedTimeTrackingService.stopTracking(taskId);
      
      if (result.success) {
        // Update tracking state
        setTrackingStates(prev => ({
          ...prev,
          [taskId]: 'paused'
        }));
        
        // Update active sessions
        const sessions = enhancedTimeTrackingService.getActiveSessions();
        setActiveSessions(sessions);
        
        // Refresh project details
        if (trackingProject) {
          await fetchProjectDetails(trackingProject.id);
        }
        
        console.log('✅ Enhanced time tracking stopped:', result);
        alert(`Time tracking stopped. Duration: ${result.duration.toFixed(2)}h, Productivity: ${result.productivityScore}%`);
      }
    } catch (error) {
      console.error('❌ Error stopping enhanced time tracking:', error);
      alert('Failed to stop time tracking: ' + error.message);
    }
  };

  const handlePauseEnhancedTracking = async (taskId) => {
    try {
      console.log('⏸️ Pausing enhanced time tracking for task:', taskId);
      
      await enhancedTimeTrackingService.pauseTracking(taskId, 'manual');
      
      setTrackingStates(prev => ({
        ...prev,
        [taskId]: 'paused'
      }));
      
      const sessions = enhancedTimeTrackingService.getActiveSessions();
      setActiveSessions(sessions);
      
      console.log('✅ Enhanced time tracking paused');
    } catch (error) {
      console.error('❌ Error pausing enhanced time tracking:', error);
      alert('Failed to pause time tracking: ' + error.message);
    }
  };

  const handleStayActive = () => {
    console.log('🕒 User chose to stay active');
    resetTimer();
  };

  const handlePauseTrackingNow = async () => {
    console.log('🕒 User chose to pause tracking');
    const activeSessions = enhancedTimeTrackingService.getActiveSessions();
    
    for (const session of activeSessions) {
      await enhancedTimeTrackingService.pauseTracking(session.taskId, 'manual');
    }
    
    setActiveSessions([]);
    setTrackingStates({});
    resetTimer();
  };


  const fetchProjectTasks = async (projectId) => {
    try {
      console.log('🔍 Fetching tasks for project:', projectId);
      const tasksSnapshot = await getDocs(
        query(collection(db, 'tasks'), where('projectId', '==', projectId))
      );
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('✅ Tasks fetched:', tasksData.length, 'tasks');
      setProjectTasks(tasksData);
    } catch (error) {
      console.error('❌ Error fetching tasks:', error);
      setProjectTasks([]);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    try {
      if (!taskFormData.title || !taskFormData.estimatedHours) {
        alert('Please fill in all required fields');
        return;
      }

      if (!currentUser || !currentUser.uid) {
        alert('User not found. Please log in again.');
        return;
      }

      await addDoc(collection(db, 'tasks'), {
        ...taskFormData,
        projectId: selectedProject.id,
        assignedTo: currentUser.uid, // Add the user ID to associate task with user
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        timeSpent: 0,
        trackingStartTime: null
      });
      await fetchProjectTasks(selectedProject.id);
      setShowTaskForm(false);
      setTaskFormData({
        title: '',
        description: '',
        estimatedHours: ''
      });
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task: ' + error.message);
    }
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    try {
      if (!taskFormData.title || !taskFormData.estimatedHours) {
        alert('Please fill in all required fields');
        return;
      }
      await updateDoc(doc(db, 'tasks', selectedTask.id), {
        ...taskFormData,
        updatedAt: new Date()
      });
      await fetchProjectTasks(selectedProject.id);
      setShowTaskForm(false);
      setSelectedTask(null);
      setTaskFormData({
        title: '',
        description: '',
        estimatedHours: ''
      });
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task: ' + error.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
        await fetchProjectTasks(selectedProject.id);
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task: ' + error.message);
      }
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      console.log('✅ Completing task:', taskId);
      
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      });
      
      // Refresh the current project's tasks
      const projectId = trackingProject?.id || selectedProject?.id;
      if (projectId) {
        await fetchProjectTasks(projectId);
        // Check if all tasks are completed and update project status
        await checkAndUpdateProjectStatus();
      }
      
      console.log('✅ Task completed successfully');
    } catch (error) {
      console.error('❌ Error completing task:', error);
      alert('Failed to complete task: ' + error.message);
    }
  };

  const checkAndUpdateProjectStatus = async () => {
    if (!trackingProject) return;
    
    try {
      // Get all tasks for this project
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', trackingProject.id)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Check if all tasks are completed
      const allCompleted = allTasks.length > 0 && allTasks.every(task => task.status === 'completed');
      
      console.log('Project status check:', {
        projectId: trackingProject.id,
        totalTasks: allTasks.length,
        completedTasks: allTasks.filter(task => task.status === 'completed').length,
        allCompleted,
        currentStatus: trackingProject.status
      });
      
      // If all tasks are completed and project is still active, we could auto-complete
      // But for now, we'll just refresh the project data
      await fetchProjectDetails(trackingProject.id);
      
    } catch (error) {
      console.error('Error checking project status:', error);
    }
  };

  const handleCompleteProject = async () => {
    if (!trackingProject) return;
    
    const confirmed = window.confirm(
      `Request client approval for project completion?\n\n` +
      `This will:\n` +
      `• Send completion request to client\n` +
      `• Client can review and approve work\n` +
      `• Generate invoice after approval\n\n` +
      `Continue?`
    );
    
    if (!confirmed) return;

    try {
      // 1. Update project status to pending approval
      await updateDoc(doc(db, 'projects', trackingProject.id), {
        status: 'pending_approval',
        completionRequestedAt: new Date(),
        updatedAt: new Date()
      });

      // 2. Calculate total hours and amount for preview
      const stats = calculateProjectStats();
      const totalAmount = stats.currentCost;
      
      // 3. Create completion request for client
      const completionRequest = {
        projectId: trackingProject.id,
        projectTitle: trackingProject.title || 'Untitled Project',
        clientId: trackingProject.clientId || null, // Handle undefined clientId
        clientEmail: trackingProject.clientEmail || '',
        freelancerId: trackingProject.freelancerId || currentUser?.uid,
        freelancerName: currentUser?.displayName || 'Freelancer',
        status: 'pending',
        totalHours: stats.totalHours || 0,
        totalAmount: totalAmount || 0,
        hourlyRate: trackingProject.hourlyRate || 0,
        completedTasks: stats.completedTasks || 0,
        totalTasks: stats.totalTasks || 0,
        completionPercentage: stats.completionPercentage || 0,
        requestedAt: new Date(),
        notes: `Project work completed. Please review and approve for invoice generation.`
      };

      console.log('Creating completion request:', completionRequest);

      // 4. Save completion request
      await addDoc(collection(db, 'completion_requests'), completionRequest);
      
      // 5. Send approval request to client (placeholder - would integrate with email service)
      console.log('📧 Completion request sent to client:', trackingProject.clientEmail);
      
      // 6. Refresh project data
      await fetchProjectDetails(trackingProject.id);
      
      alert(
        `✅ Completion request sent!\n\n` +
        `📧 Client notified: ${trackingProject.clientEmail}\n` +
        `💰 Total amount: RM${(totalAmount * 1.06).toFixed(2)}\n` +
        `⏳ Waiting for client approval...`
      );
      
    } catch (error) {
      console.error('Error requesting completion:', error);
      alert('Failed to send completion request: ' + error.message);
    }
  };

  const handleCompleteProjectFromView = async () => {
    if (!selectedProject) return;
    
    const confirmed = window.confirm(
      `Request client approval for project completion?\n\n` +
      `This will:\n` +
      `• Send completion request to client\n` +
      `• Client can review and approve work\n` +
      `• Generate invoice after approval\n\n` +
      `Continue?`
    );
    
    if (!confirmed) return;

    try {
      // 1. Update project status to pending approval
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        status: 'pending_approval',
        completionRequestedAt: new Date(),
        updatedAt: new Date()
      });

      // 2. Calculate total hours and amount for preview
      const stats = await calculateProjectStatsFromView();
      const totalAmount = stats.currentCost;
      
      // 3. Create completion request for client
      const completionRequest = {
        projectId: selectedProject.id,
        projectTitle: selectedProject.title || 'Untitled Project',
        clientId: selectedProject.clientId || null, 
        clientEmail: selectedProject.clientEmail || '',
        freelancerId: selectedProject.freelancerId || currentUser?.uid,
        freelancerName: currentUser?.displayName || 'Freelancer',
        status: 'pending',
        totalHours: stats.totalHours || 0,
        totalAmount: totalAmount || 0,
        hourlyRate: selectedProject.hourlyRate || 0,
        completedTasks: stats.completedTasks || 0,
        totalTasks: stats.totalTasks || 0,
        completionPercentage: stats.completionPercentage || 0,
        requestedAt: new Date(),
        notes: `Project work completed. Please review and approve for invoice generation.`
      };

      console.log('Creating completion request from view:', completionRequest);

      // 4. Save completion request
      await addDoc(collection(db, 'completion_requests'), completionRequest);
      
      // 5. Send approval request to client 
      console.log('📧 Completion request sent to client:', selectedProject.clientEmail);
      
      // 6. Refresh project data
      await fetchProjects();
      await fetchProjectTasks(selectedProject.id);
      
      alert(
        `Completion request sent!\n\n` +
        `Client notified: ${selectedProject.clientEmail}\n` +
        `Total amount: RM${(totalAmount * 1.06).toFixed(2)}\n` +
        `Waiting for client approval..`
      );
      
    } catch (error) {
      console.error('Error requesting completion:', error);
      alert('Failed to send completion request: ' + error.message);
    }
  };

  const handleReopenProject = async () => {
    if (!selectedProject) return;
    
    const confirmed = window.confirm(
      `Reopen this completed project?\n\n` +
      `This will:\n` +
      `• Change project status back to active\n` +
      `• Allow you to continue working on tasks\n` +
      `• Client will be notified of the change\n\n` +
      `Continue?`
    );
    
    if (!confirmed) return;

    try {
      // Update project status back to active
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        status: 'active',
        reopenedAt: new Date(),
        updatedAt: new Date()
      });
      
      // Refresh project data
      await fetchProjects();
      await fetchProjectTasks(selectedProject.id);
      
      alert('✅ Project reopened successfully! You can now continue working on it.');
      
    } catch (error) {
      console.error('Error reopening project:', error);
      alert('Failed to reopen project: ' + error.message);
    }
  };

  const handleChangeProjectStatus = async (projectId, newStatus) => {
    const statusMessages = {
      'on_hold': 'Put this project on hold?',
      'cancelled': 'Cancel this project? This action cannot be undone.',
      'active': 'Reactivate this project?',
      'in_progress': 'Mark this project as in progress?'
    };

    const confirmed = window.confirm(
      `${statusMessages[newStatus] || 'Change project status?'}\n\n` +
      `This will update the project status to: ${newStatus.replace('_', ' ').toUpperCase()}\n\n` +
      `Continue?`
    );
    
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status: newStatus,
        statusChangedAt: new Date(),
        updatedAt: new Date()
      });
      
      // Refresh project data
      await fetchProjects();
      
      alert(`✅ Project status updated to ${newStatus.replace('_', ' ').toUpperCase()}!`);
      
    } catch (error) {
      console.error('Error changing project status:', error);
      alert('Failed to change project status: ' + error.message);
    }
  };

  const handleViewRevision = (revision) => {
    setSelectedRevision(revision);
    setShowRevisionModal(true);
  };

  const handleCloseRevisionModal = () => {
    setShowRevisionModal(false);
    setSelectedRevision(null);
  };

  const handleAcknowledgeRevision = async (revisionId) => {
    try {
      // Add a comment acknowledging the revision request
      await addDoc(collection(db, 'project_comments'), {
        projectId: selectedRevision.projectId,
        freelancerId: currentUser?.uid,
        clientId: selectedRevision.clientId,
        clientEmail: selectedRevision.clientEmail,
        comment: 'Revision request acknowledged. Working on improvements.',
        type: 'freelancer_acknowledgment',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Refresh revision requests
      await fetchRevisionRequests();
      
      alert('✅ Revision request acknowledged! Client has been notified.');
      handleCloseRevisionModal();
    } catch (error) {
      console.error('Error acknowledging revision:', error);
      alert('Failed to acknowledge revision: ' + error.message);
    }
  };

  const calculateProjectStatsFromView = async () => {
    if (!selectedProject) return { totalHours: 0, currentCost: 0, completedTasks: 0, totalTasks: 0, completionPercentage: 0 };
    
    try {
      // Get all tasks for this project
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', selectedProject.id)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const totalHours = allTasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
      const completedTasks = allTasks.filter(task => task.status === 'completed').length;
      const totalTasks = allTasks.length;
      const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      const currentCost = totalHours * (selectedProject.hourlyRate || 0);
      
      return {
        totalHours,
        currentCost,
        completedTasks,
        totalTasks,
        completionPercentage
      };
    } catch (error) {
      console.error('Error calculating project stats:', error);
      return { totalHours: 0, currentCost: 0, completedTasks: 0, totalTasks: 0, completionPercentage: 0 };
    }
  };

  const handleTaskChange = (e) => {
    setTaskFormData({ ...taskFormData, [e.target.name]: e.target.value });
  };

  const handleEditTaskClick = (task) => {
    setSelectedTask(task);
    setTaskFormData({
      title: task.title,
      description: task.description || '',
      estimatedHours: task.estimatedHours,
      status: task.status
    });
    setShowTaskForm(true);
  };

  const formatTimeSpent = (timeInSeconds) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const updatedTimes = {};
      
      projectTasks.forEach(task => {
        if (trackingStates[task.id] === 'running') {
          const startTime = task.trackingStartTime?.toDate();
          if (startTime) {
            const elapsedSeconds = (now - startTime) / 1000;
            const previousTimeSpent = task.timeSpent || 0;
            updatedTimes[task.id] = previousTimeSpent * 3600 + elapsedSeconds;
          }
        } else {
          updatedTimes[task.id] = (task.timeSpent || 0) * 3600;
        }
      });
      
      setTrackingTimes(updatedTimes);
    }, 1000);

    return () => clearInterval(interval);
  }, [projectTasks, trackingStates]);

  const toggleTimeTracking = async (taskId) => {
    const currentState = trackingStates[taskId];
    const newState = currentState === 'running' ? 'paused' : 'running';
    const task = projectTasks.find(t => t.id === taskId);
    
    // Update tracking state
    setTrackingStates(prev => ({
      ...prev,
      [taskId]: newState
    }));

    try {
      const taskRef = doc(db, 'tasks', taskId);
      if (newState === 'running') {
        // Start tracking
        await updateDoc(taskRef, {
          status: 'in-progress',
          trackingStartTime: new Date(),
          updatedAt: new Date()
        });
      } else {
        // Stop tracking and update time spent
        const startTime = task.trackingStartTime?.toDate();
        if (startTime) {
          const timeSpent = ((new Date() - startTime) / 1000 / 60 / 60) + (task.timeSpent || 0);
          await updateDoc(taskRef, {
            status: 'paused',
            timeSpent,
            trackingStartTime: null,
            updatedAt: new Date()
          });
        }
      }
      await fetchProjectTasks(selectedProject.id);
    } catch (error) {
      console.error('Error updating time tracking:', error);
      alert('Failed to update time tracking: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">Project Dashboard</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!trackingProject ? (
          // Show project list when no project is selected for tracking
          <>
        {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('projects')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'projects'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Projects
                </button>
              </nav>
            </div>

      {activeTab === 'projects' && (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Projects"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="in_progress">In Progress</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
              
              {/* Show Completed Toggle */}
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Show Completed</span>
              </label>
            </div>

            <div className="flex items-center space-x-4">
              <button 
                onClick={() => {
                  setActiveTab('form');
                  setFormMode('add');
                  setSelectedProject(null);
                  setFormData({
                    title: '',
                    priority: 'medium',
                    startDate: '',
                    dueDate: '',
                    hourlyRate: '',
                    clientEmail: ''
                  });
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Project
              </button>
            </div>
          </div>

          {/* Revision Requests Section */}
          {revisionRequests.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                  <h3 className="text-lg font-semibold text-yellow-800">
                    Revision Requests ({revisionRequests.length})
                  </h3>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {revisionRequests.slice(0, 3).map((revision) => (
                  <div key={revision.id} className="bg-white rounded-lg p-3 border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Project: {revision.projectTitle || 'Unknown Project'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {revision.comment}
                        </p>
                        <p className="text-xs text-gray-500">
                          {revision.createdAt?.toDate ? 
                            new Date(revision.createdAt.toDate()).toLocaleString() : 
                            'Unknown date'
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => handleViewRevision(revision)}
                        className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
                {revisionRequests.length > 3 && (
                  <p className="text-sm text-yellow-700 text-center">
                    +{revisionRequests.length - 3} more revision requests
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Projects Table */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="w-full">
              <table className="w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-1/4">Project Name</th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-20">Priority</th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-32">Status</th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-24">Start Date</th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-24">Due Date</th>
                    <th className="px-3 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-20">Rate</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider w-48">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-16 text-center">
                        <div className="space-y-3">
                          <p className="text-gray-500 text-lg">No projects found.</p>
                          <button
                            onClick={() => {
                              setActiveTab('form');
                              setFormMode('add');
                            }}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Your First Project
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => {
                      const status = getProjectStatus(project);
                      return (
                        <tr key={project.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span className="font-medium text-sm truncate block">{project.title}</span>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize
                              ${project.priority === 'high' ? 'bg-red-100 text-red-800' :
                                project.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                              }`}>
                              {project.priority}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.text}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900">
                            <span className="text-xs">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}</span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900">
                            <span className="text-xs">{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'N/A'}</span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900">
                            <span className="text-xs font-mono">RM{project.hourlyRate || 'N/A'}</span>
                          </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <div className="flex justify-end items-center space-x-2">
                            <button
                              onClick={() => handleTrackProgress(project)}
                              className="text-green-600 hover:text-green-900 inline-flex items-center px-2 py-1 hover:bg-green-50 rounded transition-colors"
                              title="Track Progress"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleViewProject(project)}
                              className="text-blue-600 hover:text-blue-900 inline-flex items-center px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                              title="View Project"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditClick(project)}
                              className="text-indigo-600 hover:text-indigo-900 inline-flex items-center px-2 py-1 hover:bg-indigo-50 rounded transition-colors"
                              title="Edit Project"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {project.status !== 'completed' && project.status !== 'pending_approval' && (
                              <select
                                onChange={(e) => e.target.value && handleChangeProjectStatus(project.id, e.target.value)}
                                className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                defaultValue=""
                                title="Change Status"
                              >
                                <option value="">Status</option>
                                <option value="on_hold">Hold</option>
                                <option value="cancelled">Cancel</option>
                                <option value="in_progress">In Progress</option>
                              </select>
                            )}
                            <button
                              onClick={() => handleDeleteProject(project.id)}
                              className="text-red-600 hover:text-red-900 inline-flex items-center px-2 py-1 hover:bg-red-50 rounded transition-colors"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        </>
        ) : (
          // Show project progress details when a project is selected for tracking
          <div className="space-y-6">
            {/* Header with back button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => setTrackingProject(null)}
                  className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{trackingProject?.title}</h1>
                  <p className="text-gray-600">Project Progress & Tracking</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Client: {trackingProject?.clientEmail || 'Unknown'}</span>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">{calculateProjectStats().completionPercentage || 0}%</span>
                </div>
              </div>
            </div>

            {loadingDetails ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading project details...</p>
              </div>
            ) : (
              <>
                {/* Progress Overview */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Project Overview</h3>
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="text-2xl font-bold text-green-600">{calculateProjectStats().completionPercentage || 0}%</span>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${calculateProjectStats().completionPercentage || 0}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{calculateProjectStats().totalTasks || 0}</div>
                      <div className="text-sm text-gray-600">Total Tasks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{calculateProjectStats().completedTasks || 0}</div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{(calculateProjectStats().totalHours || 0).toFixed(1)}h</div>
                      <div className="text-sm text-gray-600">Hours Worked</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">RM{(calculateProjectStats().currentCost || 0).toFixed(2)}</div>
                      <div className="text-sm text-gray-600">Current Cost</div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8">
                    {[
                      { id: 'overview', name: 'Overview', icon: Eye },
                      { id: 'tasks', name: 'Tasks', icon: CheckCircle },
                      { id: 'time', name: 'Time Tracking', icon: Clock },
                      { id: 'transactions', name: 'Transactions', icon: CreditCard },
                      { id: 'invoices', name: 'Invoices', icon: FileText },
                      { id: 'updates', name: 'Progress Updates', icon: MessageCircle },
                      { id: 'billing', name: 'Billing', icon: DollarSign }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setProgressTab(tab.id)}
                          className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                            progressTab === tab.id
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {tab.name}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="min-h-[400px]">
                  {progressTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Project Timeline */}
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="font-semibold mb-3 flex items-center">
                            <Calendar className="w-5 h-5 mr-2" />
                            Project Timeline
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Start Date:</span>
                              <span className="text-sm font-medium">
                                {trackingProject?.startDate ? new Date(trackingProject.startDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Due Date:</span>
                              <span className="text-sm font-medium">
                                {trackingProject?.dueDate ? new Date(trackingProject.dueDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Priority:</span>
                              <span className={`text-sm font-medium px-2 py-1 rounded ${
                                trackingProject?.priority === 'high' ? 'bg-red-100 text-red-800' :
                                trackingProject?.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {trackingProject?.priority || 'Medium'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Summary */}
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="font-semibold mb-3 flex items-center">
                            <DollarSign className="w-5 h-5 mr-2" />
                            Financial Summary
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Hourly Rate:</span>
                              <span className="text-sm font-medium">RM{trackingProject?.hourlyRate || 0}/hr</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Hours Worked:</span>
                              <span className="text-sm font-medium">{(calculateProjectStats().totalHours || 0).toFixed(1)}h</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Estimated Hours:</span>
                              <span className="text-sm font-medium">{(calculateProjectStats().estimatedHours || 0).toFixed(1)}h</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                              <span className="text-sm font-semibold">Current Cost:</span>
                              <span className="text-sm font-bold text-green-600">RM{(calculateProjectStats().currentCost || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {progressTab === 'tasks' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Project Tasks</h3>
                      <div className="space-y-3">
                        {tasks.map((task) => (
                          <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">{task.title}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {task.status || 'Pending'}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                            )}
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <span>Progress: {task.progress || 0}%</span>
                              <span>Hours: {task.timeSpent || 0}h / {task.estimatedHours || 0}h</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${task.progress || 0}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {progressTab === 'time' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Time Tracking</h3>
                      <p className="text-sm text-gray-600">
                        Time tracking is handled in the project overview. Go to the "Overview" tab to manage your time tracking.
                      </p>
                    </div>
                  )}

                  {progressTab === 'transactions' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Project Transactions</h3>
                        <button
                          onClick={() => setShowTransactionForm(true)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Transaction
                        </button>
                      </div>

                      {/* Transactions List */}
                      <div className="space-y-3">
                        {transactions.map((transaction) => (
                          <div key={transaction.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <Receipt className="w-5 h-5 text-gray-500" />
                                <div>
                                  <h4 className="font-medium text-gray-900">{transaction.description}</h4>
                                  <p className="text-sm text-gray-500">
                                    {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)} • 
                                    Due: {transaction.dueDate?.toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <span className="text-lg font-semibold text-gray-900">
                                  {transaction.currency}{transaction.amount.toFixed(2)}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.status === 'paid' ? 'bg-green-100 text-green-800' :
                                  transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  transaction.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {transaction.getStatusText()}
                                </span>
                              </div>
                            </div>
                            
                            {transaction.notes && (
                              <p className="text-sm text-gray-600 mb-2">{transaction.notes}</p>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                {transaction.paymentMethod && (
                                  <span>Method: {transaction.paymentMethod}</span>
                                )}
                                {transaction.paidAt && (
                                  <span>Paid: {transaction.paidAt.toLocaleDateString()}</span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {!transaction.invoiceGenerated && (
                                  <button
                                    onClick={() => handleCreateInvoiceFromTransaction(transaction)}
                                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                                  >
                                    <FileText className="w-4 h-4 mr-1" />
                                    Create Invoice
                                  </button>
                                )}
                                {transaction.status === 'pending' && (
                                  <button
                                    onClick={() => handleUpdateTransactionStatus(transaction.id, 'paid')}
                                    className="text-green-600 hover:text-green-800 text-sm"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteTransaction(transaction.id)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {transactions.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No transactions found for this project.</p>
                            <p className="text-sm">Click "Add Transaction" to create one.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {progressTab === 'invoices' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Project Invoices</h3>
                        <div className="flex space-x-2">
                          <button
                            onClick={handleCheckUnpaidInvoices}
                            className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                          >
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Check Unpaid
                          </button>
                          <button
                            onClick={handleToggleEmailScheduler}
                            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                              emailSchedulerStatus 
                                ? 'bg-red-600 text-white hover:bg-red-700' 
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            {emailSchedulerStatus ? 'Stop Auto-Emails' : 'Start Auto-Emails'}
                          </button>
                          <button
                            onClick={() => setShowInvoiceForm(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Invoice
                          </button>
                        </div>
                      </div>

                      {/* Invoices List */}
                      <div className="space-y-3">
                        {invoices.map((invoice) => (
                          <div key={invoice.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <FileText className="w-5 h-5 text-gray-500" />
                                <div>
                                  <h4 className="font-medium text-gray-900">{invoice.invoiceNumber}</h4>
                                  <p className="text-sm text-gray-500">
                                    Issue Date: {invoice.issueDate?.toLocaleDateString()} • 
                                    Due: {invoice.dueDate?.toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <span className="text-lg font-semibold text-gray-900">
                                  {invoice.currency}{invoice.totalAmount.toFixed(2)}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                                  invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                  invoice.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                                  invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {invoice.getStatusText()}
                                </span>
                              </div>
                            </div>
                            
                            {invoice.notes && (
                              <p className="text-sm text-gray-600 mb-2">{invoice.notes}</p>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>Subtotal: {invoice.currency}{invoice.subtotal.toFixed(2)}</span>
                                {invoice.taxAmount > 0 && (
                                  <span>Tax: {invoice.currency}{invoice.taxAmount.toFixed(2)}</span>
                                )}
                                {invoice.paidDate && (
                                  <span>Paid: {invoice.paidDate.toLocaleDateString()}</span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleDownloadInvoice(invoice)}
                                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  PDF
                                </button>
                                {invoice.status === 'draft' && (
                                  <button
                                    onClick={() => handleSendInvoice(invoice.id)}
                                    className="text-green-600 hover:text-green-800 text-sm"
                                  >
                                    Send
                                  </button>
                                )}
                                {invoice.status === 'sent' && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateInvoiceStatus(invoice.id, 'paid')}
                                      className="text-green-600 hover:text-green-800 text-sm"
                                    >
                                      Mark Paid
                                    </button>
                                    <button
                                      onClick={() => handleSendFollowUp(invoice.id, 'reminder')}
                                      className="text-yellow-600 hover:text-yellow-800 text-sm"
                                    >
                                      Remind
                                    </button>
                                  </>
                                )}
                                {invoice.status === 'overdue' && (
                                  <button
                                    onClick={() => handleSendFollowUp(invoice.id, 'overdue')}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                  >
                                    Overdue Notice
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteInvoice(invoice.id)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {invoices.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No invoices found for this project.</p>
                            <p className="text-sm">Click "Create Invoice" to create one.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {progressTab === 'updates' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Progress Updates</h3>
                      <div className="space-y-4">
                        {progressUpdates.map((update) => (
                          <div key={update.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">{update.taskTitle}</h4>
                              <span className="text-sm text-gray-500">
                                {update.updatedAt?.toDate().toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>Progress: {update.oldProgress}% → {update.newProgress}%</span>
                              <span className="text-green-600">+{update.progressChange}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {progressTab === 'billing' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Billing Information</h3>
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium mb-3">Current Billing</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Hours Worked:</span>
                                <span className="font-medium">{(calculateProjectStats().totalHours || 0).toFixed(1)}h</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Hourly Rate:</span>
                                <span className="font-medium">RM{trackingProject?.hourlyRate || 0}</span>
                              </div>
                              <div className="flex justify-between border-t pt-2">
                                <span className="font-semibold">Current Total:</span>
                                <span className="font-bold text-lg">RM{(calculateProjectStats().currentCost || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-3">Project Estimates</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Estimated Hours:</span>
                                <span className="font-medium">{(calculateProjectStats().estimatedHours || 0).toFixed(1)}h</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Estimated Total:</span>
                                <span className="font-medium">RM{(calculateProjectStats().estimatedCost || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Remaining Hours:</span>
                                <span className="font-medium">{((calculateProjectStats().estimatedHours || 0) - (calculateProjectStats().totalHours || 0)).toFixed(1)}h</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Freelancer Comment Section */}
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Add Progress Update</h3>
                  <div className="flex space-x-4">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a progress update or comment..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSendComment}
                      disabled={!newComment.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
        </div>
      )}

      {activeTab === 'form' && (
        <div className="space-y-6">
          {/* Project Details */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {formMode === 'add' ? 'Add New Project' :
                     formMode === 'edit' ? 'Edit Project' : 'View Project'}
                  </h2>
                  {formMode === 'view' && (
                    <p className="mt-1 text-sm text-gray-500">
                      Manage your project details and tasks
                    </p>
                  )}
                </div>
                {formMode === 'view' && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleEditClick(selectedProject)}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Project
                    </button>
                    {selectedProject && selectedProject.status !== 'completed' && selectedProject.status !== 'pending_approval' && (
                      <button
                        onClick={() => handleCompleteProjectFromView()}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                        title="Mark project as completed and generate invoice"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete Project
                      </button>
                    )}
                    {selectedProject && selectedProject.status === 'completed' && (
                      <button
                        onClick={() => handleReopenProject()}
                        className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
                        title="Reopen project for revisions"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reopen Project
                      </button>
                    )}
                    {selectedProject && selectedProject.status !== 'completed' && selectedProject.status !== 'pending_approval' && (
                      <div className="flex items-center space-x-2">
                        <select
                          onChange={(e) => e.target.value && handleChangeProjectStatus(selectedProject.id, e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          defaultValue=""
                        >
                          <option value="">Change Status</option>
                          <option value="on_hold">Put on Hold</option>
                          <option value="cancelled">Cancel Project</option>
                          <option value="in_progress">Mark In Progress</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Completion Summary for Completed Projects */}
            {formMode === 'view' && selectedProject && selectedProject.status === 'completed' && (
              <div className="px-8 py-4 bg-green-50 border-b border-green-200">
                <div className="flex items-center space-x-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-green-800">Project Completed</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-gray-500">Completion Date</div>
                    <div className="font-semibold text-gray-900">
                      {selectedProject.completedAt ? new Date(selectedProject.completedAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-gray-500">Total Hours</div>
                    <div className="font-semibold text-gray-900">
                      {selectedProject.totalHours || 0} hours
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-gray-500">Final Amount</div>
                    <div className="font-semibold text-gray-900">
                      RM{selectedProject.finalAmount || (selectedProject.totalHours * selectedProject.hourlyRate) || 0}
                    </div>
                  </div>
                </div>
                {selectedProject.clientNotes && (
                  <div className="mt-3 p-3 bg-white rounded-lg">
                    <div className="text-gray-500 text-sm">Client Feedback</div>
                    <div className="text-gray-900 mt-1">{selectedProject.clientNotes}</div>
                  </div>
                )}
              </div>
            )}
            
            <div className="p-8">
              <form onSubmit={formMode === 'edit' ? handleEditProject : handleAddProject} className="space-y-6 max-w-3xl">
                <div className="bg-white rounded-lg p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Project Title</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                      required
                      disabled={formMode === 'view'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                        disabled={formMode === 'view'}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate (RM)</label>
                      <input
                        type="number"
                        name="hourlyRate"
                        value={formData.hourlyRate}
                        onChange={handleChange}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                        required
                        disabled={formMode === 'view'}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Client Email (Optional)</label>
                    <input
                      type="email"
                      name="clientEmail"
                      value={formData.clientEmail}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                      placeholder="client@example.com"
                      disabled={formMode === 'view'}
                    />
                    <p className="text-xs text-gray-500 mt-1">The client will see this project on their dashboard</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                        required
                        disabled={formMode === 'view'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                      <input
                        type="date"
                        name="dueDate"
                        value={formData.dueDate}
                        onChange={handleChange}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                        required
                        disabled={formMode === 'view'}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('projects');
                      setSelectedProject(null);
                    }}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors shadow-sm font-medium"
                  >
                    {formMode === 'view' ? 'Back' : 'Cancel'}
                  </button>
                  {formMode !== 'view' && (
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                    >
                      {formMode === 'edit' ? 'Save Changes' : 'Create Project'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Tasks Section (Only visible in view mode) */}
          {formMode === 'view' && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <h2 className="text-xl font-semibold">Project Tasks</h2>
                  {trackingProject && trackingProject.status === 'completed' && (
                    <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Project Completed</span>
                    </div>
                  )}
                  {trackingProject && trackingProject.status === 'pending_approval' && (
                    <div className="flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">Pending Client Approval</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  {trackingProject && trackingProject.status !== 'completed' && trackingProject.status !== 'pending_approval' && (
                    <button
                      onClick={handleCompleteProject}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      title="Mark project as completed and generate invoice"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Project
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowTaskForm(true);
                      setSelectedTask(null);
                      setTaskFormData({
                        title: '',
                        description: '',
                        estimatedHours: '',
                        status: 'pending'
                      });
                    }}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Task
                  </button>
                </div>
              </div>

              {/* Task Form */}
              {showTaskForm && (
                <div className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium mb-4">
                    {selectedTask ? 'Edit Task' : 'Add New Task'}
                  </h3>
                  <form onSubmit={selectedTask ? handleEditTask : handleAddTask} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
                      <input
                        type="text"
                        name="title"
                        value={taskFormData.title}
                        onChange={handleTaskChange}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        name="description"
                        value={taskFormData.description}
                        onChange={handleTaskChange}
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
                      <input
                        type="number"
                        name="estimatedHours"
                        value={taskFormData.estimatedHours}
                        onChange={handleTaskChange}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowTaskForm(false);
                          setSelectedTask(null);
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        {selectedTask ? 'Update Task' : 'Add Task'}
                      </button>
                    </div>
                  </form>
                </div>
              )}


              {/* Client Approval Status (Only shown for pending approval) */}
              {trackingProject && trackingProject.status === 'pending_approval' && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <div>
                        <h4 className="text-sm font-medium text-yellow-900">Awaiting Client Approval</h4>
                        <p className="text-xs text-yellow-800">
                          Completion request sent to client. Invoice will be generated upon approval.
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-yellow-900">
                        RM{calculateProjectStats().currentCost?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-yellow-600">Pending Amount</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Status (Only shown for completed projects) */}
              {trackingProject && trackingProject.status === 'completed' && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Payment Status</h4>
                        <p className="text-xs text-blue-800">
                          Project completed - Invoice generated and sent to client
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-blue-900">
                        RM{calculateProjectStats().currentCost?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-blue-600">Total Amount</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tasks List */}
              <div className="bg-white rounded-lg">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-8 py-5 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Task</th>
                        <th className="px-8 py-5 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-8 py-5 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Est. Hours</th>
                        <th className="px-8 py-5 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Time Spent</th>
                        <th className="px-8 py-5 text-right text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {projectTasks.map((task) => (
                        <tr key={task.id}>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{task.title}</div>
                            {task.description && (
                              <div className="text-sm text-gray-500">{task.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                              ${task.status === 'completed' ? 'bg-green-100 text-green-800' :
                                task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                              }`}>
                              {task.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{task.estimatedHours}</td>
                          <td className="px-8 py-5 text-sm text-gray-900 font-mono">
                            {formatTimeSpent(trackingTimes[task.id] || 0)}
                          </td>
                          <td className="px-8 py-5 text-right text-sm font-medium">
                            <div className="flex justify-end items-center space-x-4">
                              <div className="flex items-center space-x-2">
                              <button
                                  onClick={() => handleStartEnhancedTracking(task.id)}
                                  disabled={trackingStates[task.id] === 'running'}
                                className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${
                                  trackingStates[task.id] === 'running'
                                      ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                }`}
                                  title="Start Enhanced Tracking with Idle Detection"
                                >
                                  <Play className="w-4 h-4 mr-2" />Start
                              </button>
                                
                                <button
                                  onClick={() => handlePauseEnhancedTracking(task.id)}
                                  disabled={trackingStates[task.id] !== 'running'}
                                  className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${
                                    trackingStates[task.id] !== 'running'
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50'
                                  }`}
                                  title="Pause Tracking"
                                >
                                  <Pause className="w-4 h-4 mr-2" />Pause
                                </button>
                                
                                <button
                                  onClick={() => handleStopEnhancedTracking(task.id)}
                                  disabled={trackingStates[task.id] !== 'running'}
                                  className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${
                                    trackingStates[task.id] !== 'running'
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'text-red-600 hover:text-red-900 hover:bg-red-50'
                                  }`}
                                  title="Stop Tracking"
                                >
                                  <StopCircle className="w-4 h-4 mr-2" />Stop
                                </button>
                                
                                <button
                                  onClick={() => handleCompleteTask(task.id)}
                                  disabled={task.status === 'completed'}
                                  className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${
                                    task.status === 'completed'
                                      ? 'text-gray-400 cursor-not-allowed'
                                      : 'text-blue-600 hover:text-blue-900 hover:bg-blue-50'
                                  }`}
                                  title="Mark Task as Complete"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />Complete
                                </button>
                                
                                {trackingStates[task.id] === 'running' && (
                                  <div className="flex items-center space-x-1 text-green-600">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs font-medium">LIVE</span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleEditTaskClick(task)}
                                className="text-indigo-600 hover:text-indigo-900 inline-flex items-center px-3 py-1.5 hover:bg-indigo-50 rounded-md transition-colors"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-red-600 hover:text-red-900 inline-flex items-center px-3 py-1.5 hover:bg-red-50 rounded-md transition-colors"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {projectTasks.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                            No tasks added yet. Click "Add Task" to create your first task.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Transaction</h3>
              <button
                onClick={() => setShowTransactionForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Type
                </label>
                <select
                  name="type"
                  value={transactionFormData.type}
                  onChange={handleTransactionFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={TRANSACTION_TYPES.PAYMENT}>Payment</option>
                  <option value={TRANSACTION_TYPES.EXPENSE}>Expense</option>
                  <option value={TRANSACTION_TYPES.REFUND}>Refund</option>
                  <option value={TRANSACTION_TYPES.MILESTONE}>Milestone</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (RM)
                </label>
                <input
                  type="number"
                  name="amount"
                  value={transactionFormData.amount}
                  onChange={handleTransactionFormChange}
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={transactionFormData.description}
                  onChange={handleTransactionFormChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={transactionFormData.dueDate}
                  onChange={handleTransactionFormChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  name="paymentMethod"
                  value={transactionFormData.paymentMethod}
                  onChange={handleTransactionFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Method</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="paypal">PayPal</option>
                  <option value="stripe">Stripe</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={transactionFormData.notes}
                  onChange={handleTransactionFormChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTransactionForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Form Modal */}
      {showInvoiceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Invoice</h3>
              <button
                onClick={() => setShowInvoiceForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={invoiceFormData.dueDate}
                  onChange={handleInvoiceFormChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <select
                  name="paymentTerms"
                  value={invoiceFormData.paymentTerms}
                  onChange={handleInvoiceFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Due on Receipt">Due on Receipt</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={invoiceFormData.notes}
                  onChange={handleInvoiceFormChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes for the client..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  name="terms"
                  value={invoiceFormData.terms}
                  onChange={handleInvoiceFormChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Payment terms and conditions..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInvoiceForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Idle Warning Modal */}
      <IdleWarningModal
        isVisible={idleWarning}
        timeUntilIdle={timeUntilIdle}
        onStayActive={handleStayActive}
        onPauseTracking={handlePauseTrackingNow}
        isTracking={activeSessions.length > 0}
      />

      {/* Revision Request Modal */}
      {showRevisionModal && selectedRevision && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Revision Request</h3>
              <button
                onClick={handleCloseRevisionModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Project</h4>
                <p className="text-sm text-gray-600">
                  {selectedRevision.projectTitle || 'Unknown Project'}
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Client Feedback</h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">
                    {selectedRevision.comment}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Requested Date</h4>
                <p className="text-sm text-gray-600">
                  {selectedRevision.createdAt?.toDate ? 
                    new Date(selectedRevision.createdAt.toDate()).toLocaleString() : 
                    'Unknown date'
                  }
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCloseRevisionModal}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
                <button
                  onClick={() => handleAcknowledgeRevision(selectedRevision.id)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Acknowledge & Respond
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectTracking;
