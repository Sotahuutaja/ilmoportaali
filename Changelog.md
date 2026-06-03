# Changelog

All notable changes to Ilmoportaali are documented in this file.

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
