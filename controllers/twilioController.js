import { sendWhatsAppTemplate } from '../services/twilioService.js';

export const sendTemplate = async (req, res) => {
  try {
    const { to, contentSid, variables } = req.body;
    if (!to || !contentSid) return res.status(400).json({ success: false, message: 'to and contentSid required' });

    const result = await sendWhatsAppTemplate(to, contentSid, variables || {});
    res.json({ success: true, sid: result.sid });
  } catch (err) {
    console.error('sendTemplate error', err);
    res.status(500).json({ success: false, message: err.message || 'Send failed' });
  }
};
