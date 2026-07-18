import Target from "../models/target.js";
import User from "../models/User.js";
import { transporter } from "../config/emailConfig.js";
import { sendWhatsAppAdminText } from "./whatsappCloudService.js";

// Build target reminder message
const buildTargetReminderMessage = (user, targets) => {
  const userName = `${user.firstName} ${user.lastName || ""}`.trim();
  
  let message = `🎯 Weekly Target Reminder\n\nHello ${userName},\n\nHere's your target progress update:\n\n`;

  targets.forEach((target, index) => {
    const progress = target.targetValue > 0 
      ? Math.round((target.currentValue / target.targetValue) * 100) 
      : 0;
    
    const remaining = target.targetValue - target.currentValue;
    const daysLeft = Math.ceil((new Date(target.endDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    let targetTypeLabel = "";
    if (target.targetType === "billing_amount") {
      targetTypeLabel = "Sales Amount";
    } else if (target.targetType === "billing_count") {
      targetTypeLabel = "Number of Invoices";
    } else {
      targetTypeLabel = target.targetType;
    }

    message += `${index + 1}. ${targetTypeLabel} (${target.period})\n`;
    message += `   Target: ${target.targetType === "billing_amount" ? "₹" : ""}${target.targetValue}\n`;
    message += `   Achieved: ${target.targetType === "billing_amount" ? "₹" : ""}${target.currentValue}\n`;
    message += `   Progress: ${progress}%\n`;
    message += `   Remaining: ${target.targetType === "billing_amount" ? "₹" : ""}${remaining}\n`;
    message += `   Days Left: ${daysLeft > 0 ? daysLeft : "Overdue"}\n`;
    message += `   Status: ${target.status.toUpperCase()}\n\n`;
  });

  message += `Keep up the great work! 💪\n\nBest regards,\nYour Team`;
  
  return message;
};

// Build HTML email for target reminder
const buildTargetReminderEmail = (user, targets) => {
  const userName = `${user.firstName} ${user.lastName || ""}`.trim();
  
  let targetRows = "";
  targets.forEach((target) => {
    const progress = target.targetValue > 0 
      ? Math.round((target.currentValue / target.targetValue) * 100) 
      : 0;
    
    const remaining = target.targetValue - target.currentValue;
    const daysLeft = Math.ceil((new Date(target.endDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    let targetTypeLabel = "";
    if (target.targetType === "billing_amount") {
      targetTypeLabel = "Sales Amount";
    } else if (target.targetType === "billing_count") {
      targetTypeLabel = "Number of Invoices";
    } else {
      targetTypeLabel = target.targetType;
    }

    const statusColor = target.status === "completed" ? "#4CAF50" : 
                       target.status === "overdue" ? "#f44336" : "#2196F3";
    
    const progressColor = progress >= 75 ? "#4CAF50" : 
                         progress >= 50 ? "#FF9800" : "#f44336";

    targetRows += `
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 15px; font-weight: 500;">${targetTypeLabel}</td>
        <td style="padding: 15px;">${target.targetType === "billing_amount" ? "₹" : ""}${target.targetValue.toLocaleString()}</td>
        <td style="padding: 15px;">${target.targetType === "billing_amount" ? "₹" : ""}${target.currentValue.toLocaleString()}</td>
        <td style="padding: 15px;">
          <div style="background: #f0f0f0; border-radius: 10px; height: 20px; overflow: hidden;">
            <div style="background: ${progressColor}; width: ${progress}%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
              ${progress}%
            </div>
          </div>
        </td>
        <td style="padding: 15px;">${daysLeft > 0 ? daysLeft + " days" : "Overdue"}</td>
        <td style="padding: 15px;">
          <span style="background: ${statusColor}; color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-weight: bold;">
            ${target.status.toUpperCase()}
          </span>
        </td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎯 Weekly Target Reminder</h1>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${userName}</strong>,</p>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
          Here's your weekly target progress update. Keep pushing towards your goals! 💪
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 15px; text-align: left; font-weight: 600;">Target Type</th>
              <th style="padding: 15px; text-align: left; font-weight: 600;">Goal</th>
              <th style="padding: 15px; text-align: left; font-weight: 600;">Achieved</th>
              <th style="padding: 15px; text-align: left; font-weight: 600;">Progress</th>
              <th style="padding: 15px; text-align: left; font-weight: 600;">Time Left</th>
              <th style="padding: 15px; text-align: left; font-weight: 600;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${targetRows}
          </tbody>
        </table>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 30px;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            <strong>💡 Tip:</strong> Stay focused and consistent. Small daily progress leads to big achievements!
          </p>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          Best regards,<br>
          <strong>Your Team</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
        <p>This is an automated reminder. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;
};

// Send weekly target reminders to all users with active targets
export const sendWeeklyTargetReminders = async () => {
  try {
    console.log("📧 Starting weekly target reminder process...");

    // Get all active targets
    const activeTargets = await Target.find({
      status: { $in: ["active", "overdue"] },
    }).populate("user", "firstName lastName email phone");

    if (!activeTargets || activeTargets.length === 0) {
      console.log("No active targets found. Skipping reminders.");
      return { success: true, message: "No active targets to remind" };
    }

    // Group targets by user
    const userTargetsMap = {};
    activeTargets.forEach((target) => {
      const userId = target.user._id.toString();
      if (!userTargetsMap[userId]) {
        userTargetsMap[userId] = {
          user: target.user,
          targets: [],
        };
      }
      userTargetsMap[userId].targets.push(target);
    });

    let emailsSent = 0;
    let whatsappSent = 0;
    let errors = 0;

    // Send reminders to each user
    for (const userId in userTargetsMap) {
      const { user, targets } = userTargetsMap[userId];

      // Send Email
      if (user.email) {
        try {
          const emailHtml = buildTargetReminderEmail(user, targets);
          const emailText = buildTargetReminderMessage(user, targets);

          await transporter.sendMail({
            from: `"Target Reminder" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "🎯 Weekly Target Progress Update",
            html: emailHtml,
            text: emailText,
          });

          emailsSent++;
          console.log(`✅ Email sent to ${user.email}`);
        } catch (emailError) {
          console.error(`❌ Email failed for ${user.email}:`, emailError.message);
          errors++;
        }
      }

      // Send WhatsApp (if phone exists)
      if (user.phone) {
        try {
          const whatsappMessage = buildTargetReminderMessage(user, targets);
          const phoneNumber = user.phone.startsWith("91") ? user.phone : `91${user.phone}`;
          
          await sendWhatsAppAdminText(phoneNumber, whatsappMessage);
          
          whatsappSent++;
          console.log(`✅ WhatsApp sent to ${phoneNumber}`);
        } catch (whatsappError) {
          console.error(`❌ WhatsApp failed for ${user.phone}:`, whatsappError.message);
          errors++;
        }
      }
    }

    const summary = {
      success: true,
      totalUsers: Object.keys(userTargetsMap).length,
      emailsSent,
      whatsappSent,
      errors,
      message: `Reminders sent: ${emailsSent} emails, ${whatsappSent} WhatsApp messages`,
    };

    console.log("📊 Weekly reminder summary:", summary);
    return summary;
  } catch (error) {
    console.error("❌ Weekly reminder error:", error);
    return { success: false, error: error.message };
  }
};
