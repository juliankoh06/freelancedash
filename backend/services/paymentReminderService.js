// Automated Payment Reminder Service
// This service should be run periodically (e.g., daily via cron job or Cloud Scheduler)

const { db, admin } = require('../firebase-admin');
const { transporter } = require('./emailService');

class PaymentReminderService {
  // Main function to process all reminders
  async processReminders() {
    try {
      console.log('[INFO] Starting payment reminder processing...');
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Get all active reminder settings
      const settingsSnapshot = await db.collection('reminder_settings')
        .where('enabled', '==', true)
        .get();
      
      if (settingsSnapshot.empty) {
        console.log('[INFO] No active reminder settings found');
        return { success: true, processed: 0, sent: 0 };
      }

      let totalProcessed = 0;
      let totalSent = 0;

      // Process each user's reminder settings
      for (const settingsDoc of settingsSnapshot.docs) {
        const settings = settingsDoc.data();
        
        // Skip weekend reminders if configured
        if (settings.pauseRemindersOnWeekends && this.isWeekend(now)) {
          console.log(`[INFO] Skipping reminders for user ${settings.userId} (weekend)`);
          continue;
        }

        // Get all unpaid invoices for this user
        const invoicesQuery = db.collection('invoices')
          .where('freelancerId', '==', settings.userId)
          .where('status', 'in', ['sent', 'overdue']);

        const invoicesSnapshot = await invoicesQuery.get();
        
        for (const invoiceDoc of invoicesSnapshot.docs) {
          totalProcessed++;
          const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() };
          
          // Calculate days from due date
          const dueDate = invoice.dueDate.toDate ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
          const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          const daysDiff = Math.floor((today - dueDateOnly) / (1000 * 60 * 60 * 24));
          
          // Check if reminder should be sent today
          if (this.shouldSendReminder(settings, daysDiff)) {
            const reminderType = this.getReminderType(settings, daysDiff);
            
            // Check if we haven't already sent this reminder today
            const alreadySent = await this.checkReminderSentToday(invoice.id, reminderType);
            if (alreadySent) {
              console.log(`[INFO] Reminder already sent today for invoice ${invoice.invoiceNumber}`);
              continue;
            }

            // Send the reminder
            const result = await this.sendReminder(invoice, settings, reminderType, daysDiff);
            if (result.success) {
              totalSent++;
              
              // Update invoice status if overdue
              if (daysDiff > 0 && invoice.status !== 'overdue') {
                await db.collection('invoices').doc(invoice.id).update({
                  status: 'overdue',
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
              }
            }
          }
        }
      }

      console.log(`[SUCCESS] Reminder processing complete. Processed: ${totalProcessed}, Sent: ${totalSent}`);
      return { success: true, processed: totalProcessed, sent: totalSent };
      
    } catch (error) {
      console.error('[ERROR] Error processing reminders:', error);
      throw error;
    }
  }

  // Check if reminder should be sent based on settings
  shouldSendReminder(settings, daysDiff) {
    if (daysDiff < 0) {
      // Before due date
      return settings.beforeDueReminders && settings.beforeDueReminders.includes(Math.abs(daysDiff));
    } else {
      // After due date
      return settings.overdueReminders && settings.overdueReminders.includes(daysDiff);
    }
  }

  // Get reminder type based on days from due date
  getReminderType(settings, daysDiff) {
    if (daysDiff < 0) {
      return 'upcoming';
    } else if (daysDiff < settings.sendWarningAt) {
      return 'overdue';
    } else if (daysDiff < settings.sendFinalNoticeAt) {
      return 'warning';
    } else {
      return 'final_notice';
    }
  }

  // Check if we already sent a reminder today
  async checkReminderSentToday(invoiceId, reminderType) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const remindersSnapshot = await db.collection('payment_reminders')
      .where('invoiceId', '==', invoiceId)
      .where('reminderType', '==', reminderType)
      .where('sentAt', '>=', today)
      .limit(1)
      .get();
    
    return !remindersSnapshot.empty;
  }

