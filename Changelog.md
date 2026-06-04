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

## 2026-06-03

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

## 2026-06-02

### Security Fixes

- **CRITICAL: Fixed CORS Wildcard Misconfiguration** — Replaced insecure `|| '*'` fallback with whitelist-based CORS
  - API now only accepts requests from whitelisted origins (APP_URL + localhost for development)
  - Prevents CSRF attacks and cross-origin data theft
  - Rejects requests from unauthorized origins
  - Logs privilege escalation attempts
- **CRITICAL: Fixed JWT Role Verification** — No longer trusts JWT role claims without database verification
  - `requireRole()` middleware now re-verifies role against database on each request
  - Prevents privilege escalation if JWT_SECRET is compromised
  - Detects and logs unauthorized role claims
  - Updated all route files to pass pool parameter to requireRole middleware

### Features

- **Event Deletion** — Admins can now delete events with registered participants
  - Registrations are automatically deleted with the event
  - Database schema updated to use ON DELETE CASCADE for event registrations
  - Backend uses transactions to ensure atomic deletion (event + all registrations)

### Improvements

- **Team Management** — Multiple improvements to team functionality
  - Admins can now set auto-approval for teams during team creation
  - Admins can change the auto-approval setting when editing teams
  - Users can now leave teams (previously only captains could remove members)
  - Type conversion fixes in team member endpoints (DELETE and PUT)
  - Improved Teams page UX: "All teams" renamed to "Other teams" and filters out teams user is already a member of
  - Dynamic button text on Teams page: shows "Join" for auto-approved teams, "Request to join" for teams requiring approval

### Bug Fixes

- **Fixed team membership not being recognized** — GET /my/memberships now returns team_id instead of membership id
- **Fixed users unable to leave teams** — Added proper endpoint support
- **Fixed admin panel endpoint** — Added missing PUT /teams/:id/members/:userId endpoint for demoting captains
- **Fixed Teams.jsx approve/reject functions** — Now uses correct backend endpoints
- **Fixed captain name display** — Team creation form now properly displays names with first/last name fallback

---

## 2026-05-31

### Features

- **Event Comments** — Added comments field to event registration
  - Users can provide additional information for event organizers
  - Comments are optional and displayed in both self-registration and guest registration forms
  - Comments are included in CSV exports so organizers can review all notes
  - Database migration adds `comments TEXT` column to registrations table
- **Product Options Visibility** — Product options now visible in event management dashboard
  - Shows field labels and types
  - Fixed GROUP BY clause in products GET endpoint to properly return all columns

### Improvements

- **Dashboard UI** — Removed redundant "Products" button from event management dashboard
  - Product management is now only accessible via the "Edit" button (includes all product editing)
  - Improved team name color visibility in team registrations view (now uses accent color)

### Bug Fixes

- **Fixed incomplete registrations.js file** — File was truncated mid-statement
- **Restored missing endpoints** — PUT registration updates including field_values and comments handling
- **Fixed duplicate field entries** — Registrations GET response query now returns unique fields

---

## 2026-05-30

### Features

- **Event Registration Periods** — Events now require a registration open and close datetime
  - Users can only register within the period
  - Outside the period, event page shows "Registration opens on [date]" or "Registration is closed"
  - Registration period enforced on both self-registration and guest registration endpoints
  - Past events moved to a separate collapsed section on the events listing page

### Code Quality

- **Code Normalization** — Normalized all source files to consistent 2-space indentation and LF line endings
- **Dev Scripts Cleanup** — Removed three one-off dev scripts from the codebase (check-db.js, fix-name-column.js, verify-existing-users.js)
- **Import Cleanup** — Removed dead `pool` import from utils/eventAccess.js
- **Code Organization** — Removed duplicate `canManageEvent` function from routes/events.js (now imported from utils/eventAccess.js)
- **Scope Fixes** — Moved `handleSave` and `handlePasswordReset` in Profile.jsx to correct top-level scope
- **Component Fixes** — Moved `ProductSelector` component in EventDetail.jsx outside the render function to prevent unnecessary remounts
- **Formatting Fixes** — Fixed second `useEffect` in EventDetail.jsx missing indentation
- **Logic Fixes** — Fixed `buildProducts` being called twice in EventDetail.jsx register function
