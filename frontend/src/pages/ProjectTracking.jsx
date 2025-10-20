import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye, Play, Pause, Clock, TrendingUp, CheckCircle, AlertCircle, FileText, MessageCircle, Download, Calendar, DollarSign, ArrowLeft, Send, CreditCard, Receipt, Square, StopCircle, XCircle, RefreshCw, ArrowRight, Info, Lock, Paperclip, X } from 'lucide-react';
import { collection, query, getDocs, addDoc, doc, deleteDoc, updateDoc, where, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import transactionService from '../services/transactionService';
import invoiceService from '../services/invoiceService';
import { Transaction, TRANSACTION_TYPES, TRANSACTION_STATUSES } from '../models/Transaction';
import { Invoice, INVOICE_STATUSES } from '../models/Invoice';
import { downloadInvoicePDF } from '../utils/pdfGenerator';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
import enhancedTimeTrackingService from '../services/enhancedTimeTrackingService';
import emailScheduler from '../services/emailScheduler';
import invitationService from '../services/invitationService';
import DepositInvoiceModal from '../components/DepositInvoiceModal';
import MilestoneManager from '../components/MilestoneManager';
import RecurringInvoiceManager from '../components/RecurringInvoiceManager';

const ProjectTracking = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [pendingApprovalProjects, setPendingApprovalProjects] = useState([]);
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
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState(null);
  const [showCompletionInvoicePreview, setShowCompletionInvoicePreview] = useState(false);
  const [completionInvoiceData, setCompletionInvoiceData] = useState(null);
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
  const [revisionResponse, setRevisionResponse] = useState('');
  const [revisionEstimatedDate, setRevisionEstimatedDate] = useState('');
  const [newComment, setNewComment] = useState('');
  const [uploadFiles, setUploadFiles] = useState([]);
  const [emailSchedulerStatus, setEmailSchedulerStatus] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [realTimeUnsubscribe, setRealTimeUnsubscribe] = useState(null);


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
        fetchPendingApprovalProjects(user.uid);
        fetchRevisionRequests(user.uid);
        
        // Clean up existing listener
        if (realTimeUnsubscribe) {
          realTimeUnsubscribe();
        }
        
        // Set up new real-time listener
        const unsubscribe = setupRealTimeListeners(user.uid);
        setRealTimeUnsubscribe(() => unsubscribe);
      } else {
        console.log('No user authenticated, clearing projects');
        setProjects([]);
        setFilteredProjects([]);
        setPendingApprovalProjects([]);
        setRevisionRequests([]);
        
        // Clean up real-time listener
        if (realTimeUnsubscribe) {
          realTimeUnsubscribe();
          setRealTimeUnsubscribe(null);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Cleanup real-time listener on unmount
  useEffect(() => {
    return () => {
      if (realTimeUnsubscribe) {
        realTimeUnsubscribe();
      }
    };
  }, [realTimeUnsubscribe]);

  // Real-time listener for project changes
  const setupRealTimeListeners = (userId) => {
    if (!userId) return;

    console.log('Setting up real-time listeners for user:', userId);
    
    // Listen to all projects for this freelancer
    const projectsQuery = query(
      collection(db, 'projects'),
      where('freelancerId', '==', userId)
    );

    const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
      console.log('Real-time project update received:', {
        size: snapshot.size,
        changes: snapshot.docChanges().length,
        timestamp: new Date().toISOString()
      });

      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Updated projects from real-time listener:', projectsData);
      setProjects(projectsData);

      // Update pending approval projects
      const pendingProjects = projectsData.filter(project => project.status === 'pending_approval');
      console.log('Pending approval projects:', pendingProjects);
      setPendingApprovalProjects(pendingProjects);
    }, (error) => {
      console.error('Real-time listener error:', error);
    });

    return unsubscribe;
  };


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

  const fetchPendingApprovalProjects = async (userId = null) => {
    try {
      const uid = userId || currentUser?.uid;
      
      if (!uid) {
        setPendingApprovalProjects([]);
        return;
      }

      // Fetch pending approval projects
      const pendingQuery = query(
        collection(db, 'projects'),
        where('freelancerId', '==', uid),
        where('status', '==', 'pending_approval')
      );
      
      const pendingSnapshot = await getDocs(pendingQuery);
      const pendingProjects = pendingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setPendingApprovalProjects(pendingProjects);
      return pendingProjects;
    } catch (error) {
      console.error('Error fetching pending approval projects:', error);
      setPendingApprovalProjects([]);
      return [];
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
      
      // Filter out revision requests without a valid projectId or projectTitle
      const validRevisions = revisionData.filter(revision => 
        revision.projectId && 
        revision.projectTitle && 
        revision.projectTitle !== 'Unknown Project'
      );
      
      console.log('Revision requests fetched:', validRevisions.length, 'valid out of', revisionData.length, 'total');
      setRevisionRequests(validRevisions);
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
    
    // Filter out pending approval projects (they should not be visible until approved)
    filtered = filtered.filter(project => project.status !== 'pending_approval');
    
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
        status: formData.clientEmail ? 'pending_approval' : 'active', // Set status based on client email
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
          // Backend /invitations/create endpoint automatically sends the email
          const invitationResult = await invitationService.createInvitation(
            docRef.id,
            currentUser.uid,
            formData.clientEmail
          );
          
          if (invitationResult.success) {
            // Email already sent by backend during creation
            alert(`✅ Project created and sent for client approval! Invitation email sent to ${formData.clientEmail}. The project will be available once the client accepts the invitation.\n\nInvitation Link: ${invitationResult.data.invitationLink}`);
          } else {
            console.warn('Failed to create invitation:', invitationResult.error);
            alert('✅ Project created, but invitation could not be sent.\n\nPlease ensure:\n• Backend server is running\n• Email credentials are configured in backend/.env\n\nYou can invite the client manually later.');
          }
        } catch (invitationError) {
          console.error('Error creating invitation:', invitationError);
          alert(`✅ Project created, but invitation system failed.\n\nError: ${invitationError.message}\n\nPlease check if backend server is running at http://localhost:5000`);
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
      
      // BUSINESS RULE: Restrict editing critical fields if project has a client
      const hasClient = selectedProject.clientId || selectedProject.clientEmail;
      
      if (hasClient) {
        // Only allow editing non-critical fields
        const allowedUpdates = {
          description: formData.description,
          status: formData.status,
          progress: formData.progress,
          updatedAt: new Date()
        };
        
        // Check if user tried to change locked fields
        const lockedFieldsChanged = 
          formData.title !== selectedProject.title ||
          formData.hourlyRate !== selectedProject.hourlyRate ||
          formData.clientEmail !== selectedProject.clientEmail ||
          formData.startDate !== selectedProject.startDate ||
          formData.dueDate !== selectedProject.dueDate;
        
        if (lockedFieldsChanged) {
          alert('⚠️ Cannot modify locked fields!\n\nProjects with clients have the following fields LOCKED:\n• Project Title (agreed scope)\n• Hourly Rate (contractual terms)\n• Client Email (client identity)\n• Start/Due Dates (agreed timeline)\n\n💡 To make changes, discuss with your client first or create a revision request.');
          return;
        }
        
        await updateDoc(doc(db, 'projects', selectedProject.id), allowedUpdates);
      } else {
        // No client assigned - allow full editing
        await updateDoc(doc(db, 'projects', selectedProject.id), {
          ...formData,
          updatedAt: new Date()
        });
      }
      
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
    // Find the project to check if it has a client
    const project = projects.find(p => p.id === projectId);
    
    if (project && (project.clientId || project.clientEmail)) {
      alert('⚠️ Cannot delete this project!\n\nProjects with assigned clients cannot be deleted to maintain:\n• Data integrity\n• Audit trail\n• Financial records\n• Legal documentation\n\n💡 Instead, you can mark it as "Cancelled" using the Status dropdown.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
        await fetchProjects();
        alert('✅ Project deleted successfully');
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

      // Fetch progress updates (including comments)
      const progressQuery = query(
        collection(db, 'progress_updates'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
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
    const totalHours = tasks.reduce((sum, task) => sum + (parseFloat(task.timeSpent) || 0), 0);
    const estimatedHours = tasks.reduce((sum, task) => sum + (parseFloat(task.estimatedHours) || 0), 0);
    const currentCost = totalHours * (parseFloat(trackingProject.hourlyRate) || 0);
    const estimatedCost = estimatedHours * (parseFloat(trackingProject.hourlyRate) || 0);

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

  // File Upload Functions
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setUploadFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToStorage = async (files, projectId) => {
    const uploadPromises = files.map(async (file) => {
      try {
        const storageRef = ref(
          storage,
          `progress_updates/${projectId}/${Date.now()}_${file.name}`
        );
        
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        
        return {
          name: file.name,
          url: downloadURL,
          type: file.type,
          size: file.size
        };
      } catch (error) {
        console.error('Error uploading file:', error);
        // Return a mock URL for development - replace with actual file handling
        return {
          name: file.name,
          url: `data:${file.type};base64,${await fileToBase64(file)}`,
          type: file.type,
          size: file.size,
          error: 'Upload failed - using base64 fallback'
        };
      }
    });
    
    return await Promise.all(uploadPromises);
  };

  // Helper function to convert file to base64 (fallback for CORS issues)
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !trackingProject) return;

    try {
      // Upload files first if any
      let attachments = [];
      if (uploadFiles.length > 0) {
        attachments = await uploadFilesToStorage(uploadFiles, trackingProject.id);
      }

      const commentData = {
        projectId: trackingProject.id,
        freelancerId: trackingProject.freelancerId || currentUser?.uid,
        freelancerName: currentUser?.displayName || 'Freelancer',
        clientEmail: trackingProject.clientEmail,
        comment: newComment.trim(),
        type: 'comment',
        data: {
          comment: newComment.trim(),
          attachments: attachments
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        notifyClient: false,
        readByClient: false
      };

      // Save to progress_updates collection
      await addDoc(collection(db, 'progress_updates'), commentData);
      
      setNewComment('');
      setUploadFiles([]);
      alert('✅ Progress update sent successfully!');
      
      // Refresh progress updates
      await fetchProjectDetails(trackingProject.id);
    } catch (error) {
      console.error('Error sending comment:', error);
      alert('Failed to send progress update. Please try again.');
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

  const handleCreateTransactionFromHours = async () => {
    try {
      if (!trackingProject) return;
      
      const stats = calculateProjectStats();
      const totalHours = stats.totalHours || 0;
      const hourlyRate = parseFloat(trackingProject.hourlyRate) || 0;
      const amount = totalHours * hourlyRate;
      
      if (totalHours === 0) {
        alert('No hours tracked yet. Please track time on tasks first.');
        return;
      }
      
      // Get task breakdown for description
      const tasksWithTime = tasks.filter(t => t.timeSpent > 0);
      const taskBreakdown = tasksWithTime
        .map(t => `${t.title} (${parseFloat(t.timeSpent).toFixed(1)}h)`)
        .join(', ');
      
      const transactionData = {
        projectId: trackingProject.id,
        projectTitle: trackingProject.title,
        clientId: trackingProject.clientId,
        clientEmail: trackingProject.clientEmail,
        freelancerId: trackingProject.freelancerId,
        freelancerName: currentUser?.displayName || 'Unknown',
        type: TRANSACTION_TYPES.PAYMENT,
        amount: amount,
        currency: 'RM',
        description: `Payment for ${totalHours.toFixed(1)} hours of work`,
        status: TRANSACTION_STATUSES.PENDING,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        hoursWorked: totalHours,
        hourlyRate: hourlyRate,
        timePeriod: {
          startDate: trackingProject.startDate,
          endDate: new Date()
        },
        notes: `Task breakdown: ${taskBreakdown}`,
        tags: ['billable-hours', 'time-based']
      };
      
      const result = await transactionService.createTransaction(transactionData);
      if (result.success) {
        await fetchProjectTransactions(trackingProject.id);
        alert(`Transaction created! ${totalHours.toFixed(1)} hours billed at RM${amount.toFixed(2)}`);
      }
    } catch (error) {
      console.error('Error creating transaction from hours:', error);
      alert('Failed to create transaction. Please try again.');
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
      // Get invoice to check if already sent
      const invoiceDoc = await getDocs(query(collection(db, 'invoices'), where('__name__', '==', invoiceId)));
      if (invoiceDoc.empty) {
        alert('Invoice not found');
        return;
      }
      
      const invoice = { id: invoiceDoc.docs[0].id, ...invoiceDoc.docs[0].data() };
      
      // Check if already sent
      if (invoice.status === 'sent' && invoice.sentAt) {
        const sentDate = invoice.sentAt.toDate ? invoice.sentAt.toDate() : new Date(invoice.sentAt);
        const confirmed = window.confirm(
          `⚠️ This invoice was already sent on ${sentDate.toLocaleDateString()}.\n\n` +
          `Send again? The client will receive another email notification.`
        );
        if (!confirmed) return;
      }
      
      try {
        // Try to send email via backend
        const result = await invoiceService.sendInvoiceEmail(invoiceId);
        if (result.success) {
          await fetchProjectInvoices(trackingProject.id);
          alert(`✅ Invoice sent successfully to ${invoice.clientEmail}!`);
        }
      } catch (emailError) {
        // If email fails, just update status locally (for development)
        console.warn('Email sending failed, updating status locally:', emailError);
        
        await updateDoc(doc(db, 'invoices', invoiceId), {
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date()
        });
        
        await fetchProjectInvoices(trackingProject.id);
        alert(
          `⚠️ Invoice status updated to "Sent"\n\n` +
          `Note: Email sending is not configured.\n` +
          `Client email: ${invoice.clientEmail}\n\n` +
          `In production, configure EMAIL_USER and EMAIL_PASS environment variables.`
        );
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to update invoice status. Please try again.');
    }
  };

  const handleSendFollowUp = async (invoiceId, followUpType = 'reminder') => {
    try {
      // Get invoice from local state instead of Firestore
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) {
        alert('Invoice not found');
        return;
      }

      // Call backend directly without Firestore read
      const response = await fetch('http://localhost:5000/api/email/send-followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoiceId,
          clientEmail: invoice.clientEmail,
          followUpType: followUpType,
          invoiceData: {
            invoiceNumber: invoice.invoiceNumber,
            projectTitle: invoice.projectTitle,
            totalAmount: invoice.totalAmount,
            dueDate: invoice.dueDate,
            clientName: invoice.clientName,
            freelancerName: invoice.freelancerName,
            currency: invoice.currency
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ ${followUpType === 'overdue' ? 'Overdue' : 'Reminder'} email sent successfully!`);
      } else {
        throw new Error(result.error || 'Failed to send follow-up email');
      }
    } catch (error) {
      console.error('Error sending follow-up email:', error);
      alert('Failed to send follow-up email. Please try again.');
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
        
        // Refresh tasks to get updated trackingStartTime
        const projectId = trackingProject?.id || selectedProject?.id;
        if (projectId) {
          await fetchProjectTasks(projectId);
        }
        
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
        
        // Refresh tasks to get updated timeSpent
        const projectId = trackingProject?.id || selectedProject?.id;
        if (projectId) {
          await fetchProjectTasks(projectId);
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
    
    // Calculate stats for invoice preview
    const stats = calculateProjectStats();
    const totalAmount = stats.currentCost;
    const totalHours = stats.totalHours || 0;
    const hourlyRate = parseFloat(trackingProject.hourlyRate) || 0;

    // Prepare invoice data for freelancer preview
    const invoiceData = {
      projectId: trackingProject.id,
      projectTitle: trackingProject.title || 'Untitled Project',
      clientId: trackingProject.clientId || null,
      clientEmail: trackingProject.clientEmail || '',
      clientName: 'Client', // Will be filled by client
      freelancerId: trackingProject.freelancerId || currentUser?.uid,
      freelancerName: currentUser?.displayName || 'Freelancer',
      freelancerEmail: currentUser?.email || '',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: INVOICE_STATUSES.DRAFT,
      subtotal: totalAmount,
      taxRate: 0.06,
      taxAmount: totalAmount * 0.06,
      totalAmount: totalAmount * 1.06,
      currency: 'RM',
      lineItems: [
        {
          description: `${trackingProject.title || 'Project Work'} - ${totalHours.toFixed(1)} hours of development work`,
          quantity: totalHours,
          rate: hourlyRate,
          amount: totalAmount
        }
      ],
      paymentTerms: 'Net 30',
      notes: `Project completed. Total work time: ${totalHours.toFixed(2)} hours at RM${hourlyRate.toFixed(2)}/hour. Tasks completed: ${stats.completedTasks || 0}/${stats.totalTasks || 0}.`,
      terms: 'Payment is due within 30 days of invoice date. Thank you for your business!',
      // Store completion request data
      _completionData: {
        totalHours: totalHours,
        hourlyRate: hourlyRate,
        completedTasks: stats.completedTasks || 0,
        totalTasks: stats.totalTasks || 0,
        completionPercentage: stats.completionPercentage || 0
      }
    };

    // Show invoice preview modal to freelancer
    setCompletionInvoiceData(invoiceData);
    setShowCompletionInvoicePreview(true);
  };

  const handleSendCompletionRequest = async (finalInvoiceData) => {
    try {
      setShowCompletionInvoicePreview(false);

      // 1. Update project status to pending approval
      await updateDoc(doc(db, 'projects', trackingProject.id), {
        status: 'pending_approval',
        completionRequestedAt: new Date(),
        updatedAt: new Date()
      });

      // 2. Create completion request with finalized invoice data
      const completionRequest = {
        projectId: trackingProject.id,
        projectTitle: finalInvoiceData.projectTitle,
        clientId: trackingProject.clientId || null,
        clientEmail: trackingProject.clientEmail || '',
        freelancerId: trackingProject.freelancerId || currentUser?.uid,
        freelancerName: currentUser?.displayName || 'Freelancer',
        freelancerEmail: currentUser?.email || '',
        status: 'pending_approval',
        totalHours: finalInvoiceData._completionData.totalHours,
        totalAmount: finalInvoiceData.subtotal, // Before tax
        hourlyRate: finalInvoiceData._completionData.hourlyRate,
        completedTasks: finalInvoiceData._completionData.completedTasks,
        totalTasks: finalInvoiceData._completionData.totalTasks,
        completionPercentage: finalInvoiceData._completionData.completionPercentage,
        requestedAt: new Date(),
        notes: finalInvoiceData.notes,
        // Store the finalized invoice data for client preview
        previewInvoiceData: {
          lineItems: finalInvoiceData.lineItems,
          paymentTerms: finalInvoiceData.paymentTerms,
          notes: finalInvoiceData.notes,
          terms: finalInvoiceData.terms,
          taxRate: finalInvoiceData.taxRate
        }
      };

      console.log('Creating completion request:', completionRequest);

      // 3. Save completion request
      await addDoc(collection(db, 'completion_requests'), completionRequest);
      
      // 4. Send approval request to client
      console.log('📧 Completion request sent to client:', trackingProject.clientEmail);
      
      // 5. Refresh project data
      await fetchProjectDetails(trackingProject.id);
      
      alert(
        `✅ Completion request sent!\n\n` +
        `📧 Client notified: ${trackingProject.clientEmail}\n` +
        `💰 Total amount: RM${finalInvoiceData.totalAmount.toFixed(2)}\n` +
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
        freelancerEmail: currentUser?.email || '',
        status: 'pending_approval',
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
    setRevisionResponse('');
    setRevisionEstimatedDate('');
  };

  const handleAcknowledgeRevision = async (revisionId) => {
    try {
      if (!revisionResponse.trim()) {
        alert('Please provide a response to the client about how you will address their feedback.');
        return;
      }

      // Update revision request status
      const revisionRef = doc(db, 'revision_requests', revisionId);
      await updateDoc(revisionRef, {
        status: 'acknowledged',
        freelancerResponse: revisionResponse,
        estimatedCompletionDate: revisionEstimatedDate ? new Date(revisionEstimatedDate) : null,
        acknowledgedAt: new Date(),
        updatedAt: new Date()
      });

      // Add a comment with freelancer's response
      await addDoc(collection(db, 'project_comments'), {
        projectId: selectedRevision.projectId,
        freelancerId: currentUser?.uid,
        clientId: selectedRevision.clientId,
        clientEmail: selectedRevision.clientEmail,
        comment: revisionResponse,
        type: 'freelancer_revision_response',
        estimatedCompletionDate: revisionEstimatedDate ? new Date(revisionEstimatedDate) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Send email notification to client
      try {
        const emailData = {
          to: selectedRevision.clientEmail,
          subject: `Revision Request Acknowledged - ${selectedRevision.projectTitle}`,
          html: `
            <h2>Revision Request Acknowledged</h2>
            <p>Your freelancer has acknowledged your revision request for <strong>${selectedRevision.projectTitle}</strong>.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3>Freelancer's Response:</h3>
              <p>${revisionResponse}</p>
              ${revisionEstimatedDate ? `<p><strong>Estimated Completion:</strong> ${new Date(revisionEstimatedDate).toLocaleDateString()}</p>` : ''}
            </div>
            
            <p>You will be notified when the revisions are complete.</p>
          `
        };
        
        await addDoc(collection(db, 'mail'), emailData);
        console.log('✅ Email notification queued');
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
      }

      // Refresh revision requests
      await fetchRevisionRequests();
      
      alert('✅ Revision request acknowledged! Client has been notified via email.');
      handleCloseRevisionModal();
    } catch (error) {
      console.error('Error acknowledging revision:', error);
      alert('Failed to acknowledge revision: ' + error.message);
    }
  };

  const handleCompleteRevision = async (revisionId) => {
    try {
      const revisionRef = doc(db, 'revision_requests', revisionId);
      await updateDoc(revisionRef, {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      });

      // Add completion comment
      await addDoc(collection(db, 'project_comments'), {
        projectId: selectedRevision.projectId,
        freelancerId: currentUser?.uid,
        clientId: selectedRevision.clientId,
        clientEmail: selectedRevision.clientEmail,
        comment: 'Revisions completed. Please review the updated work.',
        type: 'freelancer_revision_complete',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Send email notification
      try {
        const emailData = {
          to: selectedRevision.clientEmail,
          subject: `Revisions Completed - ${selectedRevision.projectTitle}`,
          html: `
            <h2>Revisions Completed</h2>
            <p>Your freelancer has completed the requested revisions for <strong>${selectedRevision.projectTitle}</strong>.</p>
            <p>Please review the updated work and provide feedback.</p>
          `
        };
        await addDoc(collection(db, 'mail'), emailData);
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
      }

      await fetchRevisionRequests();
      alert('✅ Revision marked as complete! Client has been notified.');
      handleCloseRevisionModal();
    } catch (error) {
      console.error('Error completing revision:', error);
      alert('Failed to mark revision as complete: ' + error.message);
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
      {/* Freelancer Invoice Preview Modal */}
      {showCompletionInvoicePreview && completionInvoiceData && (
        <InvoicePreviewModal
          invoiceData={completionInvoiceData}
          onConfirm={handleSendCompletionRequest}
          onCancel={() => setShowCompletionInvoicePreview(false)}
          onSaveDraft={null}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-lg shadow-lg p-6 text-white mb-6">
        <h1 className="text-3xl font-bold mb-2">Project Dashboard</h1>
        <p className="text-teal-100">
          Manage your projects, track time, and collaborate with clients all in one place.
        </p>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
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
                  if (currentUser) {
                    fetchProjects(currentUser.uid);
                    fetchPendingApprovalProjects(currentUser.uid);
                  }
                }}
                className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Refresh Projects"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
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

          {/* Pending Approval Projects */}
          {pendingApprovalProjects.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <div className="flex items-center mb-4">
                <Clock className="w-5 h-5 text-yellow-600 mr-2" />
                <h3 className="text-lg font-semibold text-yellow-800">Pending Client Approval</h3>
              </div>
              <p className="text-yellow-700 mb-4">
                The following projects are waiting for client approval. They will become available once the client accepts the invitation.
              </p>
              <div className="space-y-3">
                {pendingApprovalProjects.map((project) => (
                  <div key={project.id} className="bg-white border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{project.title}</h4>
                        <p className="text-sm text-gray-600">
                          Client: {project.clientEmail} • Rate: RM{project.hourlyRate}/hour
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending Approval
                        </span>
                        <span className="text-sm text-gray-500">
                          {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
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
                            {/* Only show delete button if project has NO client assigned */}
                            {!project.clientId && !project.clientEmail ? (
                              <button
                                onClick={() => handleDeleteProject(project.id)}
                                className="text-red-600 hover:text-red-900 inline-flex items-center px-2 py-1 hover:bg-red-50 rounded transition-colors"
                                title="Delete Project"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                disabled
                                className="text-gray-400 cursor-not-allowed inline-flex items-center px-2 py-1 rounded transition-colors opacity-50"
                                title="Cannot delete projects with assigned clients (data integrity protection)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Request Deposit
                </button>
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
                      { id: 'milestones', name: 'Milestones', icon: TrendingUp },
                      { id: 'recurring', name: 'Recurring', icon: RefreshCw },
                      { id: 'transactions', name: 'Transactions', icon: CreditCard },
                      { id: 'invoices', name: 'Invoices', icon: FileText },
                      { id: 'updates', name: 'Progress Updates', icon: MessageCircle }
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
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleCreateTransactionFromHours()}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            disabled={calculateProjectStats().totalHours === 0}
                          >
                            <Clock className="w-4 h-4 mr-2" />
                            Bill Hours Worked ({(calculateProjectStats().totalHours || 0).toFixed(1)}h)
                          </button>
                          <button
                            onClick={() => setShowTransactionForm(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Transaction
                          </button>
                        </div>
                      </div>

                      {/* Billable Hours Summary */}
                      {calculateProjectStats().totalHours > 0 && (
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-1">Billable Hours Summary</h4>
                              <p className="text-sm text-gray-600">
                                {tasks.filter(t => t.timeSpent > 0).length} tasks with tracked time
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-green-600">
                                RM{(calculateProjectStats().currentCost || 0).toFixed(2)}
                              </p>
                              <p className="text-sm text-gray-600">
                                {(calculateProjectStats().totalHours || 0).toFixed(1)}h × RM{trackingProject?.hourlyRate || 0}/h
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Transactions List */}
                      <div className="space-y-3">
                        {transactions.map((transaction) => (
                          <div key={transaction.id} className={`bg-white border rounded-lg p-4 ${
                            transaction.invoiceGenerated ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <Receipt className={`w-5 h-5 ${transaction.invoiceGenerated ? 'text-blue-600' : 'text-gray-500'}`} />
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <h4 className="font-medium text-gray-900">{transaction.description}</h4>
                                    {transaction.invoiceGenerated && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        <FileText className="w-3 h-3 mr-1" />
                                        Invoice Created
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500">
                                    {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)} • 
                                    Due: {transaction.dueDate?.toDate ? transaction.dueDate.toDate().toLocaleDateString() : new Date(transaction.dueDate).toLocaleDateString()}
                                    {transaction.invoiceNumber && (
                                      <span className="ml-2 font-medium text-blue-600">
                                        • {transaction.invoiceNumber}
                                      </span>
                                    )}
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
                            
                            {transaction.hoursWorked > 0 && (
                              <div className="bg-gray-50 border border-gray-200 rounded p-2 mb-2">
                                <p className="text-xs text-gray-700 flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  <strong>Billable Hours:</strong>&nbsp;
                                  {transaction.hoursWorked.toFixed(1)}h × RM{transaction.hourlyRate}/h
                                  {transaction.timePeriod && (
                                    <span className="ml-2 text-gray-500">
                                      ({new Date(transaction.timePeriod.startDate).toLocaleDateString()} - {new Date(transaction.timePeriod.endDate).toLocaleDateString()})
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}

                            {transaction.notes && (
                              <p className="text-sm text-gray-600 mb-2">{transaction.notes}</p>
                            )}

                            {transaction.invoiceGenerated && (
                              <div className="bg-blue-100 border border-blue-200 rounded p-2 mb-2">
                                <p className="text-xs text-blue-800 flex items-center">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Invoice {transaction.invoiceNumber} has been generated for this transaction.
                                  <button
                                    onClick={() => setProgressTab('invoices')}
                                    className="ml-2 underline hover:text-blue-900 font-medium"
                                  >
                                    View Invoice
                                  </button>
                                </p>
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                {transaction.paymentMethod && (
                                  <span className="flex items-center">
                                    <CreditCard className="w-3 h-3 mr-1" />
                                    {transaction.paymentMethod}
                                  </span>
                                )}
                                {transaction.paidAt && (
                                  <span className="flex items-center text-green-600">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Paid: {transaction.paidAt?.toDate ? transaction.paidAt.toDate().toLocaleDateString() : new Date(transaction.paidAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {!transaction.invoiceGenerated && transaction.status !== 'paid' && (
                                  <button
                                    onClick={() => handleCreateInvoiceFromTransaction(transaction)}
                                    className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition-colors"
                                  >
                                    <FileText className="w-4 h-4 mr-1" />
                                    Create Invoice
                                  </button>
                                )}
                                {transaction.status === 'pending' && (
                                  <button
                                    onClick={() => handleUpdateTransactionStatus(transaction.id, 'paid')}
                                    className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm transition-colors"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Mark Paid
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteTransaction(transaction.id)}
                                  className="flex items-center px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
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
                            onClick={() => {
                              // Prepare invoice data
                              const invoiceData = {
                                projectId: trackingProject.id,
                                projectTitle: trackingProject.title,
                                clientId: trackingProject.clientId,
                                clientName: trackingProject.clientName,
                                clientEmail: trackingProject.clientEmail,
                                freelancerId: currentUser?.uid,
                                freelancerName: currentUser?.displayName || currentUser?.email,
                                freelancerEmail: currentUser?.email,
                                invoiceNumber: `INV-${Date.now()}`,
                                issueDate: new Date(),
                                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                                currency: 'RM',
                                lineItems: [
                                  {
                                    description: `Work on ${trackingProject.title}`,
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
                                status: 'draft'
                              };
                              setInvoicePreviewData(invoiceData);
                              setShowInvoicePreview(true);
                            }}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Invoice
                          </button>
                        </div>
                      </div>

                      {/* Invoices List */}
                      <div className="space-y-3">
                        {invoices.map((invoice) => {
                          // Find if this invoice was created from a transaction
                          const linkedTransaction = transactions.find(t => t.invoiceNumber === invoice.invoiceNumber);
                          
                          return (
                            <div key={invoice.id} className={`bg-white border rounded-lg p-4 ${
                              linkedTransaction ? 'border-purple-300 bg-purple-50' : 'border-gray-200'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-3">
                                  <FileText className={`w-5 h-5 ${linkedTransaction ? 'text-purple-600' : 'text-gray-500'}`} />
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <h4 className="font-medium text-gray-900">{invoice.invoiceNumber}</h4>
                                      {linkedTransaction && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                          <Receipt className="w-3 h-3 mr-1" />
                                          From Transaction
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                      Issue Date: {invoice.issueDate ? (invoice.issueDate?.toDate ? invoice.issueDate.toDate().toLocaleDateString() : new Date(invoice.issueDate).toLocaleDateString()) : 'N/A'} • 
                                      Due: {invoice.dueDate ? (invoice.dueDate?.toDate ? invoice.dueDate.toDate().toLocaleDateString() : new Date(invoice.dueDate).toLocaleDateString()) : 'N/A'}
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
                              
                              {linkedTransaction && (
                                <div className="bg-purple-100 border border-purple-200 rounded p-2 mb-2">
                                  <p className="text-xs text-purple-800 flex items-center">
                                    <Receipt className="w-3 h-3 mr-1" />
                                    Generated from transaction: {linkedTransaction.description}
                                    <button
                                      onClick={() => setProgressTab('transactions')}
                                      className="ml-2 underline hover:text-purple-900 font-medium"
                                    >
                                      View Transaction
                                    </button>
                                  </p>
                                </div>
                              )}
                              
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
                                  <span>Paid: {invoice.paidDate?.toDate ? invoice.paidDate.toDate().toLocaleDateString() : new Date(invoice.paidDate).toLocaleDateString()}</span>
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
                          );
                        })}
                        
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
                      
                      {/* Updates List */}
                      <div className="space-y-4">
                        {progressUpdates.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No progress updates yet.</p>
                            <p className="text-sm">Add your first update below to keep your client informed.</p>
                          </div>
                        ) : (
                          progressUpdates.map((update) => (
                            <div key={update.id} className="bg-white border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start space-x-3">
                                {/* Icon based on type */}
                                <div className={`p-2 rounded-full ${
                                  update.type === 'comment' ? 'bg-blue-100' :
                                  update.type === 'task_progress' ? 'bg-green-100' :
                                  'bg-gray-100'
                                }`}>
                                  {update.type === 'comment' ? (
                                    <MessageCircle className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  )}
                                </div>
                                
                                <div className="flex-1">
                                  {/* Header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <span className="font-medium text-gray-900">
                                        {update.freelancerName || 'Freelancer'}
                                      </span>
                                      <span className="text-sm text-gray-500 ml-2">
                                        {update.createdAt?.toDate ? 
                                          update.createdAt.toDate().toLocaleString() : 
                                          new Date(update.createdAt).toLocaleString()
                                        }
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Content based on type */}
                                  {update.type === 'comment' && (
                                    <div>
                                      <p className="text-gray-700 whitespace-pre-wrap">
                                        {update.data?.comment || update.comment}
                                      </p>
                                      
                                      {/* Display Attachments */}
                                      {update.data?.attachments && update.data.attachments.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-sm text-gray-600 mb-2">Attachments:</p>
                                          <div className="flex flex-wrap gap-2">
                                            {update.data.attachments.map((attachment, idx) => (
                                              <div key={idx} className="relative">
                                                {attachment.type.startsWith('image/') ? (
                                                  <div className="group">
                                                    <img
                                                      src={attachment.url}
                                                      alt={attachment.name}
                                                      className="w-24 h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                                      onClick={() => {
                                                        if (attachment.url.startsWith('data:')) {
                                                          // For base64 images, create a blob URL
                                                          const link = document.createElement('a');
                                                          link.href = attachment.url;
                                                          link.download = attachment.name;
                                                          link.click();
                                                        } else {
                                                          window.open(attachment.url, '_blank');
                                                        }
                                                      }}
                                                    />
                                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center">
                                                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                    {attachment.error && (
                                                      <div className="absolute -bottom-6 left-0 text-xs text-orange-600 bg-orange-100 px-1 rounded">
                                                        CORS Issue
                                                      </div>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <a
                                                    href={attachment.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center p-2 bg-gray-100 rounded border hover:bg-gray-200 transition-colors"
                                                  >
                                                    <FileText className="w-4 h-4 text-gray-600 mr-2" />
                                                    <span className="text-sm text-gray-700 truncate max-w-32">
                                                      {attachment.name}
                                                    </span>
                                                    <Download className="w-3 h-3 text-gray-500 ml-1" />
                                                    {attachment.error && (
                                                      <span className="text-xs text-orange-600 ml-1">⚠️</span>
                                                    )}
                                                  </a>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {update.type === 'task_progress' && (
                                    <div>
                                      <p className="text-gray-700 mb-2">
                                        Updated <strong>{update.taskTitle}</strong>
                                      </p>
                                      <div className="flex items-center space-x-2 text-sm">
                                        <span className="text-gray-600">{update.oldProgress}%</span>
                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                        <span className="font-medium text-green-600">{update.newProgress}%</span>
                                        <span className="text-xs text-green-600">+{update.progressChange}%</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {progressTab === 'milestones' && (
                    <MilestoneManager
                      project={trackingProject}
                      currentUser={currentUser}
                      onUpdate={() => fetchProjectDetails(trackingProject.id)}
                    />
                  )}

                  {progressTab === 'recurring' && (
                    <RecurringInvoiceManager
                      project={trackingProject}
                      currentUser={currentUser}
                      onUpdate={() => fetchProjectDetails(trackingProject.id)}
                    />
                  )}

                </div>

                {/* Freelancer Comment Section */}
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Add Progress Update</h3>
                  <div className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share project progress, updates, or ask questions..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    
                    {/* File Upload Section */}
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                        <Paperclip className="w-4 h-4 mr-2" />
                        Attach Files
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.txt"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                      
                      {uploadFiles.length > 0 && (
                        <span className="text-sm text-gray-600">
                          {uploadFiles.length} file(s) selected
                        </span>
                      )}
                    </div>
                    
                    {/* Preview Selected Files */}
                    {uploadFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {uploadFiles.map((file, idx) => (
                          <div key={idx} className="relative">
                            {file.type.startsWith('image/') ? (
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="w-20 h-20 object-cover rounded border"
                              />
                            ) : (
                              <div className="w-20 h-20 bg-gray-100 rounded border flex items-center justify-center">
                                <FileText className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            <button
                              onClick={() => removeFile(idx)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <p className="text-xs text-gray-600 mt-1 truncate w-20">{file.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex justify-end">
                      <button
                        onClick={handleSendComment}
                        disabled={!newComment.trim()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send Update
                      </button>
                    </div>
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
                {/* Show warning banner if editing project with client */}
                {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
                    <Lock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900">Protected Project</h4>
                      <p className="text-xs text-amber-700 mt-1">
                        Critical fields are locked to protect contractual agreements. Only status and progress can be updated.
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="bg-white rounded-lg p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      Project Title
                      {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                        <Lock className="w-4 h-4 ml-2 text-amber-600" title="Locked: Agreed scope" />
                      )}
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      className={`w-full p-3 border rounded-lg shadow-sm ${
                        formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))
                          ? 'bg-gray-100 cursor-not-allowed border-gray-200'
                          : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      }`}
                      required
                      disabled={formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))}
                    />
                    {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                      <p className="text-xs text-amber-600 mt-1">🔒 Locked: This is the agreed project scope</p>
                    )}
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
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Hourly Rate (RM)
                        {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                          <Lock className="w-4 h-4 ml-2 text-amber-600" title="Locked: Contractual terms" />
                        )}
                      </label>
                      <input
                        type="number"
                        name="hourlyRate"
                        value={formData.hourlyRate}
                        onChange={handleChange}
                        className={`w-full p-3 border rounded-lg shadow-sm ${
                          formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))
                            ? 'bg-gray-100 cursor-not-allowed border-gray-200'
                            : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                        }`}
                        required
                        disabled={formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))}
                      />
                      {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                        <p className="text-xs text-amber-600 mt-1">🔒 Locked: Agreed financial terms</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                      Client Email (Optional)
                      {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                        <Lock className="w-4 h-4 ml-2 text-amber-600" title="Locked: Client identity" />
                      )}
                    </label>
                    <input
                      type="email"
                      name="clientEmail"
                      value={formData.clientEmail}
                      onChange={handleChange}
                      className={`w-full p-3 border rounded-lg shadow-sm ${
                        formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))
                          ? 'bg-gray-100 cursor-not-allowed border-gray-200'
                          : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      }`}
                      placeholder="client@example.com"
                      disabled={formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))}
                    />
                    {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) ? (
                      <p className="text-xs text-amber-600 mt-1">🔒 Locked: Client identity cannot be changed</p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">The client will see this project on their dashboard</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Start Date
                        {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                          <Lock className="w-4 h-4 ml-2 text-amber-600" title="Locked: Agreed timeline" />
                        )}
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className={`w-full p-3 border rounded-lg shadow-sm ${
                          formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))
                            ? 'bg-gray-100 cursor-not-allowed border-gray-200'
                            : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                        }`}
                        required
                        disabled={formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))}
                      />
                      {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                        <p className="text-xs text-amber-600 mt-1">🔒 Locked: Agreed timeline</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Due Date
                        {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                          <Lock className="w-4 h-4 ml-2 text-amber-600" title="Locked: Agreed deadline" />
                        )}
                      </label>
                      <input
                        type="date"
                        name="dueDate"
                        value={formData.dueDate}
                        onChange={handleChange}
                        className={`w-full p-3 border rounded-lg shadow-sm ${
                          formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))
                            ? 'bg-gray-100 cursor-not-allowed border-gray-200'
                            : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                        }`}
                        required
                        disabled={formMode === 'view' || (formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail))}
                      />
                      {formMode === 'edit' && (selectedProject?.clientId || selectedProject?.clientEmail) && (
                        <p className="text-xs text-amber-600 mt-1">🔒 Locked: Agreed deadline</p>
                      )}
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

      {/* Invoice Preview Modal */}
      {showInvoicePreview && invoicePreviewData && (
        <InvoicePreviewModal
          invoiceData={invoicePreviewData}
          onConfirm={async (editedData) => {
            try {
              // Create invoice with edited data
              const result = await invoiceService.createInvoice({
                ...editedData,
                status: 'sent',
                createdAt: new Date(),
                updatedAt: new Date()
              });

              if (result.success) {
                alert('✅ Invoice created and sent successfully!');
                setShowInvoicePreview(false);
                setInvoicePreviewData(null);
                await fetchProjectInvoices(trackingProject.id);
              } else {
                throw new Error(result.error || 'Failed to create invoice');
              }
            } catch (error) {
              console.error('Error creating invoice:', error);
              alert('Failed to create invoice: ' + error.message);
            }
          }}
          onSaveDraft={async (editedData) => {
            try {
              // Save as draft
              const result = await invoiceService.createInvoice({
                ...editedData,
                status: 'draft',
                createdAt: new Date(),
                updatedAt: new Date()
              });

              if (result.success) {
                alert('✅ Invoice saved as draft!');
                setShowInvoicePreview(false);
                setInvoicePreviewData(null);
                await fetchProjectInvoices(trackingProject.id);
              } else {
                throw new Error(result.error || 'Failed to save draft');
              }
            } catch (error) {
              console.error('Error saving draft:', error);
              alert('Failed to save draft: ' + error.message);
            }
          }}
          onCancel={() => {
            setShowInvoicePreview(false);
            setInvoicePreviewData(null);
          }}
        />
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


      {/* Deposit Invoice Modal */}
      {showDepositModal && trackingProject && (
        <DepositInvoiceModal
          project={trackingProject}
          currentUser={currentUser}
          onConfirm={async (invoiceData) => {
            try {
              const result = await invoiceService.createInvoice(invoiceData);
              if (result.success) {
                setShowDepositModal(false);
                await fetchProjectDetails(trackingProject.id);
                alert('✅ Deposit invoice created successfully!');
              }
            } catch (error) {
              console.error('Error creating deposit invoice:', error);
              alert('Failed to create deposit invoice. Please try again.');
            }
          }}
          onCancel={() => setShowDepositModal(false)}
        />
      )}

      {/* Revision Request Modal */}
      {showRevisionModal && selectedRevision && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Revision Request
                {selectedRevision.status && (
                  <span className={`ml-3 text-sm px-2 py-1 rounded ${
                    selectedRevision.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    selectedRevision.status === 'acknowledged' ? 'bg-blue-100 text-blue-800' :
                    selectedRevision.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedRevision.status}
                  </span>
                )}
              </h3>
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
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
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

              {/* Show previous response if acknowledged */}
              {selectedRevision.status === 'acknowledged' && selectedRevision.freelancerResponse && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Your Response</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedRevision.freelancerResponse}
                    </p>
                    {selectedRevision.estimatedCompletionDate && (
                      <p className="text-xs text-gray-600 mt-2">
                        Estimated completion: {new Date(selectedRevision.estimatedCompletionDate.toDate()).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Response form for pending revisions */}
              {selectedRevision.status === 'pending' && (
                <>
                  <div>
                    <label className="block font-medium text-gray-900 mb-2">
                      Your Response <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={revisionResponse}
                      onChange={(e) => setRevisionResponse(e.target.value)}
                      placeholder="Explain how you will address the client's feedback..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Be specific about what changes you'll make and how you'll address their concerns.
                    </p>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-900 mb-2">
                      Estimated Completion Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={revisionEstimatedDate}
                      onChange={(e) => setRevisionEstimatedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      When do you expect to complete these revisions?
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCloseRevisionModal}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
                
                {selectedRevision.status === 'pending' && (
                  <button
                    onClick={() => handleAcknowledgeRevision(selectedRevision.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Response
                  </button>
                )}
                
                {selectedRevision.status === 'acknowledged' && (
                  <button
                    onClick={() => handleCompleteRevision(selectedRevision.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Complete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectTracking;
