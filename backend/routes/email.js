const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const admin = require('firebase-admin');
const { transporter, sendProgressUpdateEmail } = require('../services/emailService');


// Helper function to send invoice email with PDF attachment
async function sendInvoiceEmailWithPDF(invoiceId, invoiceData, pdfAttachment = null, updateStatus = true) {
  const attachments = pdfAttachment ? [{
    filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
    content: pdfAttachment,
    encoding: 'base64',
    contentType: 'application/pdf'
  }] : [];

  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: invoiceData.clientEmail,
    subject: `Invoice ${invoiceData.invoiceNumber} - ${invoiceData.projectTitle}`,
    html: generateInvoiceEmailHTML(invoiceData),
    attachments: attachments
  };

  // Validate required fields before attempting to send
  if (!invoiceData.clientEmail) {
    throw new Error('Client email is required to send invoice');
  }
  
  if (!invoiceData.invoiceNumber) {
    throw new Error('Invoice number is required to send invoice');
  }
  
  if (!invoiceData.projectTitle) {
    console.warn('⚠️ Project title missing in invoice data, using default');
    invoiceData.projectTitle = invoiceData.projectTitle || 'Project';
  }

  console.log(`📧 Sending invoice email:`, {
    invoiceId,
    invoiceNumber: invoiceData.invoiceNumber,
    clientEmail: invoiceData.clientEmail,
    projectTitle: invoiceData.projectTitle
  });

  const result = await transporter.sendMail(mailOptions);
  
  console.log(`✅ Email sent successfully. Message ID: ${result.messageId}`);
  
  // Update invoice status if invoice exists in database
  if (updateStatus && invoiceId && db) {
    try {
      const invoiceRef = db.collection('invoices').doc(invoiceId);
      const invoiceDoc = await invoiceRef.get();
      
      if (invoiceDoc.exists) {
        await invoiceRef.update({
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          emailMessageId: result.messageId
        });
        console.log(`✅ Invoice ${invoiceId} status updated to 'sent'`);
      } else {
        console.log('⚠️ Invoice not found in database, skipping status update');
      }
    } catch (updateError) {
      console.error('❌ Could not update invoice status:', updateError.message);
      // Don't throw - email was sent successfully
    }
  }

  return {
    success: true,
    messageId: result.messageId,
    message: 'Invoice sent successfully'
  };
}

// Send invoice email
router.post('/send-invoice', async (req, res) => {
  try {
    const { invoiceId, clientEmail, invoiceData } = req.body;

    const result = await sendInvoiceEmailWithPDF(invoiceId, invoiceData, invoiceData.pdfAttachment, true);
    res.json(result);
  } catch (error) {
    console.error('Error sending invoice email:', error);
    
    // Provide specific error messages based on error type
    let errorMessage = error.message;
    if (error.message.includes('535-5.7.8')) {
      errorMessage = 'Email authentication failed. Please check your Gmail credentials and App Password configuration.';
    } else if (error.message.includes('Invalid login')) {
      errorMessage = 'Invalid Gmail credentials. Please verify your email and App Password.';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      details: 'Check server console for detailed error information'
    });
  }
});

