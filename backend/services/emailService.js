const nodemailer = require('nodemailer');
const { generateOTPEmailHTML, generatePasswordResetEmailHTML, generatePasswordResetOTPEmailHTML, generateInvitationEmailHTML, generateDeadlineEmailHTML } = require('../utils/emailTemplates');

// Centralized email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Generic email sender
async function sendEmail(mailOptions) {
  try {
    const result = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: result.messageId,
      result: result
    };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Send OTP email
async function sendOTPEmail(email, otp, fullName = '', context = 'login') {
  const subject = context === 'registration' 
    ? 'Verify Your Email - Registration' 
    : 'Your Login Verification Code';
    
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: email,
    subject: subject,
    html: generateOTPEmailHTML(otp, email, fullName, context)
  };

  return await sendEmail(mailOptions);
}

// Send password reset email (link-based)
async function sendPasswordResetEmail(email, resetLink) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: email,
    subject: 'Password Reset Request',
    html: generatePasswordResetEmailHTML(resetLink)
  };

  return await sendEmail(mailOptions);
}

// Send password reset OTP email
async function sendPasswordResetOTPEmail(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: email,
    subject: '🔐 Password Reset Verification Code',
    html: generatePasswordResetOTPEmailHTML(otp, email)
  };

  return await sendEmail(mailOptions);
}

// Send invitation email
async function sendInvitationEmail(invitationData) {
  const { email, invitationLink, projectTitle, freelancerName, clientName } = invitationData;
  
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: email,
    subject: `Project Invitation: ${projectTitle}`,
    html: generateInvitationEmailHTML({
      invitationLink,
      projectTitle,
      freelancerName,
      clientName
    })
  };

  return await sendEmail(mailOptions);
}

// Send invitation acceptance email
async function sendInvitationAcceptanceEmail(freelancerEmail, projectTitle, clientName) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@freelancedash.com',
    to: freelancerEmail,
    subject: `Invitation Accepted: ${projectTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Invitation Accepted!</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Great news! <strong>${clientName}</strong> has accepted your invitation for the project:</p>
            <p><strong>${projectTitle}</strong></p>
            <p>You can now start working on this project. Please check your dashboard to get started.</p>
            <p>Good luck with your project!</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
}

// Send invitation rejection email
async function sendInvitationRejectionEmail(freelancerEmail, projectTitle, clientName, reason) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@freelancedash.com',
    to: freelancerEmail,
    subject: `Invitation Declined: ${projectTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invitation Declined</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${clientName}</strong> has declined your invitation for the project:</p>
            <p><strong>${projectTitle}</strong></p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>Thank you for your interest. We hope to work with you in the future.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
}

// Send deadline notification email
async function sendDeadlineNotificationEmail(projectData, notificationType = 'approaching') {
  const { clientEmail, clientName, title, deadline } = projectData;
  const isOverdue = notificationType === 'overdue';
  
  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@freelancedash.com',
    to: clientEmail,
    subject: isOverdue 
      ? `⚠️ Project Overdue: ${title}` 
      : `⏰ Deadline Approaching: ${title}`,
    html: generateDeadlineEmailHTML(projectData, notificationType)
  };

  return await sendEmail(mailOptions);
}

// Send progress update email (simple wrapper)
async function sendProgressUpdateEmail(updateData) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: updateData.to,
    subject: `Progress Update for Project: ${updateData.projectTitle}`,
    html: `
      <h2>Progress Update</h2>
      <p><strong>Project:</strong> ${updateData.projectTitle}</p>
      <p><strong>Freelancer:</strong> ${updateData.freelancerName || 'A freelancer'}</p>
      <p><strong>Update:</strong></p>
      <p>${updateData.updateText}</p>
      <p>Please check your dashboard for more details.</p>
    `
  };

  return await sendEmail(mailOptions);
}

