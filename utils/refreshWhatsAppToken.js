import axios from "axios";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export async function refreshWhatsAppToken() {
  try {
    const url = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.WHATSAPP_APP_ID}&client_secret=${process.env.WHATSAPP_APP_SECRET}&fb_exchange_token=${process.env.WHATSAPP_ACCESS_TOKEN}`;

    const { data } = await axios.get(url);

    console.log("✅ New WhatsApp Token Generated");
    console.log("Expires In:", data.expires_in);

    const newToken = data.access_token;

    // Save token to .env (auto replace)
    const envPath = ".env";
    let envFile = fs.readFileSync(envPath, "utf-8");

    envFile = envFile.replace(
      /WHATSAPP_ACCESS_TOKEN=.*/g,
      `WHATSAPP_ACCESS_TOKEN=${newToken}`
    );

    fs.writeFileSync(envPath, envFile);

    console.log(" Token updated in .env");

    return newToken;
  } catch (err) {
    console.error(" Failed to refresh token:", err.response?.data || err);
  }
}

// if (process.argv[1].includes("refreshWhatsAppToken.js")) {
//   refreshWhatsAppToken();
// }