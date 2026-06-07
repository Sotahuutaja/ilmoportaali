const nodemailer = require('nodemailer');

const FROM_EMAIL = process.env.GMAIL_ADDRESS;
const APP_URL = process.env.APP_URL;

// Create transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_ADDRESS,
    pass: process.env.GMAIL_PASSWORD  // 16-character app password
  }
});

// Core send function — swap this out to change providers
async function sendEmail({ to, subject, html }) {
  if (!FROM_EMAIL) throw new Error('GMAIL_ADDRESS not configured');
  if (!process.env.GMAIL_PASSWORD) throw new Error('GMAIL_PASSWORD not configured');

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html
    });
    console.log(`[EMAIL] Sent to ${to}`);
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send email:', err.message);
    throw err;
  }
}

// Email templates
async function sendVerificationEmail(email, token) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your Ilmoportaali account',
    html: `
      <h2>Welcome to Ilmoportaali!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${link}" style="background:#1a1a2e;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Verify email</a></p>
      <p>Or copy this link: ${link}</p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not create an account, you can ignore this email.</p>
    `
  });
}

async function sendPasswordResetEmail(email, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your Ilmoportaali password',
    html: `
      <h2>Password reset</h2>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${link}" style="background:#1a1a2e;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Reset password</a></p>
      <p>Or copy this link: ${link}</p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request a reset, you can ignore this email.</p>
    `
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };