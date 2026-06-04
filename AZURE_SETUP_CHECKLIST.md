# Azure Configuration for Stripe Payment Integration

This is a quick checklist of what needs to be added to Azure **after** you push the code changes to GitHub.

## What's Ready to Push

The following files have been added locally and are ready to commit:
- ✅ Backend Stripe service and routes
- ✅ Frontend Stripe provider and components
- ✅ Database schema for payments
- ✅ Updated app configuration files
- ✅ Dependencies already in package.json files

**You can push all these to GitHub now. The site will still work in mock mode without Stripe credentials.**

---

## What Needs to Be Configured in Azure

### Only needed if you want REAL payment processing

If you just want to test the **mock payment system** (recommended first), you don't need to do anything in Azure.

---

## Manual Azure Configuration (for Real Payments)

If you want to enable real Stripe payments, follow these steps:

### 1. Add Secrets to Azure Container Apps

**Via Azure Portal:**
1. Open your Container Apps resource
2. Click **Secrets** → **Add**
3. Add these secrets (name and value):
   - `stripe-secret-key` = Your Stripe Secret Key
   - `stripe-webhook-secret` = Your Stripe Webhook Signing Secret
   - `stripe-publishable-key` = Your Stripe Publishable Key

### 2. Update Environment Variables

**For Backend Container:**
- Add environment variable: `STRIPE_SECRET_KEY` → Reference secret `stripe-secret-key`
- Add environment variable: `STRIPE_WEBHOOK_SECRET` → Reference secret `stripe-webhook-secret`

**For Frontend Container:**
- Add environment variable: `REACT_APP_STRIPE_PUBLISHABLE_KEY` → Reference secret `stripe-publishable-key`

### 3. Get Stripe Credentials

Visit [Stripe Dashboard](https://dashboard.stripe.com):
1. Go to **Developers** → **API Keys**
2. Copy your **Secret Key** and **Publishable Key**
3. Go to **Webhooks**
4. Add endpoint: `https://your-api-domain.com/api/webhooks/stripe`
5. Copy the **Signing Secret**

### 4. Update Database Schema

Connect to your PostgreSQL database and run:
```sql
-- File: backend/src/schema/payment-schema.sql
-- Run this entire file in your database
```

---

## Testing Without Stripe Credentials

You can test the entire payment flow **without** configuring Stripe:

1. Push the code to GitHub
2. Site deploys automatically
3. When users register for paid events, they'll see a payment form
4. In mock mode, it auto-completes without real Stripe

**This is perfect for testing the UI and database integration before going live with real payments.**

---

## Summary of Environment Variables

| Variable | Where | Source | Format |
|----------|-------|--------|--------|
| `STRIPE_SECRET_KEY` | Backend Secret | Stripe Dashboard API Keys | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Backend Secret | Stripe Dashboard Webhooks | `whsec_...` |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | Frontend Env | Stripe Dashboard API Keys | `pk_live_...` or `pk_test_...` |

---

## Verification Checklist

After pushing to GitHub:
- [ ] Code builds successfully (check GitHub Actions)
- [ ] Site loads and you can create events
- [ ] You can register for an event with products
- [ ] Payment form appears during registration
- [ ] In mock mode, payment completes without entering card
- [ ] Registration is recorded in database
- [ ] (Optional) If Stripe configured: real payments work

---

## Need Real Payments Later?

Just follow the "Manual Azure Configuration" section above once you have a Stripe account set up.

Until then, mock mode works great for testing!
