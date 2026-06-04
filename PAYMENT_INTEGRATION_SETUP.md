# Stripe Payment Integration Setup Guide

This guide explains how to integrate Stripe payment processing with the ilmoportaali application.

## Overview

The payment system is designed to work in **two modes**:

1. **Mock Mode** (Default for Development)
   - No Stripe account required
   - No real payment processing
   - Perfect for testing without credentials
   - Automatically simulates successful payments

2. **Production Mode** (Real Payments)
   - Requires active Stripe account
   - Real payment processing with Stripe
   - Automatic switch when credentials are configured

## What's Changed in the Code

### New Backend Files
- `backend/src/services/stripeService.js` - Stripe API wrapper with mock fallback
- `backend/src/routes/payments.js` - Payment intent creation and confirmation endpoints
- `backend/src/routes/webhooks.js` - Webhook handlers for Stripe events
- `backend/src/schema/payment-schema.sql` - Database tables for payments and invoices

### New Frontend Files
- `frontend/src/components/StripeProvider.jsx` - Stripe context provider (wraps the app)
- `frontend/src/components/PaymentForm.jsx` - Payment form component with card collection
- `frontend/src/components/PaymentForm.css` - Styling for payment form

### Modified Files
- `frontend/package.json` - Added Stripe libraries (already done)
- `backend/package.json` - Added Stripe package (already done)
- `frontend/src/App.jsx` - Wrapped with StripeProvider
- `backend/src/index.js` - Registered payment and webhook routes

### New Database Tables
- `payment_intents` - Tracks Stripe PaymentIntent objects
- `invoices` - Tracks successful payments and invoices
- Updated `registrations` table - Added `payment_status` column

## Testing in Mock Mode (No Stripe Account Needed)

To test the payment flow **without Stripe credentials**:

1. **Install dependencies locally**
   ```bash
   cd backend
   npm install
   
   cd ../frontend
   npm install
   ```

2. **Run locally**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm start
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

3. **Test registration flow**
   - Create an event with products
   - Register for an event
   - Complete payment (mock mode automatically succeeds)
   - Check database for recorded payment

**No Azure configuration needed for mock mode.**

## Enabling Real Payments (Production)

To enable real Stripe payments, you need to configure environment variables in Azure.

### Step 1: Get Stripe Credentials

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create an account or sign in
3. Navigate to **Developers** → **API keys**
4. Copy your keys:
   - **Secret Key** (starts with `sk_live_` or `sk_test_`)
   - **Publishable Key** (starts with `pk_live_` or `pk_test_`)
   - **Webhook Signing Secret** (from **Webhooks** section)

### Step 2: Configure Azure Container Apps

Add these environment variables to your Azure Container Apps:

#### For the Backend Container
- `STRIPE_SECRET_KEY` = `sk_test_...` (or `sk_live_...` for production)
- `STRIPE_WEBHOOK_SECRET` = `whsec_...` (webhook signing secret from Stripe)

#### For the Frontend Container
- `REACT_APP_STRIPE_PUBLISHABLE_KEY` = `pk_test_...` (or `pk_live_...` for production)

### Step 3: Configure Stripe Webhooks

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Add a new endpoint
3. **Endpoint URL**: `https://your-api-domain.com/api/webhooks/stripe`
4. **Events to send**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Copy the webhook signing secret and add it to Azure as `STRIPE_WEBHOOK_SECRET`

### Step 4: Update Database Schema

Run the payment schema initialization in your PostgreSQL database:

```sql
-- Run this in your database
CREATE TABLE IF NOT EXISTS payment_intents (
  id SERIAL PRIMARY KEY,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  registration_id INTEGER,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'eur',
  status VARCHAR(50) NOT NULL DEFAULT 'requires_payment_method',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_id
  ON payment_intents(stripe_payment_intent_id);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  invoice_number VARCHAR(255) UNIQUE NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_registrations_payment_status
  ON registrations(payment_status);
```

Or use the provided script: `backend/src/schema/payment-schema.sql`

## How to Set Environment Variables in Azure Container Apps

### Via Azure Portal
1. Go to your Container Apps resource
2. Click on **Secrets** in the left sidebar
3. Click **+ Add**
4. Enter the secret name (e.g., `STRIPE_SECRET_KEY`) and value
5. Click **Add**
6. Click on **Containers**
7. For each container, add the environment variables:
   - Click **Edit and deploy**
   - Under "Environment variables", add:
     - Name: `STRIPE_SECRET_KEY`
     - Select **Secret reference** and choose the secret you created
   - Repeat for other Stripe variables

