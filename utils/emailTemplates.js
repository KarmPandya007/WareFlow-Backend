export const salesPersonCredentialsEmail = (firstName, phone, pin, branch) => {
  return {
    subject: 'Welcome! Your Account Credentials',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .credentials { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #3b82f6; }
          .credential-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .credential-label { font-weight: bold; color: #6b7280; }
          .credential-value { color: #1f2937; font-family: monospace; font-size: 16px; }
          .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Our Team!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${firstName}</strong>,</p>
            <p>Your sales person account has been successfully created by the administrator. Below are your login credentials:</p>
            
            <div class="credentials">
              <div class="credential-row">
                <span class="credential-label">Phone Number:</span>
                <span class="credential-value">${phone}</span>
              </div>
              <div class="credential-row">
                <span class="credential-label">PIN:</span>
                <span class="credential-value">${pin}</span>
              </div>
              <div class="credential-row">
                <span class="credential-label">Branch:</span>
                <span class="credential-value">${branch}</span>
              </div>
            </div>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>Please keep your credentials confidential</li>
                <li>Do not share your PIN with anyone</li>
                <li>Change your PIN after first login (if applicable)</li>
              </ul>
            </div>

            <p>You can now log in to the system using your phone number and PIN.</p>
            
            <center>
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/" class="button">
                Login to Your Account
              </a>
            </center>

            <p>If you have any questions or need assistance, please contact your administrator.</p>
            
            <p>Best regards,<br><strong>Admin Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Welcome ${firstName}!

Your sales person account has been created. Here are your login credentials:

Phone Number: ${phone}
PIN: ${pin}
Branch: ${branch}

Security Notice:
- Keep your credentials confidential
- Do not share your PIN with anyone
- Change your PIN after first login (if applicable)

You can now log in to the system using your phone number and PIN.

If you have any questions, please contact your administrator.

Best regards,
Admin Team
    `.trim(),
  };
};
