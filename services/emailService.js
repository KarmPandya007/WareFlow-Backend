import { transporter } from '../config/emailConfig.js';
import { salesPersonCredentialsEmail } from '../utils/emailTemplates.js';

export const sendCredentialsEmail = async (email, firstName, phone, pin, branchName) => {
  try {
    const emailContent = salesPersonCredentialsEmail(firstName, phone, pin, branchName);
    
    const mailOptions = {
      from: `"Your Company" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};