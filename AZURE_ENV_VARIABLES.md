# Azure Environment Variables for Payment Integration

## Quick Reference

Add these environment variables to your Azure Container Apps **only if you want to enable real Stripe payments**.

### For Mock Mode Testing
**No configuration needed.** The site works out of the box.

### For Real Stripe Payments
You need 3 environment variables (2 for backend, 1 for frontend).

---

## Step 1: Get Credentials from Stripe

### Stripe Secret Key
1. Go to https://dashboard.stripe.com
2. Click **Developers** (top right)
3. Click **API keys** (left sidebar)
4. Find "Secret key"
5. Click **Reveal test key** (or live key)
6. Copy it - looks like: `sk_test_xxxxxxxxxxxxxxxxxxxx`

### Stripe Publishable Key
1. Same location as above
2. Find "Publishable key"
3. Copy it - looks like: `pk_test_xxxxxxxxxxxxxxxxxxxx`

### Stripe Webhook Signing Secret
1. In Stripe Dashboard, click **Webhooks** (left sidebar under Developers)
2. Click **Add endpoint**
3. URL: `https://your-api-domain/api/webhooks/stripe` (replace with your actual domain)
4. Events to send:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Click **Add endpoint**
6. Click on the endpoint you just created
7. Find "Signing secret"
8. Click **Reveal**
9. Copy it - looks like: `whsec_xxxxxxxxxxxxxxxxxxxx`

---

## Step 2: Add to Azure Container Apps

### Via Azure Portal

**For Backend Container:**

1. Go to your Container Apps resource in Azure Portal
2. Click **Secrets** (left sidebar)
3. Click **+ Add**
4. Add Secret 1:
   - Name: `stripe-secret-key`
   - Value: `sk_test_...` (paste your Stripe Secret Key)
   - Click **Add**
5. Add Secret 2:
   - Name: `stripe-webhook-secret`
   - Value: `whsec_...` (paste your Stripe Webhook Signing Secret)
   - Click **Add**

6. Click **Containers** (left sidebar)
7. Click **Edit and deploy**
8. Under **Backend** container, scroll to "Environment variables"
9. Add Variable 1:
   - Name: `STRIPE_SECRET_KEY`
   - Value type: **Secret**
   - Value: Select `stripe-secret-key`
10. Add Variable 2:
    - Name: `STRIPE_WEBHOOK_SECRET`
    - Value type: **Secret**
    - Value: Select `stripe-webhook-secret`
11. Click **Save** and **Deploy**

**For Frontend Container:**

1. Still in **Containers** → **Edit and deploy**
2. Under **Frontend** container, scroll to "Environment variables"
3. Add Variable:
   - Name: `REACT_APP_STRIPE_PUBLISHABLE_KEY`
   - Value type: **Value** (not secret, this is public)
   - Value: `pk_test_...` (paste your Stripe Publishable Key)
4. Click **Save** and **Deploy**

### Via Azure CLI

```bash
# Set the secrets
az containerapp secret set \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --secrets "stripe-secret-key=sk_test_..." \
            "stripe-webhook-secret=whsec_..." \
            "stripe-publishable-key=pk_test_..."

# Update backend container
az containerapp update \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --set-env-vars STRIPE_SECRET_KEY=secretref:stripe-secret-key \
                  STRIPE_WEBHOOK_SECRET=secretref:stripe-webhook-secret

# Update frontend container
az containerapp update \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --set-env-vars REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Environment Variables Reference

| Name | Container | Type | Source | Example |
|------|-----------|------|--------|---------|
| `STRIPE_SECRET_KEY` | Backend | Secret | Stripe Dashboard → API Keys | `sk_test_51234567890...` |
| `STRIPE_WEBHOOK_SECRET` | Backend | Secret | Stripe Dashboard → Webhooks | `whsec_test_1234567890...` |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | Frontend | Env Value | Stripe Dashboard → API Keys | `pk_test_51234567890...` |

---

## Testing Your Configuration

### Check Logs
```bash
# See if Stripe connected successfully
az containerapp logs show \
  --name <your-app-name> \
  --resource-group <your-resource-group> \
  --container-name backend \
  --follow
```

Look for these log lines:
```
[STRIPE] Payment intent created: pi_...
[STRIPE] Payment intent retrieved: pi_...
[WEBHOOK] Received Stripe event: payment_intent.succeeded
```

### Verify Webhook Delivery
1. Go to Stripe Dashboard
2. Click **Webhooks**
3. Click on your endpoint
4. Scroll to **Events**
5. Should see successful deliveries (`200 OK`)

---

## Test Cards (if using test mode)

Use these card numbers to test in Stripe test mode:

| Card | Number | CVC | Expiry | Result |
|------|--------|-----|--------|--------|
| Visa (Success) | `4242 4242 4242 4242` | Any | Any future | ✅ Succeeds |
| Visa (Decline) | `4000 0000 0000 0002` | Any | Any future | ❌ Declines |
| Visa (3D Secure) | `4000 0025 0000 3155` | Any | Any future | Requires auth |
| Mastercard | `5555 5555 5555 4444` | Any | Any future | ✅ Succeeds |

---

## Switching from Test to Live

When you want to go live:

1. In Stripe Dashboard, view **Live keys** (instead of Test keys)
2. Copy your **Live Secret Key** and **Live Publishable Key**
3. Update Azure variables with live keys:
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `REACT_APP_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
4. Verify webhook endpoint uses your live domain
5. Test with real payments

---

## Troubleshooting

### "Mock Mode: No real payment required for testing"
This message means Stripe credentials are not configured.
**Solution**: Verify environment variables are set in Azure.

### "Failed to create payment intent"
Stripe rejected the request.
**Solution**: 
- Check `STRIPE_SECRET_KEY` is correct
- Check it's not expired or revoked in Stripe Dashboard
- Check logs: `az containerapp logs show`

### Webhook not receiving events
**Solution**:
- Verify webhook endpoint URL is correct in Stripe Dashboard
- Check webhook signing secret in Azure matches Stripe Dashboard
- Look at Stripe Dashboard → Webhooks → click endpoint → scroll to events
- Enable CORS if needed (should already be configured)

### Payments fail in real mode
**Solution**:
- Use test card `4242 4242 4242 4242` first to verify
- Check Stripe Dashboard for declined payments
- Verify payment intent amount is greater than €0.01
- Check browser console and Azure logs for errors

---

## Summary

To enable real Stripe payments in Azure:

1. **Get 3 values from Stripe Dashboard**
   - Secret Key (sk_...)
   - Publishable Key (pk_...)
   - Webhook Signing Secret (whsec_...)

2. **Add to Azure Container Apps**
   - 2 secrets + environment variables for backend
   - 1 environment variable for frontend

3. **Configure webhook in Stripe**
   - URL: `https://your-domain/api/webhooks/stripe`
   - Events: `payment_intent.*`

4. **Test**
   - Use test cards from Stripe
   - Verify logs show successful payments
   - Check database for payment records

That's it! Real payments will work automatically.
