/**
 * Email Service - Sends transactional emails via SendGrid
 */

const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

/**
 * Send registration confirmation email
 * @param {string} userEmail - Recipient email address
 * @param {object} registrationData - Registration details
 */
async function sendRegistrationConfirmation(userEmail, registrationData) {
  // Don't send if no API key configured
  if (!apiKey) {
    console.log('[EMAIL] SendGrid not configured, skipping email');
    return;
  }

  try {
    const { userName, eventName, registrationId, invoiceNumber, amountFormatted, eventDate } = registrationData;

    const msg = {
      to: userEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@ilmoportaali.com',
      subject: `Registration Confirmation - ${eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Registration Confirmed!</h2>

          <p>Hi ${userName},</p>

          <p>Thank you for registering for <strong>${eventName}</strong>.</p>

          <div style="background: #f5f5f5; padding: 1rem; border-radius: 6px; margin: 1.5rem 0;">
            <h3 style="margin-top: 0; color: #333;">Registration Details</h3>
            <p style="margin: 0.5rem 0;"><strong>Event:</strong> ${eventName}</p>
            <p style="margin: 0.5rem 0;"><strong>Date:</strong> ${eventDate}</p>
            <p style="margin: 0.5rem 0;"><strong>Registration ID:</strong> <code style="background: #fff; padding: 0.2rem 0.4rem; border-radius: 3px;">${registrationId}</code></p>
            <p style="margin: 0.5rem 0;"><strong>Invoice Number:</strong> <code style="background: #fff; padding: 0.2rem 0.4rem; border-radius: 3px;">${invoiceNumber}</code></p>
            <p style="margin: 0.5rem 0;"><strong>Amount Paid:</strong> ${amountFormatted}</p>
          </div>

          <p>If you have any questions about your registration, please contact the event organizers.</p>

          <p>Best regards,<br/>Ilmoportaali Team</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">
          <p style="font-size: 0.9rem; color: #999;">This is an automated email. Please do not reply directly to this message.</p>
        </div>
      `,
      text: `
Registration Confirmed!

Hi ${userName},

Thank you for registering for ${eventName}.

Registration Details:
Event: ${eventName}
Date: ${eventDate}
Registration ID: ${registrationId}
Invoice Number: ${invoiceNumber}
Amount Paid: ${amountFormatted}

If you have any questions about your registration, please contact the event organizers.

Best regards,
Ilmoportaali Team
      `
    };

    await sgMail.send(msg);
    console.log(`[EMAIL] Confirmation email sent to ${userEmail} for registration ${registrationId}`);
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send confirmation email:', err.message);
    // Don't throw - email failure shouldn't block registration
    return false;
  }
}

module.exports = {
  sendRegistrationConfirmation
};