// Send milestone completion email to client
async function sendMilestoneCompletionEmail(milestoneData) {
  const { clientEmail, clientName, projectTitle, milestoneTitle, freelancerName, evidence, evidenceFiles } = milestoneData;
  
  const hasAttachments = evidenceFiles && evidenceFiles.length > 0;
  
  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@freelancedash.com',
    to: clientEmail,
    subject: `✅ Milestone Completed: ${milestoneTitle} - ${projectTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .milestone-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .evidence-box { background-color: #e8f5e9; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Milestone Completed!</h1>
          </div>
          <div class="content">
            <p>Hello ${clientName || 'Client'},</p>
            <p><strong>${freelancerName}</strong> has completed a milestone and is awaiting your approval:</p>
            
            <div class="milestone-info">
              <h3>${milestoneTitle}</h3>
              <p><strong>Project:</strong> ${projectTitle}</p>
            </div>

            ${evidence ? `
              <div class="evidence-box">
                <h4>Work Evidence:</h4>
                <p>${evidence}</p>
              </div>
            ` : ''}

            ${hasAttachments ? `
              <p><strong>📎 Attachments:</strong> ${evidenceFiles.length} file(s) included</p>
            ` : ''}

            <p style="margin-top: 20px;">Please review the work and approve or request revisions in your dashboard.</p>

            <p style="margin-top: 20px; color: #666; font-size: 14px;">
              💡 You can approve the milestone or request revisions (up to 2 revisions allowed per milestone).
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from FreelanceDash</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
}

// Send payment received email to freelancer
async function sendPaymentReceivedEmail(paymentData) {
  const { freelancerEmail, freelancerName, amount, projectTitle, invoiceNumber, clientName, paymentDate } = paymentData;
  
  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@freelancedash.com',
    to: freelancerEmail,
    subject: `💰 Payment Received: ${invoiceNumber} - ${projectTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .payment-box { background-color: white; padding: 20px; margin: 15px 0; border-left: 4px solid #2196F3; }
          .amount { font-size: 32px; color: #2196F3; font-weight: bold; margin: 10px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Payment Received!</h1>
          </div>
          <div class="content">
            <p>Hello ${freelancerName},</p>
            <p>Great news! A payment has been received from <strong>${clientName || 'your client'}</strong>:</p>
            
            <div class="payment-box">
              <p><strong>Invoice:</strong> ${invoiceNumber}</p>
              <p><strong>Project:</strong> ${projectTitle}</p>
              <div class="amount">RM ${Number(amount).toFixed(2)}</div>
              <p><strong>Payment Date:</strong> ${new Date(paymentDate).toLocaleDateString()}</p>
            </div>

            <p>The funds have been credited to your account. Please check your dashboard to view the details.</p>

            <p style="margin-top: 20px; color: #666; font-size: 14px;">
              🎉 Thank you for your excellent work! Keep delivering quality service.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from FreelanceDash</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
}

// Send milestone approval email to freelancer
async function sendMilestoneApprovalEmail(data) {
  const { freelancerEmail, freelancerName, projectTitle, milestoneTitle, clientName, invoiceGenerated } = data;
  
  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@freelancedash.com',
    to: freelancerEmail,
    subject: `✅ Milestone Approved: ${milestoneTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; }
          .milestone-box { background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Milestone Approved!</h1>
          </div>
          <div class="content">
            <p>Hello ${freelancerName},</p>
            
            <p>Great news! <strong>${clientName}</strong> has approved your milestone:</p>
            
            <div class="milestone-box">
              <h3 style="margin: 0; color: #10b981;">${milestoneTitle}</h3>
              <p style="margin: 5px 0 0 0; color: #666;">Project: ${projectTitle}</p>
            </div>

            ${invoiceGenerated ? '<p>🎉 An invoice has been automatically generated and sent to the client for payment.</p>' : ''}
            
            <p>You can view the details in your dashboard.</p>

            <p style="margin-top: 20px; color: #666; font-size: 14px;">
              Keep up the excellent work! 🚀
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from FreelanceDash</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
}

// Send comment notification email
async function sendCommentNotificationEmail(data) {
  const { projectId, recipientEmail, commenterName, commenterRole, commentText, projectTitle } = data;
  
  const isClientCommenting = commenterRole === 'client';
  const recipientRole = isClientCommenting ? 'freelancer' : 'client';
  
  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@freelancedash.com',
    to: recipientEmail,
    subject: `💬 New Comment on ${projectTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; }
          .comment-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 New Comment</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            
            <p><strong>${commenterName}</strong> ${isClientCommenting ? '(Client)' : '(Freelancer)'} commented on <strong>${projectTitle}</strong>:</p>
            
            <div class="comment-box">
              <p style="margin: 0; white-space: pre-wrap;">${commentText}</p>
            </div>
            
            <p>Please check your dashboard to view and reply.</p>
          </div>
          <div class="footer">
            <p>This is an automated notification from FreelanceDash</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
}

module.exports = {
  transporter,
  sendEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendPasswordResetOTPEmail,
  sendInvitationEmail,
  sendInvitationAcceptanceEmail,
  sendInvitationRejectionEmail,
  sendDeadlineNotificationEmail,
  sendProgressUpdateEmail,
  sendMilestoneCompletionEmail,
  sendMilestoneApprovalEmail,
  sendCommentNotificationEmail,
  sendPaymentReceivedEmail
};

