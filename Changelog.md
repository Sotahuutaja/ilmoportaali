# Changelog

All notable changes to Ilmoportaali are documented in this file.

## [Latest] — 2026-06-04

### Security Fixes

- **Payment Intent Ownership Verification** — Added email validation to ensure authenticated user owns the payment intent being confirmed, preventing account compromise from token hijacking
- **Quantity Validation** — Added positive integer validation on product quantities in payment endpoints, preventing price manipulation via negative quantities
- **Duplicate Registration Prevention** — Implemented SELECT...FOR UPDATE row locking during payment confirmation to prevent race conditions from concurrent payments
- **Payment Amount Reconciliation** — Frontend now sends expected amount to backend for validation against Stripe payment amount, catching price calculation discrepancies

### Data Integrity

- **Payment Status Tracking** — Added automatic update of `payment_status = 'paid'` for all registrations (captain and guests) after successful payment
- **Guest Registration Constraints** — Added CHECK constraint ensuring guest registrations have either user_id or registered_by set, preventing orphaned records
- **Per-Option Inventory Tracking** — Fixed quantity limit tracking to work correctly per product option/variant (e.g., Size S: 5, M: 4, L: 3 are now independently tracked)
- **Product Quantity Filtering** — Fixed product remaining quantity calculation to filter by current event only (was counting registrations across all events)

### Email Delivery System

- **Email Queue with Retry Logic** — Implemented email_queue table with automatic retry mechanism (up to 3 attempts) for reliable email delivery
- **Email Worker Service** — Added background email worker that processes 10 queued emails every 30 seconds with automatic retries on failure
- **Cancellation Email Reliability** — Fixed cancellation emails by storing full email content in queue before registration deletion (prevents loss via CASCADE delete)
- **Email Label Transformation** — Fixed confirmation emails to display readable field labels instead of IDs (e.g., "Size: Large" instead of "ke2r7ef: L")

### Features & Improvements

- **Guest Data Persistence** — Guest registration data now persists to localStorage during checkout, recovering from page refresh
- **Idempotency Protection** — Added check to prevent duplicate registrations from concurrent payment confirmation attempts
- **Out-of-Stock Options** — Product options are now disabled and show "out of stock" when inventory reaches 0, preventing overselling
- **Stock Recount on Cancellation** — When a registration is cancelled, the product option's stock automatically increases (dynamic calculation)

### Bug Fixes

- **Frontend Quantity Display** — Fixed EventDetail component to display calculated remaining quantities instead of static limits
- **Field Value Type Validation** — Added validation to ensure field_values is an object, catching malformed input early

---

## [Latest] — 2026-06-03

### Security Fixes

- **Fixed JWT Token XSS Vulnerability** — Authentication tokens now stored in secure httpOnly cookies instead of localStorage, preventing XSS attacks via JavaScript access
- **Reduced Token Expiration** — Access tokens now expire in 15 minutes (was exposed for extended periods)
- **Refresh Token Implementation** — Added automatic token refresh with 30-minute refresh token expiration
- **Secure Cookie Configuration** — Tokens set with httpOnly, secure, and sameSite=strict flags
- **Logout Endpoint** — Added POST /auth/logout endpoint that clears authentication cookies

### Features

- **Logout Redirect** — Users are now redirected to the login page when clicking logout (improved UX)
- **Per-Option Product Pricing** — Event creators can set custom prices for individual dropdown options
  - If no custom price is set for an option, the product's default price is displayed
  - Users see option prices in the registration dropdown (e.g., "Small — €15.00")
- **Per-Option Quantity Limits** — Event creators can set maximum quantities for individual dropdown options
  - Users see available quantity when selecting an option (e.g., "Large (5 available)")
- **Manager Role Visibility** — Event creators now see the original event creator in the managers list with a "creator" badge, alongside any co-managers marked with a "co-manager" badge

### Improvements

- **Product Option Display** — Improved UI for setting option pricing and quantity limits with better form layout
- **Backward Compatibility** — Option system supports both legacy string format and new object format with pricing/quantity

---

## Previous Versions

For security audit findings and remediation details, see `SECURITY_AUDIT_REPORT.md`.
