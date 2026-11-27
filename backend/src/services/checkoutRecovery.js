/**
 * Checkout recovery — safety net for payments that succeed on Stripe's side but never
 * get turned into a registration here.
 *
 * Background: /create-payment-intent stashes the intended registration payload
 * (captain + guest products, team, field values, comments) into pending_checkouts the
 * moment a Stripe payment intent is created, keyed by that payment intent's id. The
 * normal flow then has /confirm-payment create the real registration once the
 * customer's browser returns from paying, and clearPendingCheckout() below deletes
 * the stash either way (success or a definitive, already-refunded failure) so this
 * module never re-examines a payment confirm-payment has already settled.
 *
 * If the browser never makes it back — most commonly a redirect-based method like
 * MobilePay or iDEAL, which settle independently of this app the moment the customer
 * approves in their banking app, well before (or even without) any redirect landing
 * here — the stash is left behind with nothing to clean it up. sweepAbandonedCheckouts()
 * periodically looks for exactly that: a stash old enough that a normal checkout would
 * have finished by now, with no corresponding payment_intents row. For each one it asks
 * Stripe directly what actually happened and, if the money was genuinely taken,
 * completes the registration from the stashed payload — otherwise it lets a still-in-
 * progress one be (checked again next sweep) or cleans up a truly abandoned one.
 *
 * Deliberately NOT sharing registration-creation code with confirm-payment in
 * payments.js (same reasoning already used for confirm-free-registration there): this
 * is a rare, less-trusted-by-default fallback path, kept self-contained so it can never
 * accidentally affect the real, battle-tested checkout flow. If the two ever need to
 * diverge in how prices/capacity/eligibility are computed, update both.
 */

const pool = require('../db');
const { getPaymentIntent, capturePaymentIntent, refundPaymentIntent } = require('./stripeService');
const { validateIdentifyingProducts, countIdentifyingRegistrations } = require('../utils/identifyingProducts');
const { validateCheckboxSelection } = require('../utils/checkboxFields');
const { resolvePrice } = require('../utils/pricing');
const { getVolunteerDiscountMap, applyVolunteerDiscount } = require('../utils/volunteerPricing');
const { getEligibleTeamIds } = require('../utils/eventAccess');
const { logHelpers } = require('./logService');

// How long to leave a checkout alone before treating it as possibly abandoned — long
// enough that a customer who's actively paying has certainly finished (or failed and
// seen an error) by then, so this never races the normal browser-driven confirm-payment
// call for a checkout that's still genuinely in progress.
const GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutes

// How often the sweep runs.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// If Stripe still shows a payment intent as unresolved (never captured, never
// canceled) after this long, treat the checkout as abandoned and just clean up the
// stash rather than checking it forever.
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Save the intended registration payload for a newly-created payment intent.
 * Best-effort: a failure here must never break payment-intent creation itself, since
 * this is purely an extra safety copy — the checkout proceeds exactly as it does today
 * either way.
 */
async function stashPendingCheckout({ paymentIntentId, eventId, userId, recipientEmail, registrations, expectedAmountCents }) {
  if (!registrations) return; // nothing to stash — recovery simply won't be possible for this one
  try {
    await pool.query(
      `INSERT INTO pending_checkouts (stripe_payment_intent_id, event_id, user_id, recipient_email, registrations, expected_amount_cents)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (stripe_payment_intent_id) DO NOTHING`,
      [paymentIntentId, eventId, userId, recipientEmail, JSON.stringify(registrations), expectedAmountCents]
    );
  } catch (err) {
    console.error('[CHECKOUT RECOVERY] Failed to stash pending checkout:', err.message);
  }
}

/**
 * Remove a stash once its payment intent's fate is settled — either confirm-payment
 * created the registration normally, or it failed and already refunded/canceled the
 * payment. Either way, nothing should try to recover it again afterwards. Best-effort.
 */
async function clearPendingCheckout(paymentIntentId) {
  try {
    await pool.query('DELETE FROM pending_checkouts WHERE stripe_payment_intent_id = $1', [paymentIntentId]);
  } catch (err) {
    console.error('[CHECKOUT RECOVERY] Failed to clear pending checkout:', err.message);
  }
}

/**
 * Complete a registration from a stashed payload. Mirrors confirm-payment's own
 * registration-creation logic in payments.js — see the module comment above for why
 * this is a deliberate, separate copy rather than a shared helper.
 *
 * @param {object} stash - a row from pending_checkouts
 * @param {string} stripeMode - 'live' or 'test'
 * @param {object} paymentIntent - the Stripe PaymentIntent, already confirmed by the
 *   caller to be actually paid (captured) at this point
 */
