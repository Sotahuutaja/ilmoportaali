const sgMail = require('@sendgrid/mail');

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const APP_URL = process.env.APP_URL;

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Core send function
async function sendEmail({ to, subject, html }) {
  if (!FROM_EMAIL) throw new Error('SENDGRID_FROM_EMAIL not configured');
  if (!process.env.SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY not configured');

  try {
    await sgMail.send({
      to,
      from: FROM_EMAIL,
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

async function sendAdditionalPaymentEmail(email, eventTitle, additionalAmount, paymentIntentClientSecret) {
  const checkoutLink = `${APP_URL}/events/checkout?paymentIntentId=${paymentIntentClientSecret}`;
  await sendEmail({
    to: email,
    subject: `Additional payment required for ${eventTitle}`,
    html: `
      <h2>Registration updated - Additional payment needed</h2>
      <p>Your registration for <strong>${eventTitle}</strong> has been updated by the event organizers.</p>
      <p>Due to the changes, an additional payment of <strong>€${(additionalAmount / 100).toFixed(2)}</strong> is required.</p>
      <p><a href="${checkoutLink}" style="background:#1a1a2e;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Complete payment</a></p>
      <p>Or copy this link: ${checkoutLink}</p>
      <p>Please complete the payment to finalize your registration.</p>
      <p>If you have questions about this change, please contact the event organizers.</p>
    `
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendAdditionalPaymentEmail };