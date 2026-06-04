/**
 * Email Worker Service
 * Processes queued emails from the email_queue table
 * Handles retries and failure logging
 * Can be run as a background job or periodically via cron
 */

const pool = require('../db');
const { sendRegistrationConfirmation, sendRegistrationCancellation } = require('./emailService');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds between retries

/**
 * Process all pending emails in the queue
 * @param {number} limit - Maximum number of emails to process in one run
 */
async function processPendingEmails(limit = 10) {
  try {
    console.log('[EMAIL WORKER] Starting email processing...');

    // Fetch pending emails
    const result = await pool.query(
      `SELECT * FROM email_queue
       WHERE status IN ('pending', 'failed')
       AND attempt_count < $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [MAX_RETRIES, limit]
    );

    if (result.rows.length === 0) {
      console.log('[EMAIL WORKER] No pending emails to process');
      return { processed: 0, failed: 0 };
    }

    console.log(`[EMAIL WORKER] Processing ${result.rows.length} email(s)`);

    let processed = 0;
    let failed = 0;

    for (const emailRecord of result.rows) {
      try {
        await sendQueuedEmail(emailRecord);
        processed++;
      } catch (err) {
        console.error(`[EMAIL WORKER] Failed to send email ${emailRecord.id}:`, err.message);
        failed++;
        // Email sending error is caught and logged, worker continues
      }
    }

    console.log(`[EMAIL WORKER] Complete: ${processed} sent, ${failed} failed`);
    return { processed, failed };
  } catch (err) {
    console.error('[EMAIL WORKER] Fatal error:', err.message);
    throw err;
  }
}

/**
 * Send a single queued email
 */
async function sendQueuedEmail(emailRecord) {
  const { id, registration_id, email_type, recipient_email, attempt_count } = emailRecord;

  try {
    console.log(`[EMAIL WORKER] Sending ${email_type} email (attempt ${attempt_count + 1}/${MAX_RETRIES}) to ${recipient_email}`);

    if (email_type === 'registration_confirmation') {
      await sendConfirmationEmailFromQueue(registration_id, recipient_email);
    } else if (email_type === 'registration_cancellation') {
      await sendCancellationEmailFromQueue(registration_id, recipient_email);
    } else {
      throw new Error(`Unknown email type: ${email_type}`);
    }

    // Mark as sent
    await pool.query(
      `UPDATE email_queue SET status = $1, sent_at = NOW(), updated_at = NOW() WHERE id = $2`,
      ['sent', id]
    );

    console.log(`[EMAIL WORKER] Email ${id} sent successfully`);
  } catch (err) {
    // Update failure with error message and increment attempt count
    const newAttemptCount = attempt_count + 1;
    const newStatus = newAttemptCount >= MAX_RETRIES ? 'failed' : 'failed';

    await pool.query(
      `UPDATE email_queue
       SET status = $1, attempt_count = $2, last_error = $3, updated_at = NOW()
       WHERE id = $4`,
      [newStatus, newAttemptCount, err.message, id]
    );

    throw err;
  }
}

/**
 * Send confirmation email by reconstructing data from database
 */
async function sendConfirmationEmailFromQueue(registrationId, recipientEmail) {
  // Fetch registration details
  const regResult = await pool.query(
    `SELECT r.*, e.id as event_id, e.title, e.starts_at
     FROM registrations r
     JOIN events e ON r.event_id = e.id
     WHERE r.id = $1`,
    [registrationId]
  );

  if (!regResult.rows[0]) {
    throw new Error(`Registration ${registrationId} not found`);
  }

  const registration = regResult.rows[0];
  const eventId = registration.event_id;

  // Fetch all registration products
  const productsResult = await pool.query(
    `SELECT rp.*, ep.name, ep.price, ep.fields
     FROM registration_products rp
     JOIN event_products ep ON rp.product_id = ep.id
     WHERE rp.registration_id = $1`,
    [registrationId]
  );

  // Fetch invoice number
  const invoiceResult = await pool.query(
    `SELECT invoice_number, amount_cents FROM invoices WHERE registration_id = $1 LIMIT 1`,
    [registrationId]
  );

  if (!invoiceResult.rows[0]) {
    throw new Error(`Invoice for registration ${registrationId} not found`);
  }

  const invoice = invoiceResult.rows[0];

  // Build products array with prices
  const products = productsResult.rows.map(p => ({
    name: p.name,
    price: parseFloat(p.price),
    quantity: p.quantity,
    field_values: p.field_values || {}
  }));

  // Fetch related guest registrations
  const guestsResult = await pool.query(
    `SELECT r.*,
            (SELECT json_agg(json_build_object('product_id', rp.product_id, 'quantity', rp.quantity, 'field_values', rp.field_values, 'name', ep.name, 'price', ep.price))
             FROM registration_products rp
             JOIN event_products ep ON rp.product_id = ep.id
             WHERE rp.registration_id = r.id) as products
     FROM registrations r
     WHERE r.event_id = $1 AND r.is_guest = true AND r.registered_by = $2`,
    [eventId, registration.user_id]
  );

  const guests = guestsResult.rows.map(g => ({
    guest_first_name: g.guest_first_name,
    guest_last_name: g.guest_last_name,
    comments: g.comments,
    products: (g.products || []).map(p => ({
      name: p.name,
      price: parseFloat(p.price),
      quantity: p.quantity,
      field_values: p.field_values || {}
    }))
  }));

  // Send email
  await sendRegistrationConfirmation(
    recipientEmail,
    {
      userName: `${registration.first_name || ''} ${registration.last_name || ''}`.trim() || recipientEmail,
      eventName: registration.title,
      registrationId: registrationId,
      invoiceNumber: invoice.invoice_number,
      amountFormatted: `€${(invoice.amount_cents / 100).toFixed(2)}`,
      eventDate: new Date(registration.starts_at).toLocaleDateString('fi-FI', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      guestCount: guests.length
    },
    products,
    guests,
    registration.comments || ''
  );
}

/**
 * Send cancellation email by reconstructing data from database
 */
async function sendCancellationEmailFromQueue(registrationId, recipientEmail) {
  // Fetch registration details
  const regResult = await pool.query(
    `SELECT r.*, e.title
     FROM registrations r
     JOIN events e ON r.event_id = e.id
     WHERE r.id = $1`,
    [registrationId]
  );

  if (!regResult.rows[0]) {
    throw new Error(`Registration ${registrationId} not found`);
  }

  const registration = regResult.rows[0];

  // Fetch invoice if it exists (for refund amount)
  const invoiceResult = await pool.query(
    `SELECT amount_cents FROM invoices WHERE registration_id = $1 LIMIT 1`,
    [registrationId]
  );

  const invoice = invoiceResult.rows[0];

  // Fetch registration products
  const productsResult = await pool.query(
    `SELECT rp.*, ep.name, ep.price
     FROM registration_products rp
     JOIN event_products ep ON rp.product_id = ep.id
     WHERE rp.registration_id = $1`,
    [registrationId]
  );

  const products = productsResult.rows.map(p => ({
    name: p.name,
    price: parseFloat(p.price),
    quantity: p.quantity
  }));

  // Send email
  await sendRegistrationCancellation(
    recipientEmail,
    {
      userName: `${registration.first_name || ''} ${registration.last_name || ''}`.trim() || recipientEmail,
      eventName: registration.title,
      registrationId: registrationId,
      amountRefunded: invoice ? `€${(invoice.amount_cents / 100).toFixed(2)}` : null,
      refundDate: new Date().toLocaleDateString('fi-FI', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    },
    products
  );
}

module.exports = {
  processPendingEmails,
  sendQueuedEmail
};
