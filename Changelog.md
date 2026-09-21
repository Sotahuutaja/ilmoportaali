# Changelog

All notable changes to Ilmoportaali are documented in this file.

## 2026-09-21

### Bug Fixes

- **"From" price stuck showing even after picking an option, when a product has more than one priced checkbox field** — the fix above (`hasUnselectedPricedCheckbox()`) checked whether *any* of a product's priced checkbox fields was still empty, so a product with two priced checkbox fields (e.g. "room size" and "extra mattress") kept showing the "From €X.XX" hint until *both* had an answer, even after the registrant had already picked a room size and the real price was known. Fixed to check that *every* priced checkbox field is still empty — the displayed price now starts tracking the running total the moment the registrant checks anything in any one of a product's priced checkbox fields, and keeps updating live as they check more, rather than waiting for every required field on the product to be answered first

- **Misleading €0.00 shown for products priced entirely by checkboxes** — a product with priced checkbox options correctly computes to €0.00 before the registrant has checked anything, but showing that as the product's price on the registration page read as "this is free" rather than "pick options to see the price" — especially for a product that does have its own base ("default") price set, since that base price is otherwise completely ignored once a checkbox field is priced (see "Per-checkbox pricing" below) and never entered the calculation at all, even as a fallback. The registration page (`EventDetail.jsx`'s product list, both the captain's own and any guest's) now shows that base price as an informational "From €X.XX" starting figure instead, for a product whose price depends on a priced checkbox field with nothing checked in it yet; if the product's base price is also €0, it falls back to "Select options for price". As soon as anything in that field is checked, even an option worth €0 itself, the real computed price shows again — the "From" figure was only ever a hint, never part of the actual total. New `hasUnselectedPricedCheckbox()` helper in `frontend/src/utils/pricing.js`, alongside `resolvePrice()`; no backend or pricing-logic change, purely how the not-yet-priced state is displayed

## 2026-09-20

### Features & Improvements

- **Edit Event page: collapsed by default, Save button moved to the bottom** — Event details, Products, Volunteer roles, and Allowed teams were all rendered fully expanded at once, which made editing an event with a decent number of products or roles a long, slow scroll before you could even reach the team settings. Every section now starts collapsed (click its header to open it), and the "Save changes" button — previously inside the Event details card near the top, and easy to miss after scrolling past it — now sits full-width and bold at the very bottom of the page, below everything else, with the save error/success message moved down alongside it so it's visible regardless of which sections happen to be open

- **Auto-approving team joins on event registration is no longer the event organizer's call** — the "Allowed teams" checklist on Edit Event used to carry a separate "Auto-approve team joins" toggle per team, letting the *event's* organizer decide whether registering under that team should instantly approve the registrant as a team member. Removed: that's the team's own decision, made by its captain (the same auto-approve setting already used for direct join requests to the team), not the event organizer's. Registering under a team at an event now checks the team's own `auto_approve_joins` instead of a per-event override, and the now-unreachable `PATCH /events/:id/teams/:teamId/auto-join` endpoint was removed along with it. The old per-event `event_teams.auto_approve_joins` column is left in place but unused — no migration drops it, since nothing currently depends on removing it

- **Team-scoped event visibility** — an event can now be hidden entirely from anyone outside its eligible teams, closing the gap noted a while back between the existing team-restricted *registration* and actual discoverability. Off by default (every existing event stays publicly listed); the event creator turns it on from the "Allowed teams" section of Edit Event, and it's disabled there while no eligible teams are configured yet, since that would hide the event from everyone but staff
  - New `events.restrict_visibility` column (migration `006_add_event_visibility_restriction.sql`). When set, both the events listing and the event's own page treat it as if it doesn't exist for anyone who isn't the creator, a co-manager, an admin, an approved member of one of its eligible teams, or already registered for it — a 404, not a 403, so a restricted event's existence isn't leaked to someone probing a URL who shouldn't know about it
  - `GET /events` and `GET /events/:id` were previously fully public with no concept of "who's asking" at all; both now run through a new `optionalAuth` middleware (identifies a logged-in requester when possible, never rejects an anonymous one) so the same routes work for both audiences
  - Deliberately does *not* touch `GET /registrations/my/list` ("My registrations" on the Profile page) — it already reads straight from the registrations/events tables independent of this new check, so a registrant keeps seeing their own registration for an event that's since been restricted, even though the event's own page now 404s for them unless they're still eligible some other way

