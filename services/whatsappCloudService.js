// services/whatsappCloudService.js
import axios from "axios";

const WHATSAPP_API_URL =
  process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v22.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

function assertEnv() {
  if (!PHONE_NUMBER_ID) throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID");
  if (!ACCESS_TOKEN) throw new Error("Missing WHATSAPP_ACCESS_TOKEN");
}

// Format phone number (remove '+')
function fmt(msisdn) {
  return msisdn.toString().replace(/^\+/, "").trim();
}

/**
 * ✅ ADMIN-ONLY MESSAGE SENDER
 * Free-form text allowed since admin is internal and already opted-in
 * Use this for all notifications
 */
export async function sendWhatsAppAdminText(to, message) {
  try {
    assertEnv();

    const payload = {
      messaging_product: "whatsapp",
      to: fmt(to),
      type: "text",
      text: {
        body: String(message || ""),
      },
    };

    const { data } = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("✅ Admin WhatsApp text sent:", { to: fmt(to) });
    return data;
  } catch (err) {
    console.error("❌ Admin WhatsApp send error:", err.message || err.response?.data);
    throw err;
  }
}