  // Send reminder email
  async sendReminder(invoice, settings, reminderType, daysDiff) {
    try {
      const emailContent = this.generateReminderEmail(invoice, settings, reminderType, daysDiff);
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: invoice.clientEmail,
        cc: settings.ccFreelancer ? invoice.freelancerEmail : undefined,
        subject: emailContent.subject,
        html: emailContent.html
      };

      const result = await transporter.sendMail(mailOptions);
      
      // Log the reminder
      await db.collection('payment_reminders').add({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientEmail: invoice.clientEmail,
        reminderType,
        daysDiff,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        emailMessageId: result.messageId,
        settingsId: settings.id || null
      });

      console.log(`[SUCCESS] ${reminderType} reminder sent for invoice ${invoice.invoiceNumber}`);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      console.error(`[ERROR] Error sending reminder for invoice ${invoice.invoiceNumber}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Generate reminder email content
  generateReminderEmail(invoice, settings, reminderType, daysDiff) {
    const dueDate = invoice.dueDate.toDate ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
    const totalAmount = invoice.totalAmount || invoice.total || 0;
    
    let subject = settings.reminderEmailSubject || 'Payment Reminder: Invoice {invoiceNumber}';
    let headerColor = '#007bff';
    let headerText = 'Payment Reminder';
    let messageText = '';
    let urgencyLevel = '';

    // Customize based on reminder type
    if (reminderType === 'upcoming') {
      subject = settings.reminderEmailSubject || 'Upcoming Payment: Invoice {invoiceNumber}';
      headerText = 'Payment Due Soon';
      const daysUntilDue = Math.abs(daysDiff);
      messageText = `Your payment is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}.`;
      urgencyLevel = 'info';
    } else if (reminderType === 'overdue') {
      subject = settings.warningEmailSubject || 'Payment Reminder: Invoice {invoiceNumber} is Overdue';
      headerColor = '#ffc107';
      headerText = 'Payment Overdue';
      messageText = `Your payment is ${daysDiff} day${daysDiff !== 1 ? 's' : ''} overdue.`;
      urgencyLevel = 'warning';
    } else if (reminderType === 'warning') {
      subject = settings.warningEmailSubject || 'Payment Warning: Invoice {invoiceNumber}';
      headerColor = '#ff9800';
      headerText = 'Payment Warning';
      messageText = `Your payment is ${daysDiff} days overdue. Please take immediate action.`;
      urgencyLevel = 'warning';
    } else if (reminderType === 'final_notice') {
      subject = settings.finalNoticeSubject || 'Final Notice: Invoice {invoiceNumber}';
      headerColor = '#f44336';
      headerText = 'Final Payment Notice';
      messageText = `This is a final notice. Your payment is ${daysDiff} days overdue. Immediate action is required.`;
      urgencyLevel = 'critical';
    }

    subject = subject.replace('{invoiceNumber}', invoice.invoiceNumber);

    // Get custom message if set
    const customMessage = this.getCustomMessage(settings, reminderType);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${headerColor}; color: white; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { background-color: #f9f9f9; padding: 30px 20px; }
        .invoice-box { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid ${headerColor}; }
        .urgency-${urgencyLevel} { 
          padding: 15px; 
          margin: 20px 0; 
          border-radius: 5px;
          background-color: ${urgencyLevel === 'critical' ? '#ffebee' : urgencyLevel === 'warning' ? '#fff3e0' : '#e3f2fd'};
          border-left: 4px solid ${headerColor};
        }
        .button { 
          display: inline-block; 
          padding: 15px 30px; 
          background-color: ${headerColor}; 
          color: white; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0;
          font-weight: bold;
        }
        .amount { font-size: 24px; font-weight: bold; color: ${headerColor}; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        table { width: 100%; margin: 10px 0; }
        td { padding: 8px 0; }
        .label { font-weight: bold; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${headerText}</h1>
        </div>
        <div class="content">
          <p>Dear ${invoice.clientName || 'Valued Client'},</p>
          
          <div class="urgency-${urgencyLevel}">
            <strong>${messageText}</strong>
          </div>

          ${customMessage ? `<p>${customMessage}</p>` : ''}

          <div class="invoice-box">
            <h3>Invoice Details</h3>
            <table>
              <tr>
                <td class="label">Invoice Number:</td>
                <td>${invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <td class="label">Project:</td>
                <td>${invoice.projectTitle || 'N/A'}</td>
              </tr>
              <tr>
                <td class="label">Issue Date:</td>
                <td>${invoice.issueDate ? new Date(invoice.issueDate.toDate ? invoice.issueDate.toDate() : invoice.issueDate).toLocaleDateString() : 'N/A'}</td>
              </tr>
              <tr>
                <td class="label">Due Date:</td>
                <td>${dueDate.toLocaleDateString()}</td>
              </tr>
              <tr>
                <td class="label">Amount Due:</td>
                <td class="amount">${invoice.currency || 'RM'}${totalAmount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p>Please check your dashboard to view and pay this invoice.</p>

          <p>If you have already made the payment, please disregard this reminder and contact us to confirm receipt.</p>

          ${reminderType === 'final_notice' ? `
            <div class="urgency-critical">
              <strong>⚠️ Important:</strong> This is a final notice. If payment is not received promptly, 
              we may need to take further action. Please contact us immediately if you have any questions 
              or concerns about this invoice.
            </div>
          ` : ''}

          <p>If you have any questions, please don't hesitate to reach out.</p>
          
          <p>Best regards,<br>${invoice.freelancerName || 'Your Service Provider'}</p>
        </div>
        <div class="footer">
          <p>This is an automated payment reminder. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    return { subject, html };
  }

  // Get custom message based on reminder type
  getCustomMessage(settings, reminderType) {
    if (reminderType === 'warning') {
      return settings.customWarningMessage || '';
    } else if (reminderType === 'final_notice') {
      return settings.customFinalNoticeMessage || '';
    }
    return settings.customReminderMessage || '';
  }

  // Check if date is weekend
  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }
}

module.exports = new PaymentReminderService();
