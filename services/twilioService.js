// services/twilioService.js
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export const sendWhatsAppText = async (to, message) => {
  if (!to || !message) throw new Error("Missing recipient or message");

  // Normalize number (remove 'whatsapp:' and all leading +)
  let numOnly = to.replace(/^whatsapp:/, "").replace(/^\++/, "");
  // Add country code if not present (for India)
  if (!numOnly.startsWith("91")) {
    numOnly = "91" + numOnly;
  }
  let formattedTo = `whatsapp:+${numOnly}`;

  const formattedFrom = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;

  try {
    console.log("📤 Sending WhatsApp message:", { 
      to: formattedTo, 
      from: formattedFrom, 
      messageLength: message.length,
      preview: message.substring(0, 100) + "..." 
    });
    
    const res = await client.messages.create({
      from: formattedFrom,
      to: formattedTo,
      body: message,
    });

    console.log(`✅ WhatsApp message sent to ${to}`);
    console.log(`   SID: ${res.sid}`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Error Code: ${res.errorCode || 'None'}`);
    console.log(`   Error Message: ${res.errorMessage || 'None'}`);
    
    // Check for delivery status after a short delay
    setTimeout(async () => {
      try {
        const messageStatus = await client.messages(res.sid).fetch();
        console.log(`📊 Message ${res.sid} status update: ${messageStatus.status}`);
        if (messageStatus.errorCode) {
          console.log(`❌ Delivery error: ${messageStatus.errorCode} - ${messageStatus.errorMessage}`);
        }
      } catch (statusError) {
        console.log(`⚠️ Could not fetch message status: ${statusError.message}`);
      }
    }, 5000); // Check after 5 seconds
    
    return res;
  } catch (error) {
    console.error("❌ WhatsApp send error:", {
      message: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
      status: error.status,
      to: formattedTo,
      from: formattedFrom
    });
    throw error;
  }
};

export const sendWhatsAppTemplate = async (to, contentSid, variables = {}) => {
  if (!to || !contentSid) throw new Error("Missing recipient or contentSid");

  const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const formattedFrom = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;

  try {
    console.log("📤 Sending WhatsApp template message:", {
      to: formattedTo,
      from: formattedFrom,
      contentSid,
      variables,
    });
    const res = await client.messages.create({
      from: formattedFrom,
      to: formattedTo,
      contentSid: contentSid,
      contentVariables: JSON.stringify(variables),
    });

    console.log(`✅ WhatsApp template message sent to ${to}, SID: ${res.sid}`);
    return res;
  } catch (error) {
    console.error("❌ Error details:", {
      message: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
      status: error.status,
    });
    throw error;
  }
};
