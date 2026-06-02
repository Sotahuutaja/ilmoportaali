Completed so far (2.6.2026):

**Security Fixes - Critical Vulnerabilities (2.6.2026)**

* **CRITICAL: Fixed CORS Wildcard Misconfiguration** - Replaced insecure `|| '*'` fallback with whitelist-based CORS
  - API now only accepts requests from whitelisted origins (APP_URL + localhost for development)
  - Prevents CSRF attacks and cross-origin data theft
  - Rejects requests from unauthorized origins
  - Logs privilege escalation attempts
* **CRITICAL: Fixed JWT Role Verification** - No longer trusts JWT role claims without database verification
  - `requireRole()` middleware now re-verifies role against database on each request
  - Prevents privilege escalation if JWT_SECRET is compromised
  - Detects and logs unauthorized role claims
  - Updated all route files to pass pool parameter to requireRole middleware
* **Security Improvements:**
  - Added proper CORS credentials policy
  - Implemented database verification for role-based access control
  - Added logging for privilege escalation attempts
  - Configuration validation (warns if APP_URL not set in production)

**Event Deletion (2.6.2026)**

* Admins can now delete events with registered participants — registrations are automatically deleted with the event
* Database schema updated to use ON DELETE CASCADE for event registrations (future-proof)
* Backend uses transactions to ensure atomic deletion (event + all registrations)

**Team Management Improvements (2.6.2026)**

* Admins can now set auto-approval for teams during team creation
* Admins can change the auto-approval setting when editing teams
* Fixed critical team membership bug: GET /my/memberships now returns team_id instead of membership id, fixing UI recognition of team membership
* Users can now leave teams (previously only captains could remove members)
* Type conversion fixes in team member endpoints (DELETE and PUT)
* Improved Teams page UX: "All teams" renamed to "Other teams" and now filters out teams user is already a member of
* Dynamic button text on Teams page: shows "Join" for auto-approved teams, "Request to join" for teams requiring approval
* Fixed captain selection dropdown in admin team creation to properly display names with first/last name fallback

**Bug Fixes (2.6.2026)**

* Fixed team membership not being recognized in frontend due to ID field mismatch
* Fixed users unable to leave teams
* Fixed admin panel endpoint for demoting captains (added missing PUT /teams/:id/members/:userId endpoint)
* Fixed Teams.jsx approve/reject functions to use correct backend endpoints
* Fixed captain name display in team creation form

---

Completed so far (31.5.2026):

**Event Registration & Comments (31.5.2026)**

* Added comments field to event registration — users can provide additional information for event organizers
* Comments are optional and displayed in both self-registration and guest registration forms
* Comments are included in CSV exports so organizers can review all notes
* Database migration adds `comments TEXT` column to registrations table

**Product Options (31.5.2026)**

* Product options are now visible in event management dashboard showing field labels and types
* Fixed GROUP BY clause in products GET endpoint to properly return all columns including `fields`
* Product field options display correctly in both event creation and registration views

**Dashboard UI (31.5.2026)**

* Removed redundant "Products" button from event management dashboard
* Product management is now only accessible via the "Edit" button (includes all product editing)
* Improved team name color visibility in team registrations view (now uses accent color)

**Bug Fixes (31.5.2026)**

* Fixed incomplete registrations.js file that was truncated mid-statement
* Restored all missing endpoints for PUT registration updates including field_values and comments handling
* Fixed duplicate field entries in registrations GET response query

---

Completed so far (30.5.2026):

**Events (30.5.2026)**

* Registration period — events now require a registration open and close datetime
* Users can only register within the period; outside it the event page shows "Registration opens on [date]" or "Registration is closed"
* Registration period is enforced on both self-registration and guest registration on the backend
* Past events moved to a separate collapsed section on the events listing page


---

Completed so far (30.5.2026):

**Code quality & maintenance (30.5.2026)**

