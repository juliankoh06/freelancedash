// Email Scheduler Service
// Handles automatic follow-up emails for unpaid invoices

class EmailSchedulerService {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
  }

  // Start the automatic follow-up email system
  startScheduler(freelancerId, checkIntervalMinutes = 60) {
    if (this.isRunning) {
      console.log('Email scheduler is already running');
      return;
    }

    console.log('Starting email scheduler for freelancer:', freelancerId);
    this.isRunning = true;

    // Check immediately
    this.checkUnpaidInvoices(freelancerId);

    // Set up interval for regular checks
    this.checkInterval = setInterval(() => {
      this.checkUnpaidInvoices(freelancerId);
    }, checkIntervalMinutes * 60 * 1000); // Convert minutes to milliseconds
  }

  // Stop the automatic follow-up email system
  stopScheduler() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('Email scheduler stopped');
  }

  // Check for unpaid invoices and send follow-ups
  async checkUnpaidInvoices(freelancerId) {
    try {
      console.log('Checking unpaid invoices for freelancer:', freelancerId);
      
      const response = await fetch('http://localhost:5000/api/email/check-unpaid-invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          freelancerId: freelancerId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Unpaid invoice check completed:', result.message);
        return { success: true, message: result.message };
      } else {
        console.error('❌ Unpaid invoice check failed:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Unpaid invoice check failed:', error.message);
      // Don't throw - just log and return error
      return { success: false, error: error.message };
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.checkInterval !== null
    };
  }
}

export default new EmailSchedulerService();
