// services/whatsappCloudService.js
import axios from "axios";
import Config from "../models/config.js";

const WHATSAPP_API_URL =
  process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v22.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function getAccessToken() {
  try {
    const config = await Config.findOne({ key: "WHATSAPP_ACCESS_TOKEN" }).lean();
    if (config && config.value) {
      return config.value;
    }
  } catch (e) {
    console.error("Failed to load WhatsApp token from database, using env fallback:", e.message);
  }
  return process.env.WHATSAPP_ACCESS_TOKEN;
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
    const token = await getAccessToken();
    if (!PHONE_NUMBER_ID) throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID");
    if (!token) throw new Error("Missing WHATSAPP_ACCESS_TOKEN");

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
          Authorization: `Bearer ${token}`,
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