- **Closed a gap in team-restricted registration** — registering under a team, or adding a guest under one, only ever filtered the dropdown to eligible teams client-side; nothing on the backend stopped a tampered request from submitting a `team_id` that was never actually made eligible for the event (`event_teams`). `confirm-payment` and `confirm-free-registration` now reject any such request outright, before touching the database or (for a paid registration) even verifying the payment intent with Stripe

- **"Allowed teams" is now a checklist, not a dropdown** — Edit Event's team-eligibility section used to list only the teams already added, with a separate "Add a team..." dropdown (one at a time) to add more. Replaced with a single checklist of every team in the system, each with its own checkbox — an organizer can now see and toggle every team's eligibility at a glance instead of hunting through a dropdown for the ones not yet added

- **Per-checkbox pricing** — checkbox-list product fields can now optionally have their own price per option, in addition to the existing min/max-selection and per-option stock limits
  - As soon as any option in a checkbox field has a price set, the field becomes "priced": the sum of the checked options' prices replaces the product's price outright (including replacing it with €0 if nothing priced ends up checked), rather than adding on top of the product's base price — so a product using priced checkboxes should have its own base price left at €0
  - A checkbox field with no priced options keeps working exactly as before and never affects price
  - Added the missing price input for checkbox options in `ProductFieldEditor.jsx`
  - The registration page now shows each checkbox option's price (or "Free") up front, before the registrant checks anything, matching how dropdown options already showed their price — fixes both the captain's own registration and guest registration, since they share the same `ProductSelector` component

- **Consolidated price calculation** — replaced ~21 independent copies of the "check for a dropdown/checkbox option price override" logic (spread across `registrations.js`, `payments.js`, `emailWorker.js`, and four frontend pages/components) with a single shared `resolvePrice()` function in `backend/src/utils/pricing.js` and `frontend/src/utils/pricing.js`. Every checkout, registration, refund, email, and admin edit path now goes through the same function, so a future pricing rule only needs to change in one place
  - Fixed an inconsistency uncovered while consolidating: `EventRegistrants.jsx`'s admin edit modal, refund calculation, and participant list used a truthy check (`if (option.price)`) instead of the correct `!== null && !== undefined` check used everywhere else, so a dropdown option explicitly priced at exactly €0.00 was incorrectly shown/refunded at the product's base price instead of €0 on the admin side. All call sites now agree.

- **Password-protected team joining** — team captains (or admins) can now set an optional join password for their team as a third join method, alongside the existing auto-approve and manual-approval options
  - Setting a password replaces the auto-approve setting as the team's join method entirely: a correct password gets you in immediately, and the auto-approve toggle is disabled (with an explanatory note) while a password is active; removing the password restores normal auto-approve/manual-approval behavior
  - Passwords are hashed with bcrypt (matching the existing account-password convention) and are never returned to the client — the API only ever exposes a `requires_password` boolean, never the hash
  - `POST /teams/:id/request` is now rate-limited (10 attempts / 15 min per IP, same pattern as the login endpoint) since a team password is more guessable than an account password
  - While implementing this, found and fixed three places in `teams.js` (`GET /`, `GET /:id`, and the admin `PUT /:id`) that did `SELECT *`/`t.*` on the teams table — harmless before, but each would have leaked the new password hash to clients (including the fully public `GET /teams` list) had they not been switched to explicit column lists

