// Centralized API service for all backend communication
class APIService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    this.token = null;
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
  }

  // Clear authentication token
  clearToken() {
    this.token = null;
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }

  // Get headers with authentication
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        // Handle 401 Unauthorized - token might be expired
        if (response.status === 401) {
          const isAuthEndpoint = endpoint.includes('/auth/login') || 
                                 endpoint.includes('/auth/verify-otp') || 
                                 endpoint.includes('/auth/register');
          
          if (!isAuthEndpoint) {
            console.log('🔄 Received 401, attempting token refresh...');
            
            // Try to refresh the token if we have a current user
            const { auth } = require('../firebase-config');
            const currentUser = auth.currentUser;
            
            if (currentUser) {
              try {
                const newToken = await currentUser.getIdToken(true);
                this.setToken(newToken);
                
                // Retry the request with the new token
                const retryConfig = {
                  ...config,
                  headers: this.getHeaders(),
                };
                
                const retryResponse = await fetch(url, retryConfig);
                if (retryResponse.ok) {
                  return await retryResponse.json();
                }
              } catch (refreshError) {
                console.error('❌ Token refresh failed:', refreshError);
                // Redirect to login if token refresh fails
                window.location.href = '/login';
                return;
              }
            } else {
              // No current user, redirect to login
              window.location.href = '/login';
              return;
            }
          }
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Projects API
  async getProjects() {
    return this.request('/projects');
  }

  async getProjectsByFreelancer(freelancerId) {
    return this.request(`/projects/freelancer/${freelancerId}`);
  }

  async getProjectsByClient(clientId) {
    return this.request(`/projects/client/${clientId}`);
  }

  async getProjectsByClientEmail(clientEmail) {
    return this.request(`/projects/client-email/${clientEmail}`);
  }

  async createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async updateProject(projectId, updateData) {
    return this.request(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async deleteProject(projectId) {
    return this.request(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  // Tasks API
  async getTasks(projectId) {
    return this.request(`/projects/${projectId}/tasks`);
  }

  async createTask(projectId, taskData) {
    return this.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async updateTask(projectId, taskId, updateData) {
    return this.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async deleteTask(projectId, taskId) {
    return this.request(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  // Invoices API
  async getInvoices() {
    return this.request('/invoices');
  }

  async getInvoicesByFreelancer(freelancerId) {
    return this.request(`/invoices/freelancer/${freelancerId}`);
  }

  async getInvoicesByClient(clientId) {
    return this.request(`/invoices/client/${clientId}`);
  }

  async createInvoice(invoiceData) {
    return this.request('/invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    });
  }

  async updateInvoice(invoiceId, updateData) {
    return this.request(`/invoices/${invoiceId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  // Transactions API
  async getTransactions() {
    return this.request('/transactions');
  }

  async getTransactionsByUser(userId, userType = 'freelancer') {
    return this.request(`/transactions/user/${userId}?type=${userType}`);
  }

  async createTransaction(transactionData) {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async updateTransaction(transactionId, updateData) {
    return this.request(`/transactions/${transactionId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  // Invitations API
  async createInvitation(invitationData) {
    return this.request('/invitations', {
      method: 'POST',
      body: JSON.stringify(invitationData),
    });
  }

  async getInvitations() {
    return this.request('/invitations');
  }

  async acceptInvitation(invitationId) {
    return this.request(`/invitations/${invitationId}/accept`, {
      method: 'POST',
    });
  }

  async rejectInvitation(invitationId) {
    return this.request(`/invitations/${invitationId}/reject`, {
      method: 'POST',
    });
  }

  // Email API
  async sendInvoiceEmail(invoiceId, clientEmail, invoiceData) {
    return this.request('/email/send-invoice', {
      method: 'POST',
      body: JSON.stringify({
        invoiceId,
        clientEmail,
        invoiceData
      }),
    });
  }

  async sendFollowUpEmail(invoiceId, followUpType = 'reminder') {
    return this.request('/email/send-follow-up', {
      method: 'POST',
      body: JSON.stringify({
        invoiceId,
        followUpType
      }),
    });
  }

  // Freelancer API
  async getFreelancerStats(freelancerId) {
    return this.request(`/freelancer/stats?freelancerId=${freelancerId}`);
  }

  // OTP Authentication API
  async loginWithPassword(email, password) {
    return this.request('/auth/login-with-password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async verifyOTP(email, otp, password) {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp, password }),
    });
  }

  // Password Reset API
  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async forgotPasswordOTP(email) {
    return this.request('/auth/forgot-password-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPasswordWithOTP(email, otp, newPassword) {
    return this.request('/auth/reset-password-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  }

  async verifyResetToken(token, email) {
    return this.request('/auth/verify-reset-token', {
      method: 'POST',
      body: JSON.stringify({ token, email }),
    });
  }

  async resetPassword(token, email, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, email, newPassword }),
    });
  }
}

// Create singleton instance
const apiService = new APIService();

export default apiService;
