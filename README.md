Completed so far (27.5.2026):

**Infrastructure**

Azure Container Apps (frontend + backend)
Azure Database for PostgreSQL
Azure Container Registry
GitHub Actions automated deployment pipeline
Persistent secrets in Azure Key Vault
Docker Compose local development environment


**Authentication & Users
**
User registration with email verification (SendGrid)
JWT-based login with role checks
Three roles: admin, creator, attendee
First name and last name separately throughout
Year of birth and gender collected at registration
Password change
Profile page showing account settings, team memberships and event registrations


**Events**

Create, edit and delete events
Event fields: title, description, location, dates, capacity
Event products with name, description, price and optional quantity limits
Product drag-and-drop reordering on the edit page
Product inline editing
At least one product required to register
Event co-managers — creators can grant other creators full management access


**Teams**

Admins create teams and assign captains
Multiple captains per team (admin-managed)
Captains can transfer captaincy to a member (demotes themselves)
Users can request to join teams
Captains can invite users directly
Captains approve/reject join requests
Captains can remove members
Team member list visible only to members, captains and admins


**Event Registration
**
Registered users register individually with product selection
Optional team linking when registering
Guest registration by captains (first name, last name, email, team, products)
Capacity checking and sold-out handling


**Admin Panel
**
User management with filters, sorting, CSV export
Collapsible sections with clickable headers
Edit users (name, email, role, password reset)
Age calculated from year of birth
Year of birth and gender visible to admins
Delete users (with foreign key cleanup)
Team management — create, edit, delete teams
Assign and remove captains per team


**Event Management Dashboard **

Creators and co-managers see their events
Manage products per event
Manage co-managers per event
View and edit participants
Export participants to CSV
Cancel individual registrations
Co-manager badge on events you don't own


**Participant (Registrant) View **

Summary stats: total participants, guests, revenue
Search by name, email or team
Separate first/last name columns
Guest badge on guest registrations
Edit any registration (name, email, team, products)
Cancel any registration
CSV export


**Teams Page**

Browse all teams
My teams section showing membership status
View team members (members and admins only)
Request to join
Captain tools: approve/reject requests, remove members, make captain


**UX improvements **

Collapsible admin sections
Sortable columns in user management
Horizontal scroll on wide tables
Browser title set to Ilmoportaali
Consistent Last name, First name format throughout
Email fallback when names are null


**Remaining items:**

Custom domain
Payment handling for products
Captain invite flow UI
Fix user deletion (foreign key constraints)
Password reset via email
