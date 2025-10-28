// Comprehensive validation utilities for the project system

export const projectValidation = {
  // Validate project data before creation/update
  validateProjectData(data, isUpdate = false) {
    const errors = {};
    
    // Required fields validation
    if (!data.title || data.title.trim().length < 3) {
      errors.title = 'Project title must be at least 3 characters long';
    }
    
    if (!data.startDate) {
      errors.startDate = 'Start date is required';
    } else if (new Date(data.startDate) < new Date()) {
      errors.startDate = 'Start date cannot be in the past';
    }
    
    if (!data.dueDate) {
      errors.dueDate = 'Due date is required';
    } else if (new Date(data.dueDate) <= new Date(data.startDate)) {
      errors.dueDate = 'Due date must be after start date';
    }
    
    if (!data.hourlyRate || data.hourlyRate <= 0) {
      errors.hourlyRate = 'Hourly rate must be greater than 0';
    } else if (data.hourlyRate > 10000) {
      errors.hourlyRate = 'Hourly rate seems unrealistic (max RM10,000)';
    }
    
    // Optional fields validation
    if (data.clientEmail && !this.isValidEmail(data.clientEmail)) {
      errors.clientEmail = 'Please enter a valid email address';
    }
    
    if (data.priority && !['low', 'medium', 'high'].includes(data.priority)) {
      errors.priority = 'Priority must be low, medium, or high';
    }
    
    // Business logic validation
    if (data.startDate && data.dueDate) {
      const startDate = new Date(data.startDate);
      const dueDate = new Date(data.dueDate);
      const daysDiff = (dueDate - startDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 365) {
        errors.dueDate = 'Project duration cannot exceed 1 year';
      }
      
      if (daysDiff < 1) {
        errors.dueDate = 'Project must be at least 1 day long';
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },
  
  // Validate task data
  validateTaskData(data) {
    const errors = {};
    
    if (!data.title || data.title.trim().length < 3) {
      errors.title = 'Task title must be at least 3 characters long';
    }
    
    if (!data.estimatedHours || data.estimatedHours <= 0) {
      errors.estimatedHours = 'Estimated hours must be greater than 0';
    } else if (data.estimatedHours > 1000) {
      errors.estimatedHours = 'Estimated hours seem unrealistic (max 1000)';
    }
    
    if (data.hourlyRate && (data.hourlyRate <= 0 || data.hourlyRate > 10000)) {
      errors.hourlyRate = 'Hourly rate must be between RM0 and RM10,000';
    }
    
    if (data.progress !== undefined) {
      if (data.progress < 0 || data.progress > 100) {
        errors.progress = 'Progress must be between 0 and 100';
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },
  
  // Validate time tracking data
  validateTimeEntry(data) {
    const errors = {};
    
    if (!data.taskId) {
      errors.taskId = 'Task ID is required';
    }
    
    if (data.hours && (data.hours < 0 || data.hours > 24)) {
      errors.hours = 'Hours must be between 0 and 24';
    }
    
    if (data.date && new Date(data.date) > new Date()) {
      errors.date = 'Time entry date cannot be in the future';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },
  
  // Email validation
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Sanitize input data
  sanitizeProjectData(data) {
    return {
      ...data,
      title: data.title?.trim(),
      description: data.description?.trim(),
      clientEmail: data.clientEmail?.trim().toLowerCase(),
      hourlyRate: parseFloat(data.hourlyRate) || 0,
      priority: data.priority?.toLowerCase() || 'medium'
    };
  },
  
  // Sanitize task data
  sanitizeTaskData(data) {
    return {
      ...data,
      title: data.title?.trim(),
      description: data.description?.trim(),
      estimatedHours: parseFloat(data.estimatedHours) || 0,
      hourlyRate: parseFloat(data.hourlyRate) || 0,
      progress: parseInt(data.progress) || 0
    };
  }
};

export const errorHandling = {
  // Handle API errors consistently
  handleApiError(error, context = '') {
    console.error(`API Error ${context}:`, error);
    
    if (error.code === 'permission-denied') {
      return 'You do not have permission to perform this action';
    }
    
    if (error.code === 'not-found') {
      return 'The requested resource was not found';
    }
    
    if (error.code === 'unavailable') {
      return 'Service is temporarily unavailable. Please try again later';
    }
    
    if (error.message?.includes('network')) {
      return 'Network error. Please check your connection and try again';
    }
    
    return error.message || 'An unexpected error occurred';
  },
  
  // Handle validation errors
  handleValidationErrors(errors) {
    const errorMessages = Object.values(errors);
    return errorMessages.join('. ');
  },
  
  // Retry mechanism for failed operations
  async retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
};

export const dataIntegrity = {
  // Check data consistency
  async validateProjectConsistency(projectId) {
    try {
      // This would check for data consistency issues
      // For now, return a basic validation
      return { isValid: true, issues: [] };
    } catch (error) {
      return { isValid: false, issues: [error.message] };
    }
  },
  
  // Validate time tracking consistency
  validateTimeTrackingConsistency(timeEntries) {
    const issues = [];
    
    // Check for overlapping time entries
    const sortedEntries = timeEntries.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const current = sortedEntries[i];
      const next = sortedEntries[i + 1];
      
      if (new Date(current.endTime) > new Date(next.startTime)) {
        issues.push(`Time entries overlap: ${current.id} and ${next.id}`);
      }
    }
    
    // Check for unrealistic time entries
    timeEntries.forEach(entry => {
      const hours = (new Date(entry.endTime) - new Date(entry.startTime)) / (1000 * 60 * 60);
      if (hours > 12) {
        issues.push(`Unrealistic time entry: ${hours} hours in one session`);
      }
    });
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
};

export default {
  projectValidation,
  errorHandling,
  dataIntegrity
};
