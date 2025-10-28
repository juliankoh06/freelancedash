const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { db } = require('../firebase-admin');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});


// Send invoice email
router.post('/send-invoice', async (req, res) => {
  try {
    const { invoiceId, clientEmail, invoiceData } = req.body;

    const attachments = invoiceData.pdfAttachment ? [{
      filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
      content: invoiceData.pdfAttachment,
      encoding: 'base64',
      contentType: 'application/pdf'
    }] : [];

    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: clientEmail,
      subject: `Invoice ${invoiceData.invoiceNumber} - ${invoiceData.projectTitle}`,
      html: generateInvoiceEmailHTML(invoiceData),
      attachments: attachments
    };

    const result = await transporter.sendMail(mailOptions);
    
    // Update invoice status if invoice exists in database
    try {
      const invoiceRef = db.collection('invoices').doc(invoiceId);
      const invoiceDoc = await invoiceRef.get();
      
      if (invoiceDoc.exists) {
        await invoiceRef.update({
          status: 'sent',
          sentAt: new Date(),
          emailMessageId: result.messageId
        });
      } else {
        console.log('⚠️ Invoice not found in database, skipping status update');
      }
    } catch (updateError) {
      console.log('⚠️ Could not update invoice status:', updateError.message);
    }

    res.json({ 
      success: true, 
      messageId: result.messageId,
      message: 'Invoice sent successfully' 
    });
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

// Send invitation email
router.post('/send-invitation', async (req, res) => {
  try {
    const { clientEmail, invitationLink, projectTitle, freelancerName, freelancerEmail } = req.body;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: clientEmail,
      subject: `You're invited to collaborate on "${projectTitle}"`,
      html: generateInvitationEmailHTML({
        clientEmail,
        invitationLink,
        projectTitle,
        freelancerName,
        freelancerEmail
      })
    };

    const result = await transporter.sendMail(mailOptions);
    
    // Log invitation email (optional - skip if Firebase not configured)
    try {
      if (db) {
        await db.collection('email_logs').add({
          type: 'invitation',
          sentAt: new Date(),
          emailMessageId: result.messageId,
          clientEmail,
          projectTitle,
          freelancerName
        });
      }
    } catch (logError) {
      console.warn('⚠️ Could not log invitation email to Firestore:', logError.message);
    }

    res.json({ 
      success: true, 
      messageId: result.messageId,
      message: 'Invitation email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending invitation email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send progress update notification
router.post('/send-progress-update', async (req, res) => {
  try {
    const { projectId, clientEmail, updateData } = req.body;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: clientEmail,
      subject: `Project Update: ${updateData.projectTitle}`,
      html: generateProgressUpdateEmailHTML(updateData)
    };

    const result = await transporter.sendMail(mailOptions);
    
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

// Email template generators
function generateInvoiceEmailHTML(invoiceData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .invoice-details { background-color: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
        .total { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }
        .button { background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Invoice ${invoiceData.invoiceNumber}</h1>
          <p>Project: ${invoiceData.projectTitle}</p>
        </div>
        
        <div class="invoice-details">
          <p>Dear ${invoiceData.clientName},</p>
          <p>Please find attached your invoice for the work completed on <strong>${invoiceData.projectTitle}</strong>.</p>
          <p><strong>📎 A downloadable PDF copy of this invoice is attached to this email.</strong></p>
          
          <h3>Invoice Summary:</h3>
          <ul>
            <li>Invoice Number: ${invoiceData.invoiceNumber}</li>
            <li>Date: ${new Date(invoiceData.issueDate || invoiceData.date).toLocaleDateString()}</li>
            <li>Due Date: ${new Date(invoiceData.dueDate).toLocaleDateString()}</li>
            <li>Total Amount: ${invoiceData.currency || 'RM'} ${Number(invoiceData.totalAmount || invoiceData.total || 0).toFixed(2)}</li>
          </ul>
          
          <div class="total">
            <h3>Payment Details:</h3>
            <p><strong>Total Due: ${invoiceData.currency || 'RM'} ${Number(invoiceData.totalAmount || invoiceData.total || 0).toFixed(2)}</strong></p>
            <p>Please remit payment by the due date to avoid any late fees.</p>
          </div>
          
          <p>If you have any questions about this invoice, please don't hesitate to contact me.</p>
          <p>Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateFollowUpEmailHTML(invoiceData, followUpType) {
  const urgency = followUpType === 'overdue' ? 'urgent' : 'friendly';
  const subject = followUpType === 'overdue' ? 'Overdue Payment' : 'Payment Reminder';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${followUpType === 'overdue' ? '#f8d7da' : '#d1ecf1'}; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .urgent { color: #721c24; }
        .reminder { color: #0c5460; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="${urgency}">${subject}</h1>
          <p>Invoice: ${invoiceData.invoiceNumber}</p>
        </div>
        
        <div>
          <p>Dear ${invoiceData.clientName},</p>
          <p>This is a ${followUpType === 'overdue' ? 'friendly reminder' : 'gentle reminder'} regarding your outstanding invoice <strong>${invoiceData.invoiceNumber}</strong> for the project <strong>${invoiceData.projectTitle}</strong>.</p>
          
          <p><strong>Amount Due: ${invoiceData.currency || 'RM'} ${Number(invoiceData.totalAmount || invoiceData.total || 0).toFixed(2)}</strong></p>
          <p>Due Date: ${new Date(invoiceData.dueDate).toLocaleDateString()}</p>
          
          ${followUpType === 'overdue' ? 
            '<p class="urgent"><strong>This invoice is now overdue. Please remit payment as soon as possible to avoid any additional charges.</strong></p>' :
            '<p>Please remit payment by the due date to avoid any late fees.</p>'
          }
          
          <p>If you have already made this payment, please disregard this notice. If you have any questions or concerns, please contact me immediately.</p>
          
          <p>Thank you for your prompt attention to this matter.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateInvitationEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
        .content { background-color: #fff; border: 1px solid #ddd; padding: 30px; border-radius: 10px; }
        .button { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; margin: 20px 0; font-weight: bold; text-align: center; }
        .button:hover { opacity: 0.9; }
        .features { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .feature-item { margin: 10px 0; padding-left: 20px; position: relative; }
        .feature-item:before { content: "✓"; position: absolute; left: 0; color: #28a745; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 You're Invited to Collaborate!</h1>
          <p>Join a professional project management platform</p>
        </div>
        
        <div class="content">
          <p>Hello!</p>
          
          <p><strong>${data.freelancerName}</strong> has invited you to collaborate on the project:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h2 style="margin: 0; color: #333;">${data.projectTitle}</h2>
            <p style="margin: 10px 0 0 0; color: #666;">Project collaboration invitation</p>
          </div>
          
          <p>This invitation gives you access to:</p>
          
          <div class="features">
            <div class="feature-item">Real-time project progress tracking</div>
            <div class="feature-item">Direct communication with your freelancer</div>
            <div class="feature-item">Secure file sharing and collaboration</div>
            <div class="feature-item">Transparent billing and time tracking</div>
            <div class="feature-item">Professional project management tools</div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.invitationLink}" class="button">Accept Invitation & Get Started</a>
          </div>
          
          <p><strong>What happens next?</strong></p>
          <ol>
            <li>Click the button above to accept the invitation</li>
            <li>Create a simple account (just email and password)</li>
            <li>Start collaborating on your project immediately</li>
          </ol>
          
          <p>This invitation will expire in 7 days. If you have any questions, you can contact ${data.freelancerName} directly at ${data.freelancerEmail}.</p>
          
          <p>Best regards,<br><strong>The FreelanceDash Team</strong></p>
        </div>
        
        <div class="footer">
          <p>This invitation was sent to ${data.clientEmail}</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateProgressUpdateEmailHTML(updateData) {
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
          <p>Dear ${updateData.clientName},</p>
          <p>I wanted to update you on the progress of your project <strong>${updateData.projectTitle}</strong>.</p>
          
          <h3>Recent Updates:</h3>
          ${updateData.updates.map(update => `
            <div class="progress-item">
              <h4>${update.title}</h4>
              <p>${update.description}</p>
              <p><small>Status: ${update.status} | Completed: ${update.completionPercentage}%</small></p>
            </div>
          `).join('')}
          
          <h3>Overall Progress:</h3>
          <p>Project is currently <strong>${updateData.overallProgress}%</strong> complete.</p>
          
          <p>If you have any questions or would like to discuss any aspect of the project, please don't hesitate to contact me.</p>
          
          <p>Best regards,<br>${updateData.freelancerName}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;