// Send follow-up email for unpaid invoices
router.post('/send-followup', async (req, res) => {
  try {
    const { invoiceId, clientEmail, invoiceData, followUpType } = req.body;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: clientEmail,
      subject: `Reminder: Invoice ${invoiceData.invoiceNumber} - ${followUpType === 'overdue' ? 'Overdue' : 'Payment Due'}`,
      html: generateFollowUpEmailHTML(invoiceData, followUpType),
      attachments: invoiceData.pdfAttachment ? [{
        filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
        content: invoiceData.pdfAttachment,
        contentType: 'application/pdf'
      }] : []
    };

    const result = await transporter.sendMail(mailOptions);
    
    // Log follow-up email (optional - skip if Firebase not configured)
    try {
      if (db) {
        await db.collection('invoice_followups').add({
          invoiceId,
          type: followUpType,
          sentAt: new Date(),
          emailMessageId: result.messageId,
          clientEmail
        });
      }
    } catch (logError) {
      console.warn('⚠️ Could not log follow-up email to Firestore:', logError.message);
    }

    res.json({ 
      success: true, 
      messageId: result.messageId,
      message: 'Follow-up email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending follow-up email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send progress update notification
router.post('/send-progress-update', async (req, res) => {
  try {
    const { projectId, clientEmail, updateData } = req.body;
    console.log('[Progress Email] Attempting to send to:', clientEmail);
    
    const result = await sendProgressUpdateEmail({
      to: clientEmail,
      projectTitle: updateData.projectTitle,
      updateText: updateData.comment || updateData.updateText || '',
      freelancerName: updateData.freelancerName || ''
    });
    
    console.log('[Progress Email] Sent. MessageId:', result.messageId);
    // Log notification (optional - skip if Firebase not configured)
    try {
      if (db) {
        await db.collection('notifications').add({
          projectId,
          type: 'progress_update',
          sentAt: new Date(),
          emailMessageId: result.messageId,
          clientEmail,
          updateData
        });
      }
    } catch (logError) {
      console.warn('⚠️ Could not log notification to Firestore:', logError.message);
    }
    res.json({ 
      success: true, 
      messageId: result.messageId,
      message: 'Progress update sent successfully' 
    });
  } catch (error) {
    console.error('Error sending progress update:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send comment notification
router.post('/send-comment-notification', async (req, res) => {
  try {
    const { projectId, recipientEmail, commenterName, commenterRole, commentText, projectTitle } = req.body;
    
    if (!recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Recipient email is required' 
      });
    }

    console.log('[Comment Email] Attempting to send to:', recipientEmail);
    
    const { sendCommentNotificationEmail } = require('../services/emailService');
    const result = await sendCommentNotificationEmail({
      projectId,
      recipientEmail,
      commenterName: commenterName || 'A user',
      commenterRole: commenterRole || 'user',
      commentText: commentText || '',
      projectTitle: projectTitle || 'Project'
    });
    
    console.log('[Comment Email] Sent. MessageId:', result.messageId);
    
    // Log notification (optional)
    try {
      if (db) {
        await db.collection('notifications').add({
          projectId,
          type: 'comment_notification',
          sentAt: new Date(),
          emailMessageId: result.messageId,
          recipientEmail,
          commenterName,
          commenterRole
        });
      }
    } catch (logError) {
      console.warn('⚠️ Could not log notification to Firestore:', logError.message);
    }
    
    res.json({ 
      success: true, 
      messageId: result.messageId,
      message: 'Comment notification sent successfully' 
    });
  } catch (error) {
    console.error('Error sending comment notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Automated follow-up system - check for unpaid invoices
router.post('/check-unpaid-invoices', async (req, res) => {
  try {
    const { freelancerId } = req.body;
    
    if (!freelancerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Freelancer ID is required' 
      });
    }

    // Check if Firebase is properly initialized
    if (!db) {
      console.error('Firebase database not initialized');
      return res.status(503).json({ 
        success: false, 
        error: 'Database service unavailable. Please check Firebase configuration.' 
      });
    }
    
    // Get all pending invoices for the freelancer
    const invoicesQuery = await db.collection('invoices')
      .where('freelancerId', '==', freelancerId)
      .where('status', 'in', ['pending', 'sent'])
      .get();

    const followUpPromises = [];
    const now = new Date();

    invoicesQuery.forEach(doc => {
      const invoice = { id: doc.id, ...doc.data() };
      
      // Safely handle dueDate
      if (!invoice.dueDate) {
        console.warn(`Invoice ${invoice.id} has no due date, skipping`);
        return;
      }
      
      const dueDate = invoice.dueDate.toDate ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
      const daysPastDue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

      if (daysPastDue > 0) {
        // Check if we've already sent a follow-up recently
        const lastFollowUp = db.collection('invoice_followups')
          .where('invoiceId', '==', invoice.id)
          .orderBy('sentAt', 'desc')
          .limit(1)
          .get();

        lastFollowUp.then(snapshot => {
          if (snapshot.empty || daysPastDue > 7) {
            // Send follow-up
            const followUpType = daysPastDue > 30 ? 'overdue' : 'reminder';
            followUpPromises.push(sendFollowUpEmail(invoice, followUpType));
          }
        });
      }
    });

    await Promise.all(followUpPromises);

    res.json({ 
      success: true, 
      message: `Processed ${followUpPromises.length} follow-up emails` 
    });
  } catch (error) {
    console.error('Error checking unpaid invoices:', error);
    
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.message.includes('Project Id')) {
      errorMessage = 'Firebase authentication error. Please ensure service account credentials are properly configured.';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

// Helper function to send follow-up email
async function sendFollowUpEmail(invoice, followUpType) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: invoice.clientEmail,
    subject: `Reminder: Invoice ${invoice.invoiceNumber} - ${followUpType === 'overdue' ? 'Overdue' : 'Payment Due'}`,
    html: generateFollowUpEmailHTML(invoice, followUpType)
  };

  const result = await transporter.sendMail(mailOptions);
  
  await db.collection('invoice_followups').add({
    invoiceId: invoice.id,
    type: followUpType,
    sentAt: new Date(),
    emailMessageId: result.messageId,
    clientEmail: invoice.clientEmail
  });

  return result;
}


// Generate invoice email HTML template
function generateInvoiceEmailHTML(invoiceData) {
  const dueDate = invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'N/A';
  const issueDate = invoiceData.issueDate ? new Date(invoiceData.issueDate).toLocaleDateString() : new Date().toLocaleDateString();
  const taxRate = invoiceData.taxRate || 0;
  const taxAmount = invoiceData.taxAmount || invoiceData.tax || 0;
  const totalAmount = invoiceData.totalAmount || invoiceData.total || 0;
  const subtotal = invoiceData.subtotal || invoiceData.amount || 0;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .invoice-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #007bff; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Invoice ${invoiceData.invoiceNumber || 'N/A'}</h1>
        </div>
        <div class="content">
          <p>Hello ${invoiceData.clientName || 'Client'},</p>
          <p>An invoice has been generated for ${invoiceData.projectTitle || 'your project'}:</p>
          <div class="invoice-details">
            <h3>Invoice Details</h3>
            <p><strong>Invoice Number:</strong> ${invoiceData.invoiceNumber || 'N/A'}</p>
            <p><strong>Issue Date:</strong> ${issueDate}</p>
            <p><strong>Due Date:</strong> ${dueDate}</p>
            <p><strong>Project:</strong> ${invoiceData.projectTitle || 'N/A'}</p>
            ${invoiceData.milestoneTitle ? `<p><strong>Milestone:</strong> ${invoiceData.milestoneTitle}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(invoiceData.lineItems || []).map(item => `
                <tr>
                  <td>${item.description || ''}</td>
                  <td>${item.quantity || ''}</td>
                  <td>RM${Number(item.rate || 0).toFixed(2)}</td>
                  <td>RM${Number(item.amount || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="text-align: right; margin-top: 20px;">
            <p><strong>Subtotal:</strong> RM${Number(subtotal).toFixed(2)}</p>
            ${taxAmount > 0 ? `<p><strong>Tax (${(taxRate * 100).toFixed(0)}%):</strong> RM${Number(taxAmount).toFixed(2)}</p>` : ''}
            <p style="font-size: 18px;"><strong>Total:</strong> RM${Number(totalAmount).toFixed(2)}</p>
          </div>
          ${invoiceData.paymentTerms ? `<p><strong>Payment Terms:</strong> ${invoiceData.paymentTerms}</p>` : ''}
          <p>Please find the invoice PDF attached to this email.</p>
          <p>You can also check your dashboard to view and pay the invoice.</p>
          <p>Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate follow-up email HTML template
function generateFollowUpEmailHTML(invoiceData, followUpType) {
  const dueDate = invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'N/A';
  const totalAmount = invoiceData.totalAmount || invoiceData.total || 0;
  const isOverdue = followUpType === 'overdue';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${isOverdue ? '#dc3545' : '#ffc107'}; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .invoice-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .button { display: inline-block; padding: 12px 24px; background-color: ${isOverdue ? '#dc3545' : '#ffc107'}; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isOverdue ? '⚠️ Invoice Overdue' : '💰 Payment Reminder'}</h1>
        </div>
        <div class="content">
          <p>Hello ${invoiceData.clientName || 'Client'},</p>
          <p>This is a ${isOverdue ? 'reminder that your invoice is overdue' : 'friendly reminder'} regarding your invoice:</p>
          <div class="invoice-details">
            <h3>Invoice ${invoiceData.invoiceNumber || 'N/A'}</h3>
            <p><strong>Project:</strong> ${invoiceData.projectTitle || 'N/A'}</p>
            <p><strong>Amount Due:</strong> RM${Number(totalAmount).toFixed(2)}</p>
            <p><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          <p>${isOverdue ? 'Please make payment as soon as possible to avoid any further action.' : 'Please make payment at your earliest convenience.'}</p>
          <p>Please check your dashboard to view the invoice.</p>
          <p>Thank you for your attention to this matter.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateProgressUpdateEmailHTML(updateData) {
  // If the new structure (comment, attachments) is present, use a simple template
  if (updateData.comment) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #e7f3ff; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Project Progress Update</h1>
            <p>Project: ${updateData.projectTitle}</p>
          </div>
          <div>
            <p>Hello,</p>
            <p>Your freelancer <strong>${updateData.freelancerName || ''}</strong> has posted a new update:</p>
            <blockquote style="background:#f8f9fa;padding:15px;border-left:4px solid #007bff;">${updateData.comment}</blockquote>
            ${updateData.attachments && updateData.attachments.length > 0 ? `<p>${updateData.attachments.length} attachment(s) included. Please check your dashboard to view them.</p>` : ''}
            <p>Please check your dashboard for more details.</p>
            <p>Best regards,<br>${updateData.freelancerName || ''}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  // Fallback to the old structure
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #e7f3ff; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .progress-item { background-color: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Project Progress Update</h1>
          <p>Project: ${updateData.projectTitle}</p>
        </div>
        <div>
          <p>Dear ${updateData.clientName || ''},</p>
          <p>I wanted to update you on the progress of your project <strong>${updateData.projectTitle}</strong>.</p>
          <h3>Recent Updates:</h3>
          ${updateData.updates && Array.isArray(updateData.updates) ? updateData.updates.map(update => `
            <div class="progress-item">
              <h4>${update.title}</h4>
              <p>${update.description}</p>
              <p><small>Status: ${update.status} | Completed: ${update.completionPercentage}%</small></p>
            </div>
          `).join('') : ''}
          <h3>Overall Progress:</h3>
          <p>Project is currently <strong>${updateData.overallProgress || 0}%</strong> complete.</p>
          <p>If you have any questions or would like to discuss any aspect of the project, please don't hesitate to contact me.</p>
          <p>Best regards,<br>${updateData.freelancerName || ''}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send milestone completion notification email to client
router.post('/milestone-completion', async (req, res) => {
  try {
    const { sendMilestoneCompletionEmail } = require('../services/emailService');
    const milestoneData = req.body;

    await sendMilestoneCompletionEmail(milestoneData);

    res.json({
      success: true,
      message: 'Milestone completion email sent successfully'
    });
  } catch (error) {
    console.error('Error sending milestone completion email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send payment received notification email to freelancer
router.post('/payment-received', async (req, res) => {
  try {
    const { sendPaymentReceivedEmail } = require('../services/emailService');
    const paymentData = req.body;

    await sendPaymentReceivedEmail(paymentData);

    res.json({
      success: true,
      message: 'Payment received email sent successfully'
    });
  } catch (error) {
    console.error('Error sending payment received email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
module.exports.sendInvoiceEmailWithPDF = sendInvoiceEmailWithPDF;
