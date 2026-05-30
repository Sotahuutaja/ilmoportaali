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
