import React, { useState, useEffect } from 'react';
import { projectsAPI } from '../api/projects';
import { auth } from '../firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import invitationService from '../services/invitationService';

const AddProjectModal = ({ onCreated }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    priority: 'medium',
    startDate: '',
    dueDate: '',
    hourlyRate: '',
    clientEmail: '',
    description: ''
  });
  const [milestones, setMilestones] = useState([]);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    percentage: 0,
    amount: 0,
    dueDate: ''
  });
  const [enableBillableHours, setEnableBillableHours] = useState(false);
  const [maxBillableHours, setMaxBillableHours] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };
  
  const handleMilestoneChange = (e) => {
    setMilestoneForm({ ...milestoneForm, [e.target.name]: e.target.value });
  };
  
  const addMilestone = () => {
    if (!milestoneForm.title || !milestoneForm.percentage) {
      setError('Milestone title and percentage are required');
      return;
    }
    
    const currentTotal = milestones.reduce((sum, m) => sum + parseFloat(m.percentage || 0), 0);
    const newPercentage = parseFloat(milestoneForm.percentage);
    
    if (newPercentage <= 0) {
      setError('Milestone percentage must be greater than 0');
      return;
    }
    
    if (currentTotal + newPercentage > 100) {
      setError(`Total cannot exceed 100%. Current: ${currentTotal}%`);
      return;
    }
    
    // Validate milestone due date
    if (milestoneForm.dueDate) {
      const milestoneDueDate = new Date(milestoneForm.dueDate);
      const projectStartDate = new Date(form.startDate);
      const projectDueDate = new Date(form.dueDate);
      
      if (form.startDate && milestoneDueDate < projectStartDate) {
        setError('Milestone due date cannot be before project start date');
        return;
      }
      
      if (form.dueDate && milestoneDueDate > projectDueDate) {
        setError('Milestone due date cannot be after project due date');
        return;
      }
    }
    
    const newMilestone = {
      id: Date.now().toString(),
      ...milestoneForm,
      percentage: newPercentage,
      amount: parseFloat(milestoneForm.amount) || 0,
      status: 'pending'
    };
    
    setMilestones([...milestones, newMilestone]);
    setMilestoneForm({ title: '', description: '', percentage: 0, amount: 0, dueDate: '' });
    setShowMilestoneForm(false);
    setError('');
  };
  
  const removeMilestone = (id) => {
    setMilestones(milestones.filter(m => m.id !== id));
  };
  
  const clearForm = () => {
    setForm({ 
      title: '', 
      priority: 'medium', 
      startDate: '', 
      dueDate: '', 
      hourlyRate: '', 
      clientEmail: '', 
      description: '' 
    });
    setMilestones([]);
    setShowMilestoneForm(false);
    setMilestoneForm({ title: '', description: '', percentage: 0, amount: 0, dueDate: '' });
    setEnableBillableHours(false);
    setMaxBillableHours('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (loading) {
      return;
    }
    
    if (!form.title || !form.priority || !form.startDate || !form.dueDate || !form.hourlyRate) {
      setError('All fields are required');
      return;
    }
    
    // Validate dates
    const startDate = new Date(form.startDate);
    const dueDate = new Date(form.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    
    if (isNaN(startDate.getTime()) || isNaN(dueDate.getTime())) {
      setError('Please enter valid dates');
      return;
    }
    
    if (dueDate < startDate) {
      setError('Due date cannot be before start date');
      return;
    }
    
    if (startDate < today) {
      setError('Start date cannot be in the past');
      return;
    }
    
    // Validate hourly rate
    if (form.hourlyRate <= 0) {
      setError('Hourly rate must be greater than 0');
      return;
    }
    
    // Validate email format if provided
    if (form.clientEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedEmail = form.clientEmail.trim();
      
      if (!emailRegex.test(trimmedEmail)) {
        setError('Please enter a valid email address (e.g., user@example.com)');
        return;
      }
      
      // Check for common email mistakes
      if (trimmedEmail.includes('..') || trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) {
        setError('Email cannot have consecutive dots or start/end with a dot');
        return;
      }
      
      if (trimmedEmail.includes(' ')) {
        setError('Email cannot contain spaces');
        return;
      }
      
      // Update form with trimmed email
      form.clientEmail = trimmedEmail;
    }
    
    // Validate milestones if any are added
    if (milestones.length > 0) {
      const totalPercentage = milestones.reduce((sum, m) => sum + parseFloat(m.percentage || 0), 0);
      
      if (totalPercentage !== 100) {
        setError(`Milestones must total 100%. Current total: ${totalPercentage}%`);
        return;
      }
    }
    
    // Validate billable hours cap if enabled
    if (enableBillableHours) {
      if (!maxBillableHours || parseFloat(maxBillableHours) <= 0) {
        setError('Please enter a valid maximum billable hours');
        return;
      }
      
      if (!form.hourlyRate || parseFloat(form.hourlyRate) <= 0) {
        setError('Hourly rate is required when billable hours cap is enabled');
        return;
      }
    }
    
    setLoading(true);
    try {
      if (!currentUser || !currentUser.uid) {
        setError('User not found. Please log in again.');
        setLoading(false);
        return;
      }

      const payload = {
        title: form.title,
        description: form.description || '',
        priority: form.priority,
        startDate: form.startDate,
        dueDate: form.dueDate,
        hourlyRate: Number(form.hourlyRate) || 0,
        freelancerId: currentUser.uid,
        status: form.clientEmail ? 'pending_approval' : 'active',
        clientEmail: form.clientEmail || null,
        milestones: milestones.length > 0 ? milestones : [],
        enableBillableHours: enableBillableHours,
        maxBillableHours: enableBillableHours ? Number(maxBillableHours) : null
      };
      
      console.log('🚀 Sending project data:', payload);
      
      const created = await projectsAPI.createProject(payload);
      console.log('✅ Project created response:', created);
      
      // Extract project ID from response
      const projectId = created?.id || created?.data?.id;
      
      if (!projectId) {
        console.error('❌ No project ID in response:', created);
        alert('Project may have been created but ID not found. Please refresh the page and check your projects.');
        setError('Project created but ID not found. Please refresh the page.');
        setLoading(false);
        return;
      }
      
      console.log('✅ Project ID:', projectId);
      
      // Generate invitation if client email is provided
      if (form.clientEmail) {
        // Prevent freelancer from inviting themselves
        if (form.clientEmail.toLowerCase() === currentUser.email.toLowerCase()) {
          setError('⚠️ You cannot invite yourself as a client. Please use a different email address.');
          setLoading(false);
          return;
        }
        
        console.log('📧 Creating invitation for:', form.clientEmail);
        
        try {
          const invitationResult = await invitationService.createInvitation(
            projectId,
            currentUser.uid,
            form.clientEmail
          );
          
          console.log('📧 Invitation result:', invitationResult);
          
          if (invitationResult.success) {
            // Send invitation email
            await invitationService.sendInvitationEmail(
              form.clientEmail,
              invitationResult.data.invitationLink,
              form.title,
              currentUser.displayName || currentUser.email,
              currentUser.email
            );
            
            alert(`✅ Project created and sent for client approval! Invitation sent to ${form.clientEmail}. The contract has been auto-signed by you and sent to the client for signature.`);
          } else {
            console.warn('Failed to create invitation:', invitationResult.error);
            alert('✅ Project created, but invitation could not be sent. You can invite the client manually later.');
          }
        } catch (invitationError) {
          console.error('Error creating invitation:', invitationError);
          alert('✅ Project created, but invitation could not be sent. You can invite the client manually later.');
        }
      } else {
        alert('✅ Project created successfully!');
      }
      
      onCreated?.(created);
      setOpen(false);
      clearForm();
    } catch (err) {
      setError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
      >
        New Project
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h3 className="text-xl font-semibold">Create New Project</h3>
              <p className="text-sm text-gray-500">Define project details and milestones that will be included in the contract.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Project Title</label>
                <input
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Website Redesign"
                  required
                />
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium">Description (Optional)</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="3"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief project description..."
                />
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium">Priority</label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Start Date</label>
                  <input
                    name="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Due Date</label>
                  <input
                    name="dueDate"
                    type="date"
                    value={form.dueDate}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              {/* Billable Hours Cap Section */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-sm font-medium text-gray-900">Billable Hours Cap</label>
                    <p className="text-xs text-gray-600 mt-1">Set a maximum limit on billable hours for this project</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableBillableHours(!enableBillableHours)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enableBillableHours ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enableBillableHours ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {enableBillableHours && (
                  <div className="space-y-3 pt-3 border-t border-gray-300">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Hourly Rate (RM) *</label>
                      <input
                        name="hourlyRate"
                        type="number"
                        value={form.hourlyRate}
                        onChange={handleChange}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 75"
                        required={enableBillableHours}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Maximum Billable Hours *</label>
                      <input
                        type="number"
                        value={maxBillableHours}
                        onChange={(e) => setMaxBillableHours(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 40"
                        min="1"
                        required={enableBillableHours}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Client will only be billed up to this many hours
                        {form.hourlyRate && maxBillableHours && (
                          <span className="font-semibold text-blue-600 ml-1">
                            (Max: RM{(parseFloat(form.hourlyRate) * parseFloat(maxBillableHours)).toFixed(2)})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium">Client Email (Optional)</label>
                <input
                  name="clientEmail"
                  type="email"
                  value={form.clientEmail}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="client@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">Invitation will be sent with contract to sign</p>
              </div>
              
              {/* Milestones Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Milestones (Optional but Recommended)</label>
                  <button
                    type="button"
                    onClick={() => setShowMilestoneForm(!showMilestoneForm)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Milestone
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">Define project milestones that will be included in the contract</p>
                
                {/* Milestone List */}
                {milestones.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {milestones.map((milestone) => (
                      <div key={milestone.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{milestone.title}</div>
                          <div className="text-xs text-gray-600">
                            {milestone.percentage}% {milestone.amount > 0 && `• RM${milestone.amount}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMilestone(milestone.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs font-medium pt-2 border-t border-gray-200">
                      <span className="text-gray-700">
                        Total: {milestones.reduce((sum, m) => sum + parseFloat(m.percentage || 0), 0)}%
                        {milestones.reduce((sum, m) => sum + parseFloat(m.percentage || 0), 0) === 100 ? (
                          <span className="text-green-600 ml-2">✓ Complete</span>
                        ) : (
                          <span className="text-orange-600 ml-2">
                            (Need {100 - milestones.reduce((sum, m) => sum + parseFloat(m.percentage || 0), 0)}% more)
                          </span>
                        )}
                      </span>
                      <span className="text-gray-700">
                        Total Amount: RM{milestones.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Add Milestone Form */}
                {showMilestoneForm && (
                  <div className="bg-blue-50 p-3 rounded-md space-y-2 mb-3">
                    <input
                      name="title"
                      type="text"
                      value={milestoneForm.title}
                      onChange={handleMilestoneChange}
                      placeholder="Milestone title"
                      className="w-full text-sm rounded border border-gray-300 px-2 py-1"
                    />
                    <textarea
                      name="description"
                      value={milestoneForm.description}
                      onChange={handleMilestoneChange}
                      placeholder="Description (optional)"
                      rows="2"
                      className="w-full text-sm rounded border border-gray-300 px-2 py-1"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Percentage (%)</label>
                        <input
                          name="percentage"
                          type="number"
                          value={milestoneForm.percentage}
                          onChange={handleMilestoneChange}
                          placeholder="e.g., 30"
                          min="0"
                          max="100"
                          className="w-full text-sm rounded border border-gray-300 px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Amount (RM)</label>
                        <input
                          name="amount"
                          type="number"
                          value={milestoneForm.amount}
                          onChange={handleMilestoneChange}
                          placeholder="e.g., 1500"
                          min="0"
                          step="0.01"
                          className="w-full text-sm rounded border border-gray-300 px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Due Date</label>
                        <input
                          name="dueDate"
                          type="date"
                          value={milestoneForm.dueDate}
                          onChange={handleMilestoneChange}
                          className="w-full text-sm rounded border border-gray-300 px-2 py-1"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={addMilestone}
                        className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMilestoneForm(false)}
                        className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
              
              {milestones.length > 0 && milestones.reduce((sum, m) => sum + parseFloat(m.percentage || 0), 0) !== 100 && (
                <div className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded p-2">
                  ⚠️ Milestones must total 100% to create project. Current: {milestones.reduce((sum, m) => sum + parseFloat(m.percentage || 0), 0)}%
                </div>
              )}
              
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    clearForm();
                    setOpen(false);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddProjectModal;


