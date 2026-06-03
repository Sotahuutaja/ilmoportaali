# Ilmoportaali — Project Documentation

> An event registration and team management portal built for the Boffering event community.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [Features](#features)
   - [Authentication & Users](#authentication--users)
   - [Events](#events)
   - [Teams](#teams)
   - [Event Registration](#event-registration)
   - [Admin Panel](#admin-panel)
   - [Event Management Dashboard](#event-management-dashboard)
8. [User Roles](#user-roles)
9. [Deployment](#deployment)
10. [Known Issues & Backlog](#known-issues--backlog)

---

## Overview

Ilmoportaali is a full-stack web application for managing event registrations and team memberships. It allows event creators to set up events with purchasable products, manage participant lists, and export data — while attendees can register, join teams, and manage their profiles.

The system is live at:
- **Frontend:** `https://ilmoportaali-frontend.graysand-8ea0ea6e.swedencentral.azurecontainerapps.io`
- **Backend API:** `https://ilmoportaali-app.graysand-8ea0ea6e.swedencentral.azurecontainerapps.io`

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                      Client                         │
│              React Frontend (Port 80)               │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────┐
│              Node.js Backend (Port 3000)            │
│                   REST API + JWT Auth               │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│          PostgreSQL 16 Database (Port 5432)         │
└─────────────────────────────────────────────────────┘
```

All three services are containerised with Docker and orchestrated via Docker Compose for local development. In production they run as Azure Container Apps backed by Azure Database for PostgreSQL.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | JavaScript (React) |
| Backend | Node.js (JavaScript) |
| Database | PostgreSQL 16 |
| Auth | JWT (JSON Web Tokens) |
| Email | SendGrid |
| Containerisation | Docker / Docker Compose |
| CI/CD | GitHub Actions |
| Cloud | Azure Container Apps + Azure Container Registry |
| Secrets | Azure Key Vault |

---

## Project Structure

```
ilmoportaali/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD pipelines
├── backend/                # Node.js REST API
├── frontend/               # React single-page application
├── docker-compose.yml      # Local development environment
├── .dockerignore
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A `.env` file in the project root (see [Environment Variables](#environment-variables))

### Local Development

```bash
# Clone the repository
git clone https://github.com/Sotahuutaja/ilmoportaali.git
cd ilmoportaali

# Create your .env file (see next section)
cp .env.example .env   # or create manually

# Start all services
docker compose up --build
```

Once running:
- Frontend: http://localhost:80
- Backend API: http://localhost:3000
- PostgreSQL: localhost:5432

The database container includes a health check and the backend will wait for it to be ready before starting. Database migrations run automatically on backend startup — no manual step required.

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database
DATABASE_URL=postgres://<user>:<password>@db:5432/<dbname>
POSTGRES_USER=<your_db_user>
POSTGRES_PASSWORD=<your_db_password>
POSTGRES_DB=<your_db_name>

# Auth
JWT_SECRET=<a_long_random_secret_string>

# Email (SendGrid)
SENDGRID_API_KEY=<your_sendgrid_api_key>
SENDGRID_FROM_EMAIL=<verified_sender_email>

# App URL (used in email links)
APP_URL=http://localhost
```

> **Security note:** Never commit `.env` files or real credentials to version control.

---

## Security

The application implements defense-in-depth security practices:

- **CORS Protection** — Whitelist-based CORS restricts API access to whitelisted origins only; rejects requests from unauthorized origins
- **JWT Security** — JWT tokens use secure signing with HS256 algorithm and configurable expiration; role claims are verified against the database on each request
  - **httpOnly Cookies** — Authentication tokens stored in secure, httpOnly cookies that are inaccessible to JavaScript, preventing XSS attacks
  - **Token Expiration** — Short-lived access tokens (15 minutes) with refresh tokens for extended sessions (30 minutes)
- **Database Security** — Parameterized queries prevent SQL injection; transactions ensure data consistency; foreign key constraints maintain referential integrity
- **Password Security** — bcrypt hashing with salt for all passwords
- **Security Headers** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy prevent common attacks
- **Rate Limiting** — In-memory rate limiting on authentication endpoints prevents brute-force attacks
- **Role-Based Access Control** — Database-verified roles prevent privilege escalation even if JWT_SECRET is compromised
- **Error Handling** — Error messages do not expose system internals or database details

---

## Features

### Authentication & Users

- **Registration** with email verification via SendGrid
- **JWT-based login** with role-based access control using secure httpOnly cookies
- **Logout** — securely clears authentication cookies and redirects to login page
- **Password change** from the profile page
- **Profile page** showing account settings, team memberships, and event registrations
- User profile collects: first name, last name, year of birth, and gender

### Events

- Create, edit, and delete events
- Event fields: title, description, location, start/end dates, capacity, and registration period
- **Registration period** — each event requires a registration open and close datetime; users can only sign up within that window. Outside it, the event page shows "Registration opens on [date]" or "Registration is closed"
- **Products** — each event can have multiple purchasable products with name, description, price, and optional quantity limits
- **Product options** — creators can add custom fields to products (text input or dropdown select); users choose options during registration
  - **Per-option pricing** — dropdown options can have custom prices that override the product's default price
  - **Per-option quantity limits** — dropdown options can have individual quantity limits (e.g., "Size Small: 5 available")
- Products support drag-and-drop reordering on the edit page and inline editing
- At least one product must be selected when registering for an event
- **Co-managers** — event creators can grant other creators full management access over their events
- Past events are shown in a separate collapsed section on the events listing page

### Teams

- Admins create teams and assign captains
- Multiple captains per team (all admin-managed)
- Admins can set whether team joins require approval or are auto-approved when creating/editing teams
- Captains can toggle auto-approval setting for their teams
- Captains can transfer captaincy to a member (which demotes themselves)
- Users can request to join a team or be directly invited by a captain
- Captains can approve/reject join requests and remove members
- Users can leave teams at any time
- Team member lists are visible only to members, captains, and admins

### Event Registration

- Registered users select products when signing up for an event
- Registration is only possible within the event's registration period
- Optional team linking during registration
- **Comments** — users can add optional comments/notes for the event organizers
- **Guest registration** — captains can register guests by providing first name, last name, email, team, product selections, and optional comments
- Capacity checking with sold-out handling
- **CSV export** — event organizers can export all registrations including comments

### Admin Panel

- **User management** with filters, sortable columns, and CSV export
- Edit user details: name, email, role, and trigger a password reset
- View age (calculated from year of birth), year of birth, and gender
- Delete users (with foreign key cleanup)
- **Team management** — create, edit, and delete teams; assign and remove captains; configure auto-approval settings

### Event Management Dashboard

Accessible by event creators and co-managers:

- View all events you own or co-manage (co-managed events show a badge)
- Manage products and co-managers per event
  - **Managers view** — shows event creator and all co-managers with clear badges distinguishing roles
- **Participant view** — summary stats (total participants, guests, revenue), search by name/email/team, edit or cancel any registration, CSV export
- Guest registrations are shown with a guest badge

### Teams Page

- **My teams** section showing teams you are a member of with role and status
- **Other teams** section showing available teams you can join (filtered to exclude your teams)
- Intelligent join button: shows "Join" for teams with auto-approval enabled, "Request to join" for teams requiring approval
- View team members (visible to members, captains, and admins only)
- Captains can manage team settings: toggle auto-approval of join requests
- Leave a team at any time
- Captain-only tools: approve/reject join requests, remove members, make another member captain

---

## User Roles

| Role | Description |
|------|-------------|
| **admin** | Full access: user management, team management, all events |
| **creator** | Can create and manage events; can be assigned as co-manager |
| **attendee** | Can register for events, join teams, manage own profile |

---

## Deployment

Deployment is automated via GitHub Actions on every push to `main`.

### Azure Resources

| Resource | Name |
|----------|------|
| Resource Group | `RG_ilmoportaali` |
| Container Apps Environment | `ilmoportaali-env` |
| Container Registry | `ilmoportaaliregistry.azurecr.io` |
| Backend App | `ilmoportaali-app` |
| Frontend App | `ilmoportaali-frontend` |
| Database Server | `ilmoportaali-db` |
| Database Name | `ilmoportaali` |
| Region | Sweden Central |

Secrets are stored in **Azure Key Vault** and injected at runtime into the Container Apps.

### Manual Deploy Steps (if needed)

```bash
# Build and push images
az acr build --registry ilmoportaaliregistry --image ilmoportaali-backend ./backend
az acr build --registry ilmoportaaliregistry --image ilmoportaali-frontend ./frontend

# Update container apps
az containerapp update --name ilmoportaali-app ...
az containerapp update --name ilmoportaali-frontend ...
```

---

## Known Issues & Backlog

- Nothing!

### Planned Features

- Add an option to add images to products to be displayed for the users
- Custom domain (boffaus.fi)
- Payment handling for products (MobilePay, Paytrail)
- Bulk event registration via Excel file import
- Pin Azure CLI version in GitHub Actions (currently using `latest` due to credential mounting limitations with `azure/cli@v2`)
- Enable users to register vehicles or other machines they might bring to an event
- New team creation as an option for users in the Teams page
