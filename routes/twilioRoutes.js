import express from 'express';
import { sendTemplate } from '../controllers/twilioController.js';

const router = express.Router();

// Debug endpoint to send template
router.post('/send-template', sendTemplate);

export default router;