- **Volunteer discounts now show up before checkout, not just at the charge** — an approved volunteer picking products on the event page previously saw full listed prices the whole way through and only found out about their discount from the amount actually charged (or, worse, could have hit a "payment amount mismatch" error for a partial discount, since the checkout page computed its own `expectedAmount` from listed prices while the backend was correctly applying the discount underneath). Added `GET /events/:eventId/volunteers/my-discounts` (the authenticated user's own approved-role discount rules for that event) and a frontend mirror of `applyVolunteerDiscount()` (`frontend/src/utils/volunteerPricing.js`, alongside the existing `resolvePrice()` mirror) so `EventDetail.jsx`'s product picker and price preview, and `Checkout.jsx`'s summary and total, apply the same discount the backend will — kept strictly to the logged-in user's own products in both files; a guest's products are never discounted, matching the backend

- **Participants/Volunteers view split** — the Participants page previously showed volunteer applications as a small inline card squeezed above the participants table, which didn't scale once an event had more than a couple of applicants and mixed two different things (attendee management, volunteer approval) on one screen. Replaced it with a Participants/Volunteers tab toggle (shown only when the event has volunteering enabled): the Volunteers tab is a full table in the same style as the participants one, with its own search (by name, email, or role) and its own summary tiles (Total applications / Approved / Pending / Rejected)
  - Columns: First name, Last name, Age, Email, Role(s), Applied (date), Accepted/Rejected (date), Application Status, and Actions (Approve/Reject, unchanged from before) — Application Status replaces what would have been a Payment Status column, since a volunteer application isn't a paid registration
  - One row per application, not per person — someone approved for two roles on the same event shows up as two rows, since applied/reviewed dates and the approve/reject action are inherently per-application
  - `GET /events/:eventId/volunteers/applications` now also selects the applicant's `year_of_birth` so the Age column can reuse the same `getAge()` helper the participants table already uses

- **Fixed free registration (removed old pre-Stripe registration routes)** — while building volunteer discounts, traced every place a registration's price gets calculated and found two problems stemming from the same root cause: the app's original, pre-Stripe registration endpoints (`POST /registrations/:eventId` and `POST /registrations/:eventId/guest`, both dating to before payments existed) were never removed when the checkout/Stripe flow replaced them, and nothing in the current frontend calls either one
  - **Removed as a security issue, not just dead code** — both endpoints only required being logged in and never checked price at all before creating a registration with whatever products were requested, free of charge. They also consumed real stock/capacity. The guest endpoint was worse: nothing stopped a team captain from calling it repeatedly to mint unlimited free guest registrations with paid products. Deleted both, along with the now-unused `guestRegistrationError` log helper and an unused import left behind
  - **The other side of the same gap: a genuinely free registration couldn't complete at all** — `Checkout.jsx` always went through `PaymentForm`/Stripe, but `create-payment-intent` rejected any total under €0.01, and `PaymentForm` separately treated a €0 total as "nothing to do yet" and never called it — so a fully free event, or any registration whose total came to exactly €0, got stuck on a payment screen stuck reading "Total Amount: Loading..." forever, with no button and no error
  - **Fix: a proper "no payment needed" path**, built into the existing checkout flow rather than reviving the old endpoints as-is (they didn't match today's batched captain-plus-guests registration model anyway). `create-payment-intent` now responds `{ requiresPayment: false }` instead of erroring when the recomputed total (already volunteer-discount-aware) is €0; `PaymentForm` detects that and completes the registration through a new `POST /api/payments/confirm-free-registration` instead of ever creating a Stripe payment intent. That new endpoint mirrors `confirm-payment`'s registration-creation logic (capacity lock, existing-registration guard, per-product validation, capacity enforcement) but re-verifies the total is actually zero from the database itself before creating anything — never trusting the client — so it can't be used to register for anything that costs money. Registrations completed this way are marked `paid` immediately (nothing is owed) and get the same confirmation email as a paid registration
  - The checkout success screen now says "Registration Successful!" and skips the invoice line when no payment was taken, instead of claiming a payment happened

- **Volunteer management (new feature)** — events can now recruit volunteers (security, info desk, build/setup crew, referees, etc.) through the portal, with organizer-approved benefits as compensation
  - **Opt-in per event** — a `volunteering_enabled` toggle on the event's edit page. Off by default; turning it off blocks new applications (enforced in the API, not just hidden in the UI) but never touches existing roles, applications, or an already-approved volunteer's benefits
  - **Roles and per-product benefits** — organizers define any number of roles per event (name, description, optional capacity) and attach a benefit to any product for any role: free, a percentage off, a fixed amount off, or a fixed override price. The same product can carry a different benefit per role
  - **Application workflow** — users apply to one or more roles from the event page; nothing is granted until an organizer approves it from the Participants page. A user can hold multiple approved roles for the same event at once, and volunteering is entirely independent of registering as a regular attendee — someone can do both
  - **Pricing stays a separate layer** — rather than folding volunteer discounts into `resolvePrice()` (which only ever needs to know a product's own configuration, never who's registering), a new `backend/src/utils/volunteerPricing.js` looks up a user's approved-role discounts for an event and applies whichever is most favorable *after* `resolvePrice()` computes the listed price. Wired into every place a chargeable amount is actually calculated: `payments.js`'s `create-payment-intent` (the real Stripe charge) and `confirm-payment` (registration + bookkeeping), and `registrations.js`'s admin edit-registration reconciliation and payment-link resend. Guests are never eligible, since volunteer status is tied to a real user account
  - Since `create-payment-intent` receives one flat product list combining the captain's own products with any guests' (with no per-entry ownership marker before now), `PaymentForm.jsx` now tags each entry `isGuestProduct` so the discount is scoped correctly and never reaches a guest's products
  - New `volunteer_roles`, `event_volunteers`, and `volunteer_product_discounts` tables (migration `005_add_volunteer_management.sql`) and a new `/api/events/:eventId/volunteers` route file
  - Logged under a new `volunteer` admin-log category: role create/update/delete, benefit set, and application submit/withdraw/approve/reject

- **Admin logs overhaul** — audited the admin System Logs page against what the app actually does; it was only logging a fraction of it (mostly payment/registration failures) and displaying raw database IDs instead of names. Both are fixed:
  - **New coverage** (previously silent, now logged): event create/update/delete and manager add/remove; the full team lifecycle (create/delete/update, description and auto-approve changes, join password set/removed, join requests/approvals/rejections, member invite/remove/role changes, captaincy transfer); admin actions on user accounts (profile edit, password reset, deletion); product create/update/reorder/restore (previously only deletion was logged); an admin editing an existing registration's products/details; registrations for **free** events, which never touched the log service at all before (only paid registrations did, via the payment-confirmation step); resending a payment link; incoming Stripe webhook events (payment succeeded/failed/canceled) and webhook signature/processing errors, which previously only went to the server console; and auth activity — login, logout, password reset request/completion, email verification, email address changes, and profile updates
  - **Readable messages** — every log helper that takes a user, event, team, product, or registration ID now resolves it to a real name before writing the log, so the message itself reads like "Jane Doe registered for Summer Camp 2026" instead of "registration failed for user 5 on event 12" (previously, a name was only ever added to the collapsed Details panel, never the headline message, and only for `userId`/`eventId`/`registrationId` — an action's *admin* actor (`adminUserId`) was never resolved to a name at all, even in Details). Falls back to "user #5"-style text if a lookup ever fails, so logging can never itself error out
  - **Email delivery logging centralized** — `services/email.js`'s shared `sendEmail()` now logs every send attempt (verification, password reset, email-change verification, additional-payment, refund, and payment-confirmation emails) to the admin log; previously only two of the app's eight email templates (registration confirmation/cancellation, in the separate `emailService.js`) were logged, and the rest — including verification and password-reset emails, arguably the most support-request-prone ones — only went to the server console
  - **New categories** — `event`, `team`, `user`, and `product`, plus the existing but previously-unused `webhook` category is now actually populated
  - **Admin UI** — relative timestamps ("2 min ago") alongside the absolute date/time; a "Load older logs" button backed by real pagination (`offset` support added to `GET /api/logs`) instead of a hard 100-row ceiling; an "Export logs" button (CSV, up to 500 matching entries); and clearing all logs now requires typing `DELETE` to confirm, with an on-screen nudge to export first, instead of a single browser confirmation dialog for an action that permanently destroys the audit trail
  - Not covered (flagged for later rather than in scope here): per-event-team link changes (allowing/removing a team for a specific event, and that event-team's auto-join toggle) and Stripe's other, less operationally relevant webhook event types are still unlogged

### Bug Fixes

- **Duplicate products shown after admin edits a registration** — the response query for the admin "Save changes" edit endpoint (`PUT /:eventId/registrations/:registrationId`) joined `registration_products` without excluding soft-deleted rows, so after the edit's soft-delete-and-reinsert product update, the Participants page briefly showed both the old and new products together until the next full page load. This was also the root cause of the previously-documented "checkbox edit shows old and new selections together" known issue — both are now fixed by the same change
  - The same missing filter was found and fixed in three more places while checking for the same pattern: the self-cancellation endpoint's refund calculation (which could have over-refunded through Stripe for a registration that had ever been edited), the "resend payment link" email (which could show a customer duplicate/stale line items), and a user's own "My registrations" list on their Profile page
- **Can't select text by dragging in the product edit form** — the product row's drag-to-reorder wrapper (`<div draggable>` in `EditEvent.jsx`) stayed draggable even while that row's inline edit form was open, and a `draggable` ancestor causes browsers to intercept click-and-drag gestures inside it as "move this element" instead of "select this text" — breaking text selection in every field of the edit form (name, description, price, dates). Fixed by only marking a row draggable while it's showing its collapsed summary, not while it's being edited. The separate "Add product" form was never inside this wrapper and was unaffected

---

## 2026-09-15

### Features & Improvements

- **Checkbox-list product field type** — creators can now add checkbox-list custom fields to products, in addition to text input and dropdown select
  - Configurable minimum/maximum selection counts per field (e.g., "choose 1–3")
  - Optional per-option quantity limits, enforced server-side
  - Selections never change the product's price, regardless of how many options are chosen (unlike dropdown fields)
  - Implemented in `ProductFieldEditor.jsx`, `EventDetail.jsx`, and `EventRegistrants.jsx` on the frontend; validated server-side by a new `backend/src/utils/checkboxFields.js` (`validateCheckboxSelection`), wired into the registration and payment flows
  - Per-option stock is calculated in `products.js`

- **Ticket holders vs. total participants** — the Participants page now shows both a raw headcount ("Total participants") and a ticket-holder count ("Ticket holders")
  - Event capacity checking now counts only registrations holding a ticket-type ("identifying") product
  - Merchandise-only registrations no longer count against event capacity or trigger sold-out handling

### Bug Fixes

- **Duplicate registration_products rows** — fixed a race condition that could create duplicate product rows for the same registration; added a partial unique index via a new migration in `backend/src/migrate.js`
- **"Full" event incorrectly hid management UI for already-registered users** — event pages that had reached capacity were incorrectly hiding the cancel-registration button and team-management controls for users who were already registered; fixed in `EventDetail.jsx`
- **Missing "Continue to payment" button for captains adding guests** — captains who were already registered for an event and added guest registrations could lose the "Continue to payment" button; fixed in `EventDetail.jsx`
- **Empty "Register as part of a team" dropdown** — fixed a case where the team-selection dropdown during registration could render with no options; fixed in `EventDetail.jsx`
- **Co-managers unable to edit registrations** — co-managers could not actually edit registrations, mark them as paid, or resend payment links from the Participants page, despite the UI suggesting they could; fixed the `canManage` permission check in `EventRegistrants.jsx` to correctly use the event's `/events/:id/managers` list
- **Product availability window timezone bug** — per-product `available_from`/`available_until` date-times were being interpreted in the wrong timezone; fixed `EditEvent.jsx` to consistently convert using the existing `toHelsinki`/`helsinkiToUTC` utilities, so the fields now correctly reflect Finnish time (EET/EEST)
- **404 on page refresh** — the nginx cache-control headers added for hashed build assets (below) initially introduced a regression where refreshing a page other than `/` returned a 404; fixed by restoring the missing `root` directive on the catch-all location block

### Technical

- **Static asset caching headers** — `frontend/nginx.conf` now serves `index.html` with `Cache-Control: no-cache` (since it references the current build's hashed filenames) and serves the content-hashed `/assets/` build output with a long-lived, immutable cache header

---

## 2026-06-18

### Features & Improvements

- **Automatic Team Joining on Registration** — Users can now auto-join teams during event registration
  - Added per-event "Auto-approve team joins" setting for each allowed team
  - When enabled, users selecting the team during registration automatically become approved members
  - Event creators can toggle auto-join in event management interface with checkbox
  - Captains no longer need to manually approve registrations for teams with auto-join enabled

- **Team Selection in Event Registration** — Users can select from all eligible teams during registration
  - Team dropdown now shows all eligible teams, not just teams user is already a member of
  - Displays "Team: None" option to register without a team (when individual registration allowed)
  - Works seamlessly with auto-join feature for team auto-membership

- **Team Search Functionality** — Added search bar to Teams page for easier team discovery
  - Search by team name or description (case-insensitive)
  - Real-time filtering as user types
  - Smart empty state differentiates between no teams available vs no matches found
  - Scales well as team directory grows

- **Enhanced User Registration History** — Improved "My registrations" display with time-based organization
  - Renamed section to "My upcoming events" for upcoming registrations
  - Added "My past events" section for concluded/past events
  - Team information now always displayed ("Team: X" or "Team: None")
  - Both sections show identical event details (location, date, team, registered products)

- **Improved Event Description Formatting** — Event descriptions now support line breaks
  - Textarea input allows multi-line descriptions during event creation
  - Line breaks preserved when displaying descriptions in event cards and detail page
  - Uses white-space: pre-wrap CSS to maintain formatting

### Bug Fixes

- **Team Captain Cancellations Now Issue Refunds** — Fixed refund handling for captain-initiated cancellations
  - Previously: only admin/manager cancellations triggered refunds
  - Now: both team captains and managers issuing refunds are correctly processed
  - Refund emails sent to original payment email (guest_email with fallback to captain email)
  - Refund amounts calculated from current products for accurate reimbursement

- **Prevented Event Deletion with Active Registrations** — Added safety check for event deletion
  - Event deletion now blocked if registrations exist
  - Error message: "All registrations must be cancelled individually before the event can be deleted"
  - Ensures refunds are properly issued via individual cancellation process
  - Provides registration count to help event organizers understand pending work

### Database Schema

- **Added event_teams.auto_approve_joins** — Per-event auto-join setting for team registrations
  - Boolean column, defaults to false
  - Allows flexible configuration of auto-approval per event/team combination
  - Migration: `ALTER TABLE event_teams ADD COLUMN IF NOT EXISTS auto_approve_joins BOOLEAN NOT NULL DEFAULT FALSE`

---

## 2026-06-08

### Features & Improvements

- **Email Provider Migration** — Switched from SendGrid to Gmail via nodemailer
  - Reduced email service dependencies and costs
  - Updated environment variables: GMAIL_USER, GMAIL_PASSWORD, GMAIL_FROM_EMAIL
  - All existing email functionality preserved with improved reliability

- **Professional Email Template Redesign** — All transactional emails now have consistent, polished styling
  - Additional payment required email now displays product details with prices
  - Additional payment confirmation email redesigned with green success styling
  - Refund issued email redesigned with professional layout matching other emails
  - Registration cancellation email shows correct refund amounts
  - All emails now use proper HTML structure with max-width containers and consistent typography

- **Dedicated Homepage** — Created Home.jsx with dedicated landing page
  - Changed root path "/" to display homepage instead of Events page
  - Updated title to "Ilmoportaali v3"
  - Updated subtitle to "Centralized event management and registration service for Suomen Pehmomiekkailuliitto"
  - Features section now displays key capabilities from README
  - Added "Contact Site Administrators" section with email contact information
  - Events are now accessible via "/events" route

- **Invoice Creation for Additional Payments** — Additional payments now generate invoices for complete record-keeping
  - Invoices created with same format as initial payments (INV-{registrationId}-{timestamp})
  - Ensures all payments are properly tracked and documented
  - Supports refund reconciliation across multiple payments

### Bug Fixes

- **Fixed Product Option Labels in Emails** — Product custom fields now display readable labels instead of field IDs
  - Emails show "Size: Large" instead of "ke2r7ef: L"
  - Field value transformation applied consistently across all email templates

- **Fixed Payment Confirmation Email Prices** — Payment confirmation email no longer displays "€NaN" for product prices
  - Query now fetches price and fields data for accurate price calculation
  - Field option price overrides applied correctly
  - All product pricing calculations consistent with registration form

- **Fixed Refund Amount Calculation** — Refund now calculated from current products instead of original payment amount
  - When admin cancels registration, refund reflects actual current product total
  - Accounts for product changes made after initial registration
  - Refund email "Amount Refunded" now matches the product table total

### Technical

- **Removed SendGrid Dependencies** — Replaced @sendgrid/mail with nodemailer
  - Cleaner dependency footprint
  - Updated backend/package.json: removed SendGrid, added nodemailer@^8.0.10
  - All email configuration now via Gmail credentials

---

## 2026-06-07

### Bug Fixes & Improvements

- **Fixed Stripe Environment Variable Configuration** — Changed from process.env to import.meta.env with VITE_ prefix for Vite frontend compatibility
  - Frontend now correctly loads Stripe publishable key from build-time environment variables
  - GitHub Actions workflow updated to pass VITE_STRIPE_PUBLISHABLE_KEY during Docker build
  - Payment Element now initializes properly with dynamic client secrets

- **Fixed Payment Intent Return URL** — Corrected redirect path from `/checkout/:id` to `/events/:id/checkout?paymentIntentId=...` to match app routing

- **Forgot Password Flow Implementation** — Complete password reset functionality with email verification
  - Created ForgotPassword.jsx component for initial email submission
  - Created ResetPassword.jsx component for password reset with token validation
  - Backend endpoints: `/auth/forgot-password` and `/auth/reset-password`
  - Reset links sent via email with secure, time-limited tokens

- **Payment Status Display for Event Organizers** — Added payment_status column to participant lists
  - Color-coded status indicators: green (paid), yellow (pending), red (failed)
  - Payment status included in CSV exports for organizer analysis
  - Organizers can now easily identify which participants have paid

- **Mandatory Product Option Selection** — Enforced dropdown field selection during registration
  - Frontend validation prevents submission without selecting from dropdown options
  - Backend validation prevents bypass attempts, stores validation errors clearly

- **Duplicate Registration Prevention Improved** — Enhanced logic for captain vs attendee registration
  - Non-captains cannot register twice for same event with error: "You are already registered for this event. To modify your registration, contact event organizers."
  - Captains can still register guests even if already registered
  - Captain registration attempt shows error: "You are already registered for this event. You cannot register for the event twice, but team captains can still register guests."

- **Session Timeout Extended** — Improved user experience for longer events
  - Access tokens now valid for 2 hours (previously 15 minutes)
  - Refresh tokens now valid for 7 days (previously 30 minutes)
  - Reduces login interruptions during multi-hour events

### UI/UX Improvements

- **Full-Width Table Layouts** — Improved data visibility for event management
  - EventRegistrants participant list now uses full browser width with minimal margins
  - Admin User Management panel now uses full browser width
  - CSS technique: 100vw with negative margins breaks out of container constraints
  - Reduces horizontal scrolling, improves readability of multiple columns

---

## 2026-06-05

### DevOps & Testing

- **GitHub Actions Automated Testing** — Integrated Jest tests into CI/CD pipeline, tests run automatically on every push before deployment
- **Payment Validation Tests** — Added comprehensive validation tests for payment processing: quantity validation, field value validation, amount calculation, and edge cases
- **Docker Test Database Auto-Creation** — PostgreSQL test database (`*_test`) automatically created via init script when Docker starts, no manual setup required
- **Deployment Gate** — Tests must pass before code can be deployed to production, preventing broken code from reaching users
- **Simplified Test Architecture** — Fast, focused validation tests (no external dependencies) that run in 30-60 seconds

---

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
