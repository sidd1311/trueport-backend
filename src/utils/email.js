const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const sendVerificationEmail = async (verifierEmail, token, itemTitle, userName, itemType = 'experience') => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify/${token}`;
  
  const itemTypeDisplay = itemType.toLowerCase().replace('_', ' ');
  
  const msg = {
    to: verifierEmail,
    from: process.env.FROM_EMAIL || 'noreply@trueportme.com',
    subject: `Verification Request: ${itemTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${itemTypeDisplay.charAt(0).toUpperCase() + itemTypeDisplay.slice(1)} Verification Request</h2>
        <p>Hello,</p>
        <p><strong>${userName}</strong> has requested you to verify their ${itemTypeDisplay}:</p>
        <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin: 0; color: #555;">${itemTitle}</h3>
        </div>
        <p>Please click the button below to review and verify this ${itemTypeDisplay}:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Review & Verify
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          This verification link will expire in 72 hours.<br>
          If you're unable to click the button, copy and paste this URL into your browser:<br>
          <code>${verificationUrl}</code>
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          This email was sent by TruePortMe. If you believe this was sent in error, please ignore this email.
        </p>
      </div>
    `
  };

  try {
    if (process.env.SENDGRID_API_KEY) {
      await sgMail.send(msg);
      console.log(`✅ Verification email sent to ${verifierEmail}`);
    } else {
      // Fallback to console.log for development
      console.log('📧 Email would be sent (no SendGrid configured):');
      console.log(`To: ${verifierEmail}`);
      console.log(`Subject: ${msg.subject}`);
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
  
  const msg = {
    to: studentEmail,
    from: process.env.FROM_EMAIL || 'noreply@trueportme.com',
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
    if (process.env.SENDGRID_API_KEY) {
      await sgMail.send(msg);
      console.log(`✅ Verification decision email sent to ${studentEmail}`);
    } else {
      // Fallback to console.log for development
      console.log('📧 Decision email would be sent (no SendGrid configured):');
      console.log(`To: ${studentEmail}`);
      console.log(`Subject: ${msg.subject}`);
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