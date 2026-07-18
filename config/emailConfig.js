import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASSWORD:", process.env.EMAIL_PASSWORD ? "Loaded" : "Missing");


export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});