const nodemailer = require('nodemailer');

const FROM_EMAIL = process.env.GMAIL_FROM_EMAIL;
const APP_URL = process.env.APP_URL;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD;

// Initialize nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASSWORD
  }
});

// Core send function
async function sendEmail({ to, subject, html }) {
  if (!FROM_EMAIL) throw new Error('GMAIL_FROM_EMAIL not configured');
  if (!GMAIL_USER) throw new Error('GMAIL_USER not configured');
  if (!GMAIL_PASSWORD) throw new Error('GMAIL_PASSWORD not configured');

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

async function sendEmailChangeVerificationEmail(newEmail, token) {
  const link = `${APP_URL}/verify-email-change?token=${token}`;
  await sendEmail({
    to: newEmail,
    subject: 'Verify your new email address',
    html: `
      <h2>Verify your new email</h2>
      <p>You requested to change your email address on your Ilmoportaali account. Click the link below to verify your new email:</p>
      <p><a href="${link}" style="background:#1a1a2e;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Verify email</a></p>
      <p>Or copy this link: ${link}</p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not request this change, you can ignore this email. Your current email address will remain unchanged.</p>
    `
  });
}

async function sendAdditionalPaymentEmail(email, eventTitle, additionalAmount, paymentIntentClientSecret, paymentIntentId, userFirstName = null, userLastName = null, products = []) {
  const checkoutLink = `${APP_URL}/events/checkout?paymentIntentId=${encodeURIComponent(paymentIntentId)}&clientSecret=${encodeURIComponent(paymentIntentClientSecret)}&amount=${additionalAmount}`;
  const userName = (userFirstName || userLastName)
    ? `${userFirstName || ''} ${userLastName || ''}`.trim()
    : null;
  const userNameText = userName
    ? `<strong style="background-color: #fff3cd; padding: 2px 6px; border-radius: 3px;">${userName}</strong>'s registration`
    : 'Your registration';

  // Build products table HTML
  let productsHtml = '';
  if (products && products.length > 0) {
    productsHtml = `
      <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #333;">Updated Products</h3>
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

  await sendEmail({
    to: email,
    subject: `Additional payment required for ${eventTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; margin-bottom: 0.5rem;">Registration Updated</h2>
        <p style="color: #666; margin: 0 0 1.5rem 0;">Additional payment required</p>

        <p style="color: #333;">Hi,</p>

        <p style="color: #333;">${userNameText} for <strong>${eventTitle}</strong> has been updated by the event organizers.</p>

        ${productsHtml}

        <div style="background: #fffbf0; padding: 1.5rem; border-left: 4px solid #f39c12; border-radius: 6px; margin: 1.5rem 0;">
          <h3 style="margin-top: 0; color: #333; margin-bottom: 1rem;">Additional Payment Due</h3>
          <p style="margin: 0; font-size: 1.1rem; color: #555;">Due to the updates, you need to complete an additional payment:</p>
          <p style="margin: 1rem 0 0 0; font-size: 1.8rem; color: #f39c12; font-weight: bold;">€${(additionalAmount / 100).toFixed(2)}</p>
        </div>

        <div style="text-align: center; margin: 2rem 0;">
          <a href="${checkoutLink}" style="display: inline-block; background: #1a1a2e; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 1rem; font-weight: 600;">Complete Payment</a>
        </div>

        <div style="background: #f5f5f5; padding: 1rem; border-radius: 6px; margin: 1.5rem 0;">
          <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: #333;">Payment Details</h3>
          <p style="margin: 0.5rem 0; color: #555; font-size: 0.95rem;"><strong>Event:</strong> ${eventTitle}</p>
          <p style="margin: 0.5rem 0; color: #555; font-size: 0.95rem;"><strong>Additional amount:</strong> €${(additionalAmount / 100).toFixed(2)}</p>
          <p style="margin: 0.5rem 0; color: #999; font-size: 0.9rem;">Please complete the payment within 48 hours to finalize your registration.</p>
        </div>

        <p style="color: #666; font-size: 0.95rem; margin: 1.5rem 0;">If you have questions about this charge or need to make changes to your registration, please contact the event organizers.</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">
        <p style="font-size: 0.9rem; color: #999; margin: 0;">This is an automated email. Please do not reply directly to this message.</p>
      </div>
    `
  });
}

async function sendRefundEmail(email, eventTitle, refundAmount, oldProducts = [], newProducts = [], userFirstName = null, userLastName = null) {
  // Build product change summary
  let productChangesHtml = '';

  if (oldProducts.length > 0 || newProducts.length > 0) {
    productChangesHtml = '<h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #333;">Registration Changes</h3>';
    productChangesHtml += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">';
    productChangesHtml += '<thead><tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;"><th style="text-align: left; padding: 0.5rem; color: #333;">Product</th><th style="text-align: center; padding: 0.5rem; color: #333;">Old Qty</th><th style="text-align: center; padding: 0.5rem; color: #333;">New Qty</th></tr></thead><tbody>';

    // Get all unique product IDs from old and new
    const allProductIds = new Set();
    oldProducts.forEach(p => allProductIds.add(p.product_id));
    newProducts.forEach(p => allProductIds.add(p.product_id));

    for (const productId of allProductIds) {
      const oldProduct = oldProducts.find(p => p.product_id === productId);
      const newProduct = newProducts.find(p => p.product_id === productId);
      const productName = oldProduct?.name || newProduct?.name || `Product ${productId}`;
      const oldQty = oldProduct?.quantity || 0;
      const newQty = newProduct?.quantity || 0;

      if (oldQty !== newQty) {
        productChangesHtml += `<tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 0.5rem; color: #333;">${productName}</td>
          <td style="text-align: center; padding: 0.5rem; color: #666;">${oldQty}</td>
          <td style="text-align: center; padding: 0.5rem; color: #666;">${newQty}</td>
        </tr>`;
      }
    }
    productChangesHtml += '</tbody></table>';
  }

  const userName = (userFirstName || userLastName)
    ? `${userFirstName || ''} ${userLastName || ''}`.trim()
    : null;
  const userNameText = userName
    ? `<strong style="background-color: #d4edda; padding: 2px 6px; border-radius: 3px;">${userName}</strong>'s registration`
    : 'Your registration';

  await sendEmail({
    to: email,
    subject: `Refund issued for ${eventTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; margin-bottom: 0.5rem;">Registration Updated</h2>
        <p style="color: #666; margin: 0 0 1.5rem 0;">Refund has been issued</p>

        <p style="color: #333;">Hi,</p>

        <p style="color: #333;">${userNameText} for <strong>${eventTitle}</strong> has been updated by the event organizers.</p>

        ${productChangesHtml}

        <div style="background: #f0fdf4; padding: 1.5rem; border-left: 4px solid #27ae60; border-radius: 6px; margin: 1.5rem 0;">
          <h3 style="margin-top: 0; color: #333; margin-bottom: 1rem;">✓ Refund Processed</h3>
          <p style="margin: 0; font-size: 1.1rem; color: #555;">Due to the changes, a refund has been automatically processed:</p>
          <p style="margin: 1rem 0 0 0; font-size: 1.8rem; color: #27ae60; font-weight: bold;">€${(refundAmount / 100).toFixed(2)}</p>
        </div>

        <div style="background: #f5f5f5; padding: 1rem; border-radius: 6px; margin: 1.5rem 0;">
          <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: #333;">Refund Details</h3>
          <p style="margin: 0.5rem 0; color: #555; font-size: 0.95rem;"><strong>Event:</strong> ${eventTitle}</p>
          <p style="margin: 0.5rem 0; color: #555; font-size: 0.95rem;"><strong>Refund amount:</strong> €${(refundAmount / 100).toFixed(2)}</p>
          <p style="margin: 0.5rem 0; color: #999; font-size: 0.9rem;">The refund will appear on your original payment method within 1-3 business days.</p>
        </div>

        <p style="color: #666; font-size: 0.95rem; margin: 1.5rem 0;">If you have questions about this change or your refund, please contact the event organizers.</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">
        <p style="font-size: 0.9rem; color: #999; margin: 0;">This is an automated email. Please do not reply directly to this message.</p>
      </div>
    `
  });
}

async function sendAdditionalPaymentConfirmationEmail(email, eventTitle, amountPaid, products = []) {
  // Build products table HTML
  let productsHtml = '';
  if (products && products.length > 0) {
    productsHtml = `
      <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #333;">Your Registration</h3>
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

  await sendEmail({
    to: email,
    subject: `Payment confirmed for ${eventTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60; margin-bottom: 0.5rem;">Payment Confirmed!</h2>
        <p style="color: #666; margin: 0 0 1.5rem 0;">Your payment has been successfully processed</p>

        <p style="color: #333;">Thank you for completing your payment!</p>

        <div style="background: #f0fdf4; padding: 1.5rem; border-left: 4px solid #27ae60; border-radius: 6px; margin: 1.5rem 0;">
          <h3 style="margin-top: 0; color: #333; margin-bottom: 1rem;">✓ Payment Received</h3>
          <p style="margin: 0; font-size: 1.1rem; color: #555;">Your additional payment for <strong>${eventTitle}</strong> has been successfully processed.</p>
          <p style="margin: 1rem 0 0 0; font-size: 1.8rem; color: #27ae60; font-weight: bold;">€${(amountPaid / 100).toFixed(2)}</p>
        </div>

        ${productsHtml}

        <div style="background: #f5f5f5; padding: 1rem; border-radius: 6px; margin: 1.5rem 0;">
          <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: #333;">Registration Status</h3>
          <p style="margin: 0.5rem 0; color: #555; font-size: 0.95rem;"><strong>Event:</strong> ${eventTitle}</p>
          <p style="margin: 0.5rem 0; color: #27ae60; font-weight: bold;">✓ Your registration is now complete and confirmed.</p>
        </div>

        <p style="color: #666; font-size: 0.95rem; margin: 1.5rem 0;">If you have any questions about your registration or payment, please contact the event organizers.</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">
        <p style="font-size: 0.9rem; color: #999; margin: 0;">This is an automated email. Please do not reply directly to this message.</p>
      </div>
    `
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeVerificationEmail, sendAdditionalPaymentEmail, sendRefundEmail, sendAdditionalPaymentConfirmationEmail };