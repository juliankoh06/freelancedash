// OTP Email Template
function generateOTPEmailHTML(otp, email, fullName = '', context = 'login') {
  const isRegistration = context === 'registration';
  const greeting = fullName ? `Hello ${fullName},` : 'Hello,';
  const title = isRegistration ? 'Verify Your Email' : 'Your Login Code';
  const message = isRegistration 
    ? 'Thank you for registering! Please verify your email address with this code:'
    : 'Your One-Time Password (OTP) for login is:';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .otp-box { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center; }
        .otp-code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="content">
          <p>${greeting}</p>
          <p>${message}</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          ${isRegistration ? '<p>After verification, you can start using your account!</p>' : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}

// Password Reset Email Template (link-based - for production)
function generatePasswordResetEmailHTML(resetLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>You requested to reset your password.</p>
          <p><a href="${resetLink}" class="button">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Password Reset OTP Email Template
function generatePasswordResetOTPEmailHTML(otp, email) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container { 
          max-width: 600px; 
          margin: 40px auto; 
          background-color: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          color: white; 
          padding: 40px 20px; 
          text-align: center; 
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header-icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .content { 
          background-color: #ffffff; 
          padding: 40px 30px; 
        }
        .content p {
          margin: 15px 0;
          font-size: 15px;
          color: #555;
        }
        .otp-box { 
          background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
          padding: 30px; 
          margin: 30px 0; 
          border-radius: 10px; 
          text-align: center;
          border: 2px dashed #dc3545;
        }
        .otp-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
        }
        .otp-code { 
          font-size: 42px; 
          font-weight: bold; 
          color: #dc3545; 
          letter-spacing: 12px;
          font-family: 'Courier New', monospace;
          margin: 10px 0;
        }
        .info-box {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .info-box p {
          margin: 5px 0;
          color: #856404;
          font-size: 14px;
        }
        .security-notice {
          background-color: #f8f9fa;
          padding: 20px;
          margin-top: 30px;
          border-radius: 8px;
          border-left: 4px solid #6c757d;
        }
        .security-notice h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
          color: #495057;
        }
        .security-notice ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .security-notice li {
          margin: 5px 0;
          font-size: 13px;
          color: #6c757d;
        }
        .footer { 
          text-align: center; 
          padding: 30px 20px; 
          background-color: #f8f9fa;
          color: #6c757d; 
          font-size: 13px; 
        }
        .footer p {
          margin: 5px 0;
        }
        .divider {
          height: 1px;
          background: linear-gradient(to right, transparent, #dee2e6, transparent);
          margin: 30px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-icon">🔐</div>
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>We received a request to reset the password for your FreelanceDash account associated with <strong>${email}</strong>.</p>
          
          <p>To proceed with resetting your password, please use the verification code below:</p>
          
          <div class="otp-box">
            <div class="otp-label">Your Verification Code</div>
            <div class="otp-code">${otp}</div>
          </div>

          <div class="info-box">
            <p><strong>⏱️ Important:</strong> This code will expire in <strong>10 minutes</strong>.</p>
            <p>Enter this code on the password reset page to create your new password.</p>
          </div>

          <div class="divider"></div>

          <div class="security-notice">
            <h3>🛡️ Security Tips</h3>
            <ul>
              <li>Never share this code with anyone</li>
              <li>FreelanceDash staff will never ask for your verification code</li>
              <li>If you didn't request this reset, please ignore this email and your password will remain unchanged</li>
              <li>Consider enabling two-factor authentication for added security</li>
            </ul>
          </div>

          <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
            If you did not request a password reset, please disregard this email or contact our support team if you have concerns.
          </p>
        </div>
        <div class="footer">
          <p><strong>FreelanceDash</strong> - Freelance Project Management Platform</p>
          <p>This is an automated message, please do not reply to this email.</p>
          <p style="margin-top: 15px; font-size: 12px;">© 2025 FreelanceDash. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Invitation Email Template
function generateInvitationEmailHTML(invitationData) {
  const { invitationLink, projectTitle, freelancerName, clientName } = invitationData;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Project Invitation</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p><strong>${freelancerName || 'A freelancer'}</strong> has invited you to collaborate on a project:</p>
          <p><strong>${projectTitle}</strong></p>
          <p>Please check your dashboard to view the invitation and contract details.</p>
          <p>This invitation will expire in 7 days.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Deadline Notification Email Template
function generateDeadlineEmailHTML(projectData, notificationType = 'approaching') {
  const { title, deadline, clientName } = projectData;
  const isOverdue = notificationType === 'overdue';
  const deadlineDate = deadline ? new Date(deadline).toLocaleDateString() : 'N/A';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${isOverdue ? '#dc3545' : '#ffc107'}; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .project-details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isOverdue ? '⚠️ Project Overdue' : '⏰ Deadline Approaching'}</h1>
        </div>
        <div class="content">
          <p>Hello ${clientName || 'Client'},</p>
          <p>This is a notification regarding your project:</p>
          <div class="project-details">
            <h3>${title}</h3>
            <p><strong>Deadline:</strong> ${deadlineDate}</p>
            <p><strong>Status:</strong> ${isOverdue ? 'Overdue' : 'Approaching Deadline'}</p>
          </div>
          <p>${isOverdue ? 'The project deadline has passed. Please contact your freelancer to discuss the status.' : 'Your project deadline is approaching soon. Please ensure all requirements are communicated to your freelancer.'}</p>
          <p>Please check your dashboard to view project details.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  generateOTPEmailHTML,
  generatePasswordResetEmailHTML,
  generatePasswordResetOTPEmailHTML,
  generateInvitationEmailHTML,
  generateDeadlineEmailHTML
};

