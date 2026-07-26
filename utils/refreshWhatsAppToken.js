import axios from "axios";
import dotenv from "dotenv";
import Config from "../models/config.js";

dotenv.config();

export async function refreshWhatsAppToken() {
  try {
    const currentToken = await Config.findOne({ key: "WHATSAPP_ACCESS_TOKEN" }).lean().then(c => c?.value) || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!currentToken) {
      throw new Error("No current WhatsApp access token found in database or environment");
    }

    const url = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.WHATSAPP_APP_ID}&client_secret=${process.env.WHATSAPP_APP_SECRET}&fb_exchange_token=${currentToken}`;

    const { data } = await axios.get(url);

    console.log("✅ New WhatsApp Token Generated");
    console.log("Expires In:", data.expires_in);

    const newToken = data.access_token;

    // Save token to database
    await Config.findOneAndUpdate(
      { key: "WHATSAPP_ACCESS_TOKEN" },
      { value: newToken },
      { upsert: true, new: true }
    );

    console.log(" Token updated in database");

    return newToken;
  } catch (err) {
    console.error(" Failed to refresh token:", err.response?.data || err.message || err);
  }
}

// if (process.argv[1].includes("refreshWhatsAppToken.js")) {
//   refreshWhatsAppToken();
// }