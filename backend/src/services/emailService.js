/**
 * Email Service - Sends transactional emails via Gmail
 */

const nodemailer = require('nodemailer');
const { logHelpers } = require('./logService');

// Initialize Gmail transporter
const gmailUser = process.env.GMAIL_USER;
const gmailPassword = process.env.GMAIL_PASSWORD;
const transporter = (gmailUser && gmailPassword)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword
      }
    })
  : null;

/**
 * Send registration confirmation email
 * @param {string} userEmail - Recipient email address
 * @param {object} registrationData - Registration details
 * @param {array} products - Array of products with {name, price, quantity}
 */
async function sendRegistrationConfirmation(userEmail, registrationData, products = [], guests = [], captainComments = '') {
  // Don't send if no Gmail credentials configured
  if (!transporter) {
    console.log('[EMAIL] Gmail not configured, skipping email');
    return;
  }

  try {
    const { userName, eventName, registrationId, invoiceNumber, amountFormatted, eventDate } = registrationData;

    // Build products table HTML
    let productsHtml = '';
    if (products && products.length > 0) {
      productsHtml = `
        <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #333;">Selected Products</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">
          <thead>
            <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
              <th style="padding: 0.5rem; text-align: left; color: #333;">Product</th>
              <th style="padding: 0.5rem; text-align: center; color: #333;">Qty</th>
              <th style="padding: 0.5rem; text-align: right; color: #333;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 0.5rem; color: #333;">
                  ${p.name}
                  ${p.field_values && Object.keys(p.field_values).length > 0 ? `<br/><span style="font-size: 0.85rem; color: #999;">${Object.entries(p.field_values).map(([key, val]) => `${key}: ${val}`).join(', ')}</span>` : ''}
                </td>
                <td style="padding: 0.5rem; text-align: center; color: #666;">${p.quantity}</td>
                <td style="padding: 0.5rem; text-align: right; color: #333;">€${(p.price * p.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const msg = {
      to: userEmail,
      from: process.env.GMAIL_FROM_EMAIL || 'noreply@ilmoportaali.com',
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

          ${productsHtml}

          ${captainComments && productsHtml ? `
            <div style="background: #f9f9f9; padding: 1rem; border-radius: 6px; margin: 1.5rem 0;">
              <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: #333;">Your Comments</h3>
              <p style="margin: 0; color: #555; white-space: pre-wrap;">${captainComments}</p>
            </div>
          ` : ''}

          ${guests && guests.length > 0 ? `
            <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #333;">Guest Registrations</h3>
            ${guests.map(guest => `
              <div style="background: #f9f9f9; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                <p style="margin: 0.5rem 0; font-weight: 600;"><strong>${guest.guest_first_name} ${guest.guest_last_name}</strong></p>
                ${guest.comments ? `<p style="margin: 0.5rem 0; font-size: 0.9rem; color: #666;"><em>Comments: ${guest.comments}</em></p>` : ''}
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f5f5f5; border-bottom: 1px solid #ddd;">
                      <th style="padding: 0.5rem; text-align: left; color: #333; font-size: 0.9rem;">Product</th>
                      <th style="padding: 0.5rem; text-align: center; color: #333; font-size: 0.9rem;">Qty</th>
                      <th style="padding: 0.5rem; text-align: right; color: #333; font-size: 0.9rem;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${guest.products.map(p => `
                      <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 0.5rem; color: #333; font-size: 0.9rem;">
                          ${p.name}
                          ${p.field_values && Object.keys(p.field_values).length > 0 ? `<br/><span style="font-size: 0.8rem; color: #999;">${Object.entries(p.field_values).map(([key, val]) => `${key}: ${val}`).join(', ')}</span>` : ''}
                        </td>
                        <td style="padding: 0.5rem; text-align: center; color: #666; font-size: 0.9rem;">${p.quantity}</td>
                        <td style="padding: 0.5rem; text-align: right; color: #333; font-size: 0.9rem;">€${(p.price * p.quantity).toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `).join('')}
          ` : ''}

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

${products && products.length > 0 ? `Your Products:
${products.map(p => `  - ${p.name}${p.field_values && Object.keys(p.field_values).length > 0 ? ` (${Object.entries(p.field_values).map(([k, v]) => `${k}: ${v}`).join(', ')})` : ''} × ${p.quantity} = €${(p.price * p.quantity).toFixed(2)}`).join('\n')}

` : ''}${captainComments && products && products.length > 0 ? `Your Comments:
${captainComments}

` : ''}${guests && guests.length > 0 ? `Guest Registrations:
${guests.map(guest => `
${guest.guest_first_name} ${guest.guest_last_name}:${guest.comments ? `
Comments: ${guest.comments}` : ''}
${guest.products.map(p => `  - ${p.name}${p.field_values && Object.keys(p.field_values).length > 0 ? ` (${Object.entries(p.field_values).map(([k, v]) => `${k}: ${v}`).join(', ')})` : ''} × ${p.quantity} = €${(p.price * p.quantity).toFixed(2)}`).join('\n')}
`).join('')}

` : ''}If you have any questions about your registration, please contact the event organizers.

Best regards,
Ilmoportaali Team
      `
    };

    await transporter.sendMail(msg);
    console.log(`[EMAIL] Confirmation email sent to ${userEmail} for registration ${registrationId}`);
    logHelpers.emailSuccess('registration confirmation', userEmail);
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send confirmation email:', err.message);
    logHelpers.emailError('registration confirmation', userEmail, err);
    // Don't throw - email failure shouldn't block registration
    return false;
  }
}

/**
 * Send registration cancellation email
 * @param {string} userEmail - Recipient email address
 * @param {object} cancellationData - Cancellation details
 * @param {array} products - Array of products that were cancelled
 */
async function sendRegistrationCancellation(userEmail, cancellationData, products = []) {
  // Don't send if no Gmail credentials configured
  if (!transporter) {
    console.log('[EMAIL] Gmail not configured, skipping email');
    return;
  }

  try {
    const { userName, eventName, registrationId, refundAmount, refundDate, isCancelledByManager } = cancellationData;

    // Build products table HTML
    let productsHtml = '';
    if (products && products.length > 0) {
      productsHtml = `
        <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #333;">Cancelled Products</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">
          <thead>
            <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
              <th style="padding: 0.5rem; text-align: left; color: #333;">Product</th>
              <th style="padding: 0.5rem; text-align: center; color: #333;">Qty</th>
              <th style="padding: 0.5rem; text-align: right; color: #333;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 0.5rem; color: #333;">
                  ${p.name}
                  ${p.field_values && Object.keys(p.field_values).length > 0 ? `<br/><span style="font-size: 0.85rem; color: #999;">${Object.entries(p.field_values).map(([key, val]) => `${key}: ${val}`).join(', ')}</span>` : ''}
                </td>
                <td style="padding: 0.5rem; text-align: center; color: #666;">${p.quantity}</td>
                <td style="padding: 0.5rem; text-align: right; color: #333;">€${(p.price * p.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const msg = {
      to: userEmail,
      from: process.env.GMAIL_FROM_EMAIL || 'noreply@ilmoportaali.com',
      subject: `Registration Cancelled - ${eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #c0392b;">Registration Cancelled</h2>

          <p>Hi ${userName},</p>

          <p>Your registration for <strong>${eventName}</strong> has been cancelled, and a refund has been issued.</p>

          ${refundAmount > 0 ? `
            <div style="background: #f0fdf4; padding: 1.5rem; border-left: 4px solid #27ae60; border-radius: 6px; margin: 1.5rem 0;">
              <h3 style="margin-top: 0; color: #333; margin-bottom: 1rem;">✓ Refund Processed</h3>
              <p style="margin: 0; font-size: 1.1rem; color: #555;">A refund has been automatically processed:</p>
              <p style="margin: 1rem 0 0 0; font-size: 1.8rem; color: #27ae60; font-weight: bold;">€${(refundAmount / 100).toFixed(2)}</p>
            </div>
          ` : ''}

          <div style="background: #f5f5f5; padding: 1rem; border-radius: 6px; margin: 1.5rem 0;">
            <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: #333;">Cancellation Details</h3>
            <p style="margin: 0.5rem 0;"><strong>Event:</strong> ${eventName}</p>
            <p style="margin: 0.5rem 0;"><strong>Registration ID:</strong> <code style="background: #fff; padding: 0.2rem 0.4rem; border-radius: 3px;">${registrationId}</code></p>
            <p style="margin: 0.5rem 0;"><strong>Cancellation Date:</strong> ${refundDate}</p>
            <p style="margin: 0.5rem 0; color: #999; font-size: 0.9rem;">The refund will appear on your original payment method within 1-3 business days.</p>
          </div>

          ${productsHtml}

          <p>If you have any questions about your cancellation, please contact the event organizers.</p>

          <p>Best regards,<br/>Ilmoportaali Team</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">
          <p style="font-size: 0.9rem; color: #999;">This is an automated email. Please do not reply directly to this message.</p>
        </div>
      `,
      text: `
Registration Cancelled

Hi ${userName},

Your registration for ${eventName} has been cancelled.

Cancellation Details:
Event: ${eventName}
Registration ID: ${registrationId}
Cancellation Date: ${refundDate}
${isCancelledByManager && refundAmount > 0 ? `Amount Refunded: €${(refundAmount / 100).toFixed(2)}` : ''}

${products && products.length > 0 ? `Cancelled Products:
${products.map(p => `  - ${p.name} × ${p.quantity} = €${(p.price * p.quantity).toFixed(2)}`).join('\n')}

` : ''}
If you have any questions about your cancellation, please contact the event organizers.

Best regards,
Ilmoportaali Team
      `
    };

    await transporter.sendMail(msg);
    console.log(`[EMAIL] Cancellation email sent to ${userEmail} for registration ${registrationId}`);
    logHelpers.emailSuccess('registration cancellation', userEmail);
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send cancellation email:', err.message);
    logHelpers.emailError('registration cancellation', userEmail, err);
    return false;
  }
}

module.exports = {
  sendRegistrationConfirmation,
  sendRegistrationCancellation
};