* Normalised all source files to consistent 2-space indentation and LF line endings
* Removed three one-off dev scripts from the codebase (check-db.js, fix-name-column.js, verify-existing-users.js)
* Removed dead `pool` import from utils/eventAccess.js
* Removed duplicate `canManageEvent` function from routes/events.js — now imported from utils/eventAccess.js
* Moved `handleSave` and `handlePasswordReset` in Profile.jsx to correct top-level scope
* Moved `ProductSelector` component in EventDetail.jsx outside the render function to prevent unnecessary remounts
* Fixed second `useEffect` in EventDetail.jsx missing indentation (was outside component body)
* Fixed `buildProducts` being called twice in EventDetail.jsx register function
* Fixed `EventRegistrants.jsx` search and cancel dialogs using non-existent `guest_name`/`user_name` fields


**Security (30.5.2026)**

* Added security headers middleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, removes X-Powered-By)
* Added CORS middleware locked to APP_URL in production
* Added in-memory rate limiting on auth endpoints: login (10/15 min), register (5/15 min), forgot-password and resend-verification (5/15 min)
* Added try/catch error handling to /auth/me endpoint
* Added JWT_SECRET presence check at server startup — fails fast if missing
* Replaced hardcoded email in make-admin.js with a CLI argument


**Infrastructure (30.5.2026)**

* Updated GitHub Actions: azure/login and azure/cli bumped from v1 to v2
* Moved hardcoded registry username to REGISTRY_USERNAME secret
* Pinned azcliversion to 2.70.0 (was non-deterministic `latest`)
* Added Docker layer caching (type=gha) to both build jobs
* Added post-deploy health check polling to both jobs (2 min timeout)
* migrate.js now runs automatically on container startup — no manual step required
* Added 404 handler and global error handler to Express server


**UX (30.5.2026)**

* Added "Forgot password?" link to the login page


---

Completed so far (27.5.2026):

**Infrastructure**

* Azure Container Apps (frontend + backend)
* Azure Database for PostgreSQL
* Azure Container Registry
* GitHub Actions automated deployment pipeline
* Persistent secrets in Azure Key Vault
* Docker Compose local development environment


**Authentication & Users**

* User registration with email verification (SendGrid)
* JWT-based login with role checks
* Three roles: admin, creator, attendee
* First name and last name separately throughout
* Year of birth and gender collected at registration
* Password change
* Profile page showing account settings, team memberships and event registrations


**Events**

* Create, edit and delete events
* Event fields: title, description, location, dates, capacity
* Event products with name, description, price and optional quantity limits
* Product drag-and-drop reordering on the edit page
* Product inline editing
* At least one product required to register
* Event co-managers — creators can grant other creators full management access


**Teams**

* Admins create teams and assign captains
* Multiple captains per team (admin-managed)
* Captains can transfer captaincy to a member (demotes themselves)
* Users can request to join teams
* Captains can invite users directly
* Captains approve/reject join requests
* Captains can remove members
* Team member list visible only to members, captains and admins


**Event Registration**

* Registered users register individually with product selection
* Optional team linking when registering
* Guest registration by captains (first name, last name, email, team, products)
* Capacity checking and sold-out handling


**Admin Panel**

* User management with filters, sorting, CSV export
* Collapsible sections with clickable headers
* Edit users (name, email, role, password reset)
* Age calculated from year of birth
* Year of birth and gender visible to admins
* Delete users (with foreign key cleanup)
* Team management — create, edit, delete teams
* Assign and remove captains per team


**Event Management Dashboard**

* Creators and co-managers see their events
* Manage products per event
* Manage co-managers per event
* View and edit participants
* Export participants to CSV
* Cancel individual registrations
* Co-manager badge on events you don't own


**Participant (Registrant) View**

* Summary stats: total participants, guests, revenue
* Search by name, email or team
* Separate first/last name columns
* Guest badge on guest registrations
* Edit any registration (name, email, team, products)
* Cancel any registration
* CSV export


**Teams Page**

* Browse all teams
* My teams section showing membership status
* View team members (members and admins only)
* Request to join
* Captain tools: approve/reject requests, remove members, make captain


**UX improvements**

* Collapsible admin sections
* Sortable columns in user management
* Horizontal scroll on wide tables
* Browser title set to Ilmoportaali
* Consistent Last name, First name format throughout
* Email fallback when names are null


**Remaining items:**

* Custom domain
* Payment handling for products
* Captain invite flow UI
* Fix user deletion (foreign key constraints)
* Password reset via email
