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
    clientEmail: ''
  });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.priority || !form.startDate || !form.dueDate || !form.hourlyRate) {
      setError('All fields are required');
      return;
    }
    
    // Validate email format if provided
    if (form.clientEmail && !/\S+@\S+\.\S+/.test(form.clientEmail)) {
      setError('Please enter a valid email address');
      return;
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
        priority: form.priority,
        startDate: form.startDate,
        dueDate: form.dueDate,
        hourlyRate: Number(form.hourlyRate),
        freelancerId: currentUser.uid, // Add the user ID to associate project with user
        status: 'active', // Set default status
        clientEmail: form.clientEmail || null // Add client email if provided
      };
      
      const created = await projectsAPI.createProject(payload);
      
      // Generate invitation if client email is provided
      if (form.clientEmail) {
        // Prevent freelancer from inviting themselves
        if (form.clientEmail.toLowerCase() === currentUser.email.toLowerCase()) {
          setError('⚠️ You cannot invite yourself as a client. Please use a different email address.');
          setLoading(false);
          return;
        }
        
        try {
          const invitationResult = await invitationService.createInvitation(
            created.id,
            currentUser.uid,
            form.clientEmail
          );
          
          if (invitationResult.success) {
            // Send invitation email
            await invitationService.sendInvitationEmail(
              form.clientEmail,
              invitationResult.data.invitationLink,
              form.title,
              currentUser.displayName || currentUser.email,
              currentUser.email
            );
            
            alert(`✅ Project created! Invitation sent to ${form.clientEmail}`);
          } else {
            console.warn('Failed to create invitation:', invitationResult.error);
            alert('✅ Project created, but invitation could not be sent. You can invite the client manually later.');
          }
        } catch (invitationError) {
          console.error('Error creating invitation:', invitationError);
          alert('✅ Project created, but invitation could not be sent. You can invite the client manually later.');
        }
      }
      
      onCreated?.(created);
      setOpen(false);
      setForm({ title: '', priority: 'medium', startDate: '', dueDate: '', hourlyRate: '', clientEmail: '' });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h3 className="text-xl font-semibold">Create New Project</h3>
              <p className="text-sm text-gray-500">Fill in the details below.</p>
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
              <div>
                <label className="mb-1 block text-sm font-medium">Start Date</label>
                <input
                  name="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Hourly Rate</label>
                <input
                  name="hourlyRate"
                  type="number"
                  value={form.hourlyRate}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 75"
                />
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
                <p className="text-xs text-gray-500 mt-1">An invitation email will be sent to this address</p>
              </div>
              {error && <div className="text-sm text-red-600">{error}</div>}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100"
                  onClick={() => setOpen(false)}
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