async function recoverPendingCheckout(stash, stripeMode, paymentIntent) {
  const paymentIntentId = stash.stripe_payment_intent_id;
  const eventId = stash.event_id;
  const userId = stash.user_id;
  const registrations = stash.registrations;
  const captain = registrations.captain || { products: [] };
  const guests = registrations.guests || [];

  // Re-check idempotency right before acting — the sweep's own selection query already
  // filters these out, but this closes the small gap between that query running and
  // this function starting.
  const alreadyProcessed = await pool.query(
    'SELECT id FROM payment_intents WHERE stripe_payment_intent_id = $1',
    [paymentIntentId]
  );
  if (alreadyProcessed.rows[0]) {
    await clearPendingCheckout(paymentIntentId);
    return { recovered: false, reason: 'already_processed' };
  }

  const submittedTeamIds = [captain.teamId, ...guests.map(g => g.team_id)]
    .filter(teamId => teamId !== null && teamId !== undefined);
  if (submittedTeamIds.length > 0) {
    const eligibleTeamIds = await getEligibleTeamIds(eventId, pool);
    if (submittedTeamIds.some(teamId => !eligibleTeamIds.has(teamId))) {
      throw new Error('Selected team is not eligible to register for this event');
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const registrationIds = [];
    let totalCents = 0;

    const eventForCapacity = await client.query(
      'SELECT capacity FROM events WHERE id = $1 FOR UPDATE',
      [eventId]
    );
    const eventCapacity = eventForCapacity.rows[0]?.capacity;

    const existingCaptainReg = await client.query(
      'SELECT id FROM registrations WHERE user_id = $1 AND event_id = $2 FOR UPDATE',
      [userId, eventId]
    );
    const existingCaptainRegId = existingCaptainReg.rows[0]?.id;

    if (existingCaptainRegId && captain.products.length > 0 && !registrations.guests) {
      throw new Error('User is already registered for this event');
    }

    if (captain.products.length === 0 && guests.length === 0) {
      throw new Error('No products to register');
    }

    const volunteerDiscounts = await getVolunteerDiscountMap(client, userId, eventId);

    const createRegistration = async (isGuest, guestData = null) => {
      let regResult;

      if (isGuest) {
        regResult = await client.query(
          `INSERT INTO registrations (user_id, event_id, team_id, comments, is_guest, guest_first_name, guest_last_name, year_of_birth, gender, registered_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [
            null,
            eventId,
            guestData.team_id || null,
            guestData.comments || null,
            true,
            guestData.guest_first_name,
            guestData.guest_last_name,
            guestData.year_of_birth || null,
            guestData.gender || null,
            userId
          ]
        );
      } else if (existingCaptainRegId) {
        regResult = await client.query(
          `UPDATE registrations SET team_id = $1, comments = $2 WHERE id = $3 RETURNING id`,
          [captain.teamId || null, captain.comments || null, existingCaptainRegId]
        );
        regResult.rows[0].id = existingCaptainRegId;
      } else {
        regResult = await client.query(
          `INSERT INTO registrations (user_id, event_id, team_id, comments)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [userId, eventId, captain.teamId || null, captain.comments || null]
        );
      }

      const regId = regResult.rows[0].id;
      const productsToAdd = isGuest ? guestData.products : captain.products;

      await validateIdentifyingProducts(client, productsToAdd, eventId);

      for (const { product_id, quantity, field_values } of productsToAdd) {
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new Error('Quantity must be a positive integer');
        }
        if (field_values && typeof field_values !== 'object') {
          throw new Error('field_values must be an object');
        }

        const productInfo = await client.query(
          'SELECT name, price, fields, quantity, available_from, available_until FROM event_products WHERE id = $1',
          [product_id]
        );
        if (!productInfo.rows[0]) {
          throw new Error(`Product ${product_id} not found`);
        }

        const now = new Date();
        if (productInfo.rows[0].available_from && now < new Date(productInfo.rows[0].available_from)) {
          throw new Error(`${productInfo.rows[0].name} is not yet available for purchase`);
        }
        if (productInfo.rows[0].available_until && now > new Date(productInfo.rows[0].available_until)) {
          throw new Error(`${productInfo.rows[0].name} is no longer available for purchase`);
        }

        const fields = productInfo.rows[0].fields || [];
        for (const field of fields) {
          if (field.type === 'select') {
            const selectedValue = field_values?.[field.id];
            if (!selectedValue) {
              throw new Error(`${field.label} is required`);
            }
          } else if (field.type === 'checkbox') {
            await validateCheckboxSelection(client, field, field_values?.[field.id], product_id);
          }
        }

        if (productInfo.rows[0].quantity !== null) {
          const used = await client.query(
            'SELECT COALESCE(SUM(quantity), 0) as used FROM registration_products WHERE product_id = $1 AND deleted_at IS NULL',
            [product_id]
          );
          const remaining = productInfo.rows[0].quantity - parseInt(used.rows[0].used);
          if (remaining < quantity) {
            throw new Error(`${productInfo.rows[0].name} has insufficient stock (${remaining} available, ${quantity} requested)`);
          }
        }

        const listPrice = resolvePrice(productInfo.rows[0].price, fields, field_values);
        let productPrice = listPrice;
        if (!isGuest) {
          productPrice = applyVolunteerDiscount(productPrice, volunteerDiscounts.get(product_id));
        }
        totalCents += Math.round(productPrice * quantity * 100);

        await client.query(
          `INSERT INTO registration_products (registration_id, product_id, quantity, field_values, product_name, product_price, snapshot_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [regId, product_id, quantity, JSON.stringify(field_values || {}), productInfo.rows[0]?.name || null, listPrice]
        );
      }

      return regId;
    };

    let captainRegId;
    if (captain.products.length > 0) {
      captainRegId = await createRegistration(false);
      registrationIds.push(captainRegId);
    }

    for (const guest of guests) {
      const guestRegId = await createRegistration(true, guest);
      registrationIds.push(guestRegId);
    }

    if (captain.teamId) {
      const teamInfo = await client.query(
        'SELECT auto_approve_joins FROM teams WHERE id = $1',
        [captain.teamId]
      );
      if (teamInfo.rows[0] && teamInfo.rows[0].auto_approve_joins) {
        try {
          await client.query(
            `INSERT INTO team_members (team_id, user_id, role, status, invited_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (team_id, user_id) DO UPDATE SET status = 'approved'`,
            [captain.teamId, userId, 'member', 'approved', userId]
          );
        } catch (err) {
          console.error('[CHECKOUT RECOVERY] Failed to auto-join captain to team:', err.message);
        }
      }
    }

    if (eventCapacity) {
      const identifyingCount = await countIdentifyingRegistrations(client, eventId);
      if (identifyingCount > eventCapacity) {
        throw new Error('Event is full');
      }
    }

    // The money is already genuinely taken by this point (that's exactly why this
    // recovery exists), so the amount actually charged by Stripe — not what we computed
    // minutes ago when the checkout started — is the authoritative figure. If pricing
    // config drifted in the meantime, catch it here rather than silently recording the
    // wrong amount.
    if (totalCents !== paymentIntent.amount) {
      throw new Error(`Recomputed total (${totalCents}) does not match the amount actually charged by Stripe (${paymentIntent.amount})`);
    }

    const primaryRegId = captainRegId || registrationIds[0];

    await client.query(
      `INSERT INTO payment_intents (stripe_payment_intent_id, registration_id, amount_cents, status)
       VALUES ($1, $2, $3, $4)`,
      [paymentIntentId, primaryRegId, totalCents, 'succeeded']
    );

    const invoiceNumber = `INV-${primaryRegId}-${Date.now()}`;
    await client.query(
      `INSERT INTO invoices (registration_id, amount_cents, invoice_number, paid_at)
       VALUES ($1, $2, $3, NOW())`,
      [primaryRegId, totalCents, invoiceNumber]
    );

    await client.query(
      'UPDATE registrations SET payment_status = $1 WHERE id = ANY($2)',
      ['paid', registrationIds]
    );

    await client.query('COMMIT');

    await clearPendingCheckout(paymentIntentId);

    console.log(`[CHECKOUT RECOVERY] Recovered orphaned payment ${paymentIntentId}: created ${registrationIds.length} registration(s) ${registrationIds.join(', ')}`);
    logHelpers.registrationSuccess(registrationIds, eventId);
    logHelpers.checkoutRecovered(paymentIntentId, registrationIds, totalCents);

    if (primaryRegId) {
      try {
        await pool.query(
          `INSERT INTO email_queue (registration_id, email_type, recipient_email, status)
           VALUES ($1, $2, $3, $4)`,
          [primaryRegId, 'registration_confirmation', stash.recipient_email, 'pending']
        );
      } catch (err) {
        console.error('[CHECKOUT RECOVERY] Failed to queue confirmation email:', err.message);
      }
    }

    return { recovered: true, registrationIds, primaryRegId, totalCents };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[CHECKOUT RECOVERY ERROR]', paymentIntentId, err.message);

    // The money is already captured/settled — if we can't complete the registration
    // (stock sold out in the meantime, event got cancelled, etc.), the customer must not
    // be left charged with nothing to show for it.
    try {
      await refundPaymentIntent(paymentIntentId, stripeMode);
      logHelpers.checkoutRecoveryFailed(paymentIntentId, err, true);
    } catch (refundErr) {
      console.error('[CHECKOUT RECOVERY] CRITICAL: failed to auto-refund after failed recovery:', refundErr.message);
      logHelpers.checkoutRecoveryFailed(paymentIntentId, err, false);
    }

    // Either way this payment intent's fate is now settled (refunded, or needs a human
    // to sort out per the CRITICAL log above) — don't keep retrying it every sweep.
    await clearPendingCheckout(paymentIntentId);

    return { recovered: false, reason: 'failed', error: err.message };
  } finally {
    client.release();
  }
}

/**
 * Periodic sweep: find stashed checkouts old enough to no longer be "still in
 * progress", check each one's real status directly with Stripe, and either recover it,
 * leave it for next time, or clean it up as abandoned.
 */
async function sweepAbandonedCheckouts() {
  let candidates;
  try {
    const result = await pool.query(
      `SELECT pc.*, e.stripe_mode
       FROM pending_checkouts pc
       JOIN events e ON e.id = pc.event_id
       WHERE pc.created_at < NOW() - make_interval(secs => $1)
       AND NOT EXISTS (
         SELECT 1 FROM payment_intents pi WHERE pi.stripe_payment_intent_id = pc.stripe_payment_intent_id
       )
       ORDER BY pc.created_at ASC
       LIMIT 20`,
      [GRACE_PERIOD_MS / 1000]
    );
    candidates = result.rows;
  } catch (err) {
    console.error('[CHECKOUT RECOVERY] Sweep failed to query candidates:', err.message);
    return;
  }

  if (candidates.length === 0) return;

  console.log(`[CHECKOUT RECOVERY] Sweeping ${candidates.length} stashed checkout(s) with no matching payment record`);

  for (const stash of candidates) {
    const stripeMode = stash.stripe_mode || 'test';
    const paymentIntentId = stash.stripe_payment_intent_id;
    const ageMs = Date.now() - new Date(stash.created_at).getTime();

    try {
      const paymentIntent = await getPaymentIntent(paymentIntentId, stripeMode);

      if (paymentIntent.status === 'succeeded') {
        await recoverPendingCheckout(stash, stripeMode, paymentIntent);
      } else if (paymentIntent.status === 'requires_capture') {
        // A manual-capture card that was authorized but never captured because
        // confirm-payment never ran. We have everything needed to finish the job
        // ourselves — capture it now, then complete the registration exactly as above.
        const captured = await capturePaymentIntent(paymentIntentId, stripeMode);
        if (captured.status === 'succeeded') {
          await recoverPendingCheckout(stash, stripeMode, captured);
        }
      } else if (paymentIntent.status === 'canceled') {
        // Definitively not paid — nothing to recover.
        await clearPendingCheckout(paymentIntentId);
      } else if (ageMs > ABANDON_AFTER_MS) {
        // Still unresolved (requires_payment_method, requires_action, processing) after
        // a full day — treat as an abandoned cart and stop checking it.
        console.log(`[CHECKOUT RECOVERY] Giving up on stale unresolved checkout ${paymentIntentId} (status: ${paymentIntent.status})`);
        await clearPendingCheckout(paymentIntentId);
      }
      // Otherwise: still genuinely in progress or too recent to give up on — leave it
      // for the next sweep.
    } catch (err) {
      console.error(`[CHECKOUT RECOVERY] Failed to process stash ${paymentIntentId}:`, err.message);
      // Leave the stash in place; it'll be retried on the next sweep.
    }
  }
}

module.exports = {
  stashPendingCheckout,
  clearPendingCheckout,
  recoverPendingCheckout,
  sweepAbandonedCheckouts,
  SWEEP_INTERVAL_MS
};
