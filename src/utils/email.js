const { Resend } = require('resend');

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const sendVerificationEmail = async (verifierEmail, token, itemTitle, userName, itemType = 'experience') => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify/${token}`;
  const dashboardUrl = `${process.env.FRONTEND_URL}/verifier/dashboard`;
  
  const itemTypeDisplay = itemType.toLowerCase().replace('_', ' ');
  
  const emailData = {
    from: process.env.FROM_EMAIL || 'TruePortMe <onboarding@resend.dev>',
    to: [verifierEmail],
    subject: `🔔 Verification Request: ${itemTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">TruePortMe</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Portfolio Verification System</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">New ${itemTypeDisplay.charAt(0).toUpperCase() + itemTypeDisplay.slice(1)} Verification Request</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.5;">Hello,</p>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            <strong>${userName}</strong> has requested you to verify their ${itemTypeDisplay}:
          </p>
          
          <!-- Item Card -->
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #495057; font-size: 18px;">${itemTitle}</h3>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="background: #007bff; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                ${itemType.replace('_', ' ')}
              </span>
              <span style="color: #6c757d; font-size: 14px;">• Requested by ${userName}</span>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; 
                      box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3); margin-right: 10px;">
              🔍 Review & Verify
            </a>
            <a href="${dashboardUrl}" 
               style="background: #6c757d; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              📊 Go to Dashboard
            </a>
          </div>
          
          <!-- Login Info -->
          <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h4 style="margin: 0 0 10px 0; color: #1976d2; font-size: 14px;">📋 Quick Access</h4>
            <p style="margin: 0; color: #1565c0; font-size: 14px;">
              The verification link above will take you directly to the review page. You can also access your verifier dashboard to see all pending requests.
            </p>
          </div>
          
          <!-- Expiry Notice -->
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              ⏰ <strong>Important:</strong> This verification link will expire in 72 hours.
            </p>
          </div>
          
          <!-- Manual Link -->
          <details style="margin: 20px 0;">
            <summary style="color: #007bff; cursor: pointer; font-size: 14px;">Can't click the button? Use manual link</summary>
            <div style="background: #f8f9fa; padding: 10px; margin-top: 10px; border-radius: 4px;">
              <code style="word-break: break-all; font-size: 12px; color: #495057;">${verificationUrl}</code>
            </div>
          </details>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 12px; margin: 0;">
            This email was sent by TruePortMe Portfolio Verification System.<br>
            If you believe this was sent in error, please ignore this email.
          </p>
        </div>
      </div>
    `
  };

  try {
    if (resend && process.env.RESEND_API_KEY) {
      const { data, error } = await resend.emails.send(emailData);
      
      if (error) {
        console.error('❌ Resend API error:', error);
        return false;
      }
      
      console.log(`✅ Verification email sent to ${verifierEmail} (ID: ${data.id})`);
    } else {
      // Fallback to console.log for development
      console.log('📧 Email would be sent (no Resend API key configured):');
      console.log(`To: ${verifierEmail}`);
      console.log(`Subject: ${emailData.subject}`);
      console.log(`Verification URL: ${verificationUrl}`);
    }
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return false;
  }
};

const sendVerificationDecisionEmail = async (studentEmail, itemTitle, itemType, status, comment, verifierName) => {
  const itemTypeDisplay = itemType.toLowerCase().replace('_', ' ');
  const statusColor = status === 'APPROVED' ? '#28a745' : '#dc3545';
  const statusText = status === 'APPROVED' ? 'Approved' : 'Rejected';
  
  const emailData = {
    from: process.env.FROM_EMAIL || 'TruePortMe <onboarding@resend.dev>',
    to: [studentEmail],
    subject: `Verification ${statusText}: ${itemTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${statusColor};">Verification ${statusText}</h2>
        <p>Hello,</p>
        <p>Your ${itemTypeDisplay} has been <strong style="color: ${statusColor};">${statusText.toLowerCase()}</strong> by ${verifierName}:</p>
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin: 0; color: #555;">${itemTitle}</h3>
        </div>
        ${comment ? `
          <div style="background-color: #e9ecef; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid ${statusColor};">
            <h4 style="margin: 0 0 10px 0; color: #333;">Verifier Comments:</h4>
            <p style="margin: 0; color: #555;">${comment}</p>
          </div>
        ` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/portfolio" 
             style="background-color: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            View Your Portfolio
          </a>
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          This email was sent by TruePortMe.
        </p>
      </div>
    `
  };

  try {
    if (resend && process.env.RESEND_API_KEY) {
      const { data, error } = await resend.emails.send(emailData);
      
      if (error) {
        console.error('❌ Resend API error:', error);
        return false;
      }
      
      console.log(`✅ Verification decision email sent to ${studentEmail} (ID: ${data.id})`);
    } else {
      // Fallback to console.log for development
      console.log('📧 Decision email would be sent (no Resend API key configured):');
      console.log(`To: ${studentEmail}`);
      console.log(`Subject: ${emailData.subject}`);
      console.log(`Status: ${status}`);
    }
    return true;
  } catch (error) {
    console.error('❌ Decision email sending failed:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendVerificationDecisionEmail
};