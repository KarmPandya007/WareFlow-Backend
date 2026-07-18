// Quick test script to verify WhatsApp functionality
import { sendWhatsAppText } from './services/twilioService.js';
import dotenv from 'dotenv';

dotenv.config();

const testWhatsApp = async () => {
  try {
    console.log('🧪 Testing WhatsApp message sending...');
    console.log('Environment check:');
    console.log('- TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing');
    console.log('- TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('- TWILIO_WHATSAPP_FROM:', process.env.TWILIO_WHATSAPP_FROM ? '✅ Set' : '❌ Missing');
    
    const testMessage = `🧪 Test Message from ST Billing System
    
*This is a test message*
Time: ${new Date().toLocaleString('en-IN')}

If you receive this, WhatsApp integration is working! 🎉`;

    const result = await sendWhatsAppText('918727913307', testMessage);
    
    console.log('✅ Test completed successfully!');
    console.log('Message SID:', result.sid);
    console.log('Status:', result.status);
    
    // Wait for status update
    console.log('⏳ Waiting for delivery status...');
    setTimeout(() => {
      console.log('✅ Test script completed. Check your WhatsApp for the message.');
      process.exit(0);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

testWhatsApp();
