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

async function sendAdditionalPaymentEmail(email, eventTitle, additionalAmount, paymentIntentClientSecret, paymentIntentId) {
  const checkoutLink = `${APP_URL}/events/checkout?paymentIntentId=${paymentIntentId}&clientSecret=${paymentIntentClientSecret}&amount=${additionalAmount}`;
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

async function sendRefundEmail(email, eventTitle, refundAmount, oldProducts = [], newProducts = []) {
  // Build product change summary
  let productChangesHtml = '';

  if (oldProducts.length > 0 || newProducts.length > 0) {
    productChangesHtml = '<h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Your registration changes:</h3>';
    productChangesHtml += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">';
    productChangesHtml += '<tr style="background: #f5f5f5;"><th style="text-align: left; padding: 0.5rem; border: 1px solid #ddd;">Product</th><th style="text-align: center; padding: 0.5rem; border: 1px solid #ddd;">Old</th><th style="text-align: center; padding: 0.5rem; border: 1px solid #ddd;">New</th></tr>';

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
        productChangesHtml += `<tr>
          <td style="padding: 0.5rem; border: 1px solid #ddd;">${productName}</td>
          <td style="text-align: center; padding: 0.5rem; border: 1px solid #ddd;">${oldQty}</td>
          <td style="text-align: center; padding: 0.5rem; border: 1px solid #ddd;">${newQty}</td>
        </tr>`;
      }
    }
    productChangesHtml += '</table>';
  }

  await sendEmail({
    to: email,
    subject: `Refund issued for ${eventTitle}`,
    html: `
      <h2>Registration updated - Refund issued</h2>
      <p>Your registration for <strong>${eventTitle}</strong> has been updated by the event organizers.</p>
      ${productChangesHtml}
      <p>Due to the changes, a refund of <strong>€${(refundAmount / 100).toFixed(2)}</strong> has been automatically processed.</p>
      <p>The refund will appear on your original payment method within 1-3 business days.</p>
      <p>If you have questions about this change, please contact the event organizers.</p>
    `
  });
}

async function sendAdditionalPaymentConfirmationEmail(email, eventTitle, amountPaid, addedProducts = [], allProducts = []) {
  // Build summary of products just added
  let addedProductsHtml = '';
  if (addedProducts.length > 0) {
    addedProductsHtml = '<h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #155724;">You just paid for:</h3>';
    addedProductsHtml += '<ul style="margin: 0.5rem 0; padding-left: 1.5rem; background: #d4edda; padding: 1rem; border-radius: 6px;">';

    for (const product of addedProducts) {
      const qty = product.quantity || 0;
      addedProductsHtml += `<li style="margin-bottom: 0.3rem;"><strong>${product.name}</strong> ×${qty}</li>`;
    }

    addedProductsHtml += '</ul>';
  }

  // Build summary of all current products
  let allProductsHtml = '';
  if (allProducts.length > 0) {
    allProductsHtml = '<h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Your complete registration for this event:</h3>';
    allProductsHtml += '<ul style="margin: 0.5rem 0; padding-left: 1.5rem;">';

    for (const product of allProducts) {
      const qty = product.quantity || 0;
      allProductsHtml += `<li style="margin-bottom: 0.3rem;">${product.name} ×${qty}</li>`;
    }

    allProductsHtml += '</ul>';
  }

  await sendEmail({
    to: email,
    subject: `Payment confirmed for ${eventTitle}`,
    html: `
      <h2>Additional payment received</h2>
      <p>Thank you! Your additional payment for <strong>${eventTitle}</strong> has been successfully processed.</p>
      <p>Payment received: <strong>€${(amountPaid / 100).toFixed(2)}</strong></p>
      ${addedProductsHtml}
      ${allProductsHtml}
      <p style="margin-top: 1.5rem;">Your registration is now complete.</p>
      <p>If you have any questions, please contact the event organizers.</p>
    `
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendAdditionalPaymentEmail, sendRefundEmail, sendAdditionalPaymentConfirmationEmail };