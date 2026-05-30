# Ilmoportaali — Project Documentation

> An event registration and team management portal built for the Sotahuuto LARP event community.

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

The database container includes a health check and the backend will wait for it to be ready before starting.

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
```

> **Security note:** Never commit `.env` files or real credentials to version control.

---

## Features

### Authentication & Users

- **Registration** with email verification via SendGrid
- **JWT-based login** with role-based access control
- **Password change** from the profile page
- **Profile page** showing account settings, team memberships, and event registrations
- User profile collects: first name, last name, year of birth, and gender

### Events

- Create, edit, and delete events
- Event fields: title, description, location, start/end dates, and capacity
- **Products** — each event can have multiple purchasable products with name, description, price, and optional quantity limits
- Products support drag-and-drop reordering on the edit page and inline editing
- At least one product must be selected when registering for an event
- **Co-managers** — event creators can grant other creators full management access over their events

### Teams

- Admins create teams and assign captains
- Multiple captains per team (all admin-managed)
- Captains can transfer captaincy to a member (which demotes themselves)
- Users can request to join a team or be directly invited by a captain
- Captains can approve/reject join requests and remove members
- Team member lists are visible only to members, captains, and admins

### Event Registration

- Registered users select products when signing up for an event
- Optional team linking during registration
- **Guest registration** — captains can register guests by providing first name, last name, email, team, and product selections
- Capacity checking with sold-out handling

### Admin Panel

- **User management** with filters, sortable columns, and CSV export
- Edit user details: name, email, role, and trigger a password reset
- View age (calculated from year of birth), year of birth, and gender
- Delete users (with foreign key cleanup)
- **Team management** — create, edit, and delete teams; assign and remove captains

### Event Management Dashboard

Accessible by event creators and co-managers:

- View all events you own or co-manage (co-managed events show a badge)
- Manage products and co-managers per event
- **Participant view** — summary stats (total participants, guests, revenue), search by name/email/team, edit or cancel any registration, CSV export
- Guest registrations are shown with a guest badge

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

### Bugs

- Changing profile information may not save correctly in all cases
- Age and gender may not display on the profile page immediately after registration
- Changing profile details may require the user to also reset their password
- User deletion has foreign key constraint issues that need cleanup logic

### Planned Features

- Custom domain
- Payment handling for products
- Captain invite flow UI (backend exists, frontend UI incomplete)
- Bulk event registration via Excel file import