### Via Azure CLI
```bash
az containerapp secret set \
  --name <app-name> \
  --resource-group <resource-group> \
  --secrets "stripe-secret-key=<your-secret-key>" \
              "stripe-webhook-secret=<your-webhook-secret>"

az containerapp update \
  --name <app-name> \
  --resource-group <resource-group> \
  --container-name backend \
  --set-env-vars "STRIPE_SECRET_KEY=secretref:stripe-secret-key"
```

## API Endpoints

### Create Payment Intent
```
POST /api/payments/create-payment-intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventId": 1,
  "products": [
    {
      "product_id": 1,
      "quantity": 1,
      "field_values": { "size": "L" }
    }
  ],
  "teamId": null,
  "comments": "Special dietary requirements"
}

Response:
{
  "clientSecret": "pi_..._secret_...",
  "paymentIntentId": "pi_...",
  "amount": 1500,
  "amountFormatted": "€15.00",
  "mockMode": false
}
```

### Confirm Payment
```
POST /api/payments/confirm-payment
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentIntentId": "pi_..."
}

Response:
{
  "success": true,
  "registrationId": 42,
  "invoiceNumber": "INV-42-1717500000000",
  "amount": 1500,
  "amountFormatted": "€15.00"
}
```

### Check Payment Status
```
GET /api/payments/status/:paymentIntentId
Authorization: Bearer <token>

Response:
{
  "id": "pi_...",
  "status": "succeeded",
  "amount": 1500,
  "amountFormatted": "€15.00"
}
```

## Payment Flow

1. **User selects products and initiates registration**
   - Frontend calls `POST /api/payments/create-payment-intent`
   - Backend creates a Stripe PaymentIntent (or mock)
   - Frontend receives `clientSecret` and `paymentIntentId`

2. **User enters payment details (or skips in mock mode)**
   - In mock mode: payment automatically succeeds
   - In real mode: user completes Stripe payment form

3. **Payment confirmation**
   - Frontend calls `POST /api/payments/confirm-payment`
   - Backend verifies payment with Stripe
   - Backend creates registration and records payment
   - Database updated with payment status

4. **Webhook events**
   - Stripe sends webhook events to `/api/webhooks/stripe`
   - Backend updates payment status in database

## Database Schema

### payment_intents Table
- Tracks all Stripe PaymentIntent objects
- Linked to registrations
- Status can be: `requires_payment_method`, `processing`, `requires_action`, `succeeded`, `canceled`, `failed`
- Used for tracking payment history and reconciliation

### invoices Table
- Created only after successful payment
- Contains invoice number, amount, and dates
- Used for accounting and customer receipts

### registrations Table
- Added `payment_status` column
- Values: `pending`, `processing`, `paid`, `failed`, `refunded`
- Allows filtering registrations by payment status

## Troubleshooting

### "Mock Mode: No real payment required for testing"
This means Stripe is not configured. You're running in mock mode.
**Solution**: Add Stripe credentials to Azure environment variables.

### "Payment not found in database"
The webhook handler is running, but the payment doesn't exist.
**Solution**: Verify webhook endpoint is configured correctly in Stripe Dashboard.

### Payment status not updating
Webhooks may not be configured or webhook endpoint is unreachable.
**Solution**: 
1. Verify webhook URL is accessible from internet
2. Check Azure logs: `az containerapp logs show --name <app> --resource-group <group>`
3. Verify webhook secret is correct

### Card payment fails in test mode
Stripe provides test card numbers:
- **Visa**: `4242 4242 4242 4242` (succeeds)
- **Visa (decline)**: `4000 0000 0000 0002` (declines)
- **CVC**: Any 3 digits
- **Expiry**: Any future date

## Security Considerations

1. **Secret Keys** - Never expose `STRIPE_SECRET_KEY` in frontend code
2. **Webhook Verification** - All webhooks are verified using signing secret
3. **CORS** - Payment API requires authentication via JWT
4. **PCI Compliance** - Card data never touches your server (handled by Stripe)
5. **Idempotency** - Payment confirmation checks payment status before creating registration

## Support

For Stripe integration issues:
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Testing Guide](https://stripe.com/docs/testing)

For application issues:
- Check backend logs in Azure: `az containerapp logs show`
- Check webhook events in Stripe Dashboard
- Review payment status in database: `SELECT * FROM payment_intents;`
