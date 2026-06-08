import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '3rem' }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, #0052a3 100%)',
        color: 'white',
        padding: '4rem 2rem',
        borderRadius: '8px',
        textAlign: 'center',
        marginBottom: '3rem'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', marginTop: 0 }}>Welcome to Ilmoportaali v3</h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '2rem', opacity: 0.95 }}>
          Centralized event management and registration service for Suomen Pehmomiekkailuliitto
        </p>
        {!user ? (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary" style={{ background: 'white', color: 'var(--accent)', borderColor: 'white' }}>
              Log in
            </Link>
            <Link to="/register" className="btn" style={{ borderColor: 'white', color: 'white' }}>
              Create account
            </Link>
          </div>
        ) : (
          <Link to="/events" className="btn btn-primary" style={{ background: 'white', color: 'var(--accent)', borderColor: 'white' }}>
            Browse Events
          </Link>
        )}
      </div>

      {/* Features Section */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Features</h2>
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            <div>
              <h3 style={{ color: 'var(--accent)', marginTop: 0 }}>📋 Event Management</h3>
              <p>Create and manage events with custom products, registration fields, and quantity limits. Support for product options with per-option pricing and inventory control.</p>
            </div>
            <div>
              <h3 style={{ color: 'var(--accent)', marginTop: 0 }}>💳 Secure Payments</h3>
              <p>Integrated Stripe payment processing with support for multiple payment methods (card, MobilePay, iDEAL). Real-time payment status tracking for participants.</p>
            </div>
            <div>
              <h3 style={{ color: 'var(--accent)', marginTop: 0 }}>👥 Team Management</h3>
              <p>Create teams with assigned captains, manage memberships, and control join request approval settings. Captains can manage team members and transfer leadership.</p>
            </div>
            <div>
              <h3 style={{ color: 'var(--accent)', marginTop: 0 }}>🔐 User Authentication</h3>
              <p>Secure JWT-based authentication with email verification, password reset, and role-based access control (admin, creator, attendee).</p>
            </div>
            <div>
              <h3 style={{ color: 'var(--accent)', marginTop: 0 }}>🎫 Registration Management</h3>
              <p>Flexible event registration with guest registration support, optional team assignment, and comments. CSV export for all registrations and payment data.</p>
            </div>
            <div>
              <h3 style={{ color: 'var(--accent)', marginTop: 0 }}>📊 Admin Dashboard</h3>
              <p>Comprehensive event management for creators and co-managers. Participant search and filtering, refund processing, and detailed payment status visibility.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      {user ? (
        <div className="card" style={{ textAlign: 'center', background: 'var(--surface-2)', marginBottom: '3rem' }}>
          <h2 style={{ marginTop: 0 }}>Get Started</h2>
          <p>What would you like to do?</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/events" className="btn btn-primary">
              Browse Events
            </Link>
            <Link to="/teams" className="btn btn-secondary">
              My Teams
            </Link>
            {(user.role === 'admin' || user.role === 'creator') && (
              <Link to="/dashboard" className="btn btn-secondary">
                Dashboard
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', background: 'var(--surface-2)', marginBottom: '3rem' }}>
          <h2 style={{ marginTop: 0 }}>Ready to get started?</h2>
          <p>Sign up to create events and manage registrations</p>
          <Link to="/register" className="btn btn-primary">
            Create an Account
          </Link>
        </div>
      )}

      {/* Contact Section */}
      <div className="card" style={{ textAlign: 'center', background: 'var(--surface-2)' }}>
        <h2 style={{ marginTop: 0 }}>Contact Site Administrators</h2>
        <p style={{ marginBottom: '1.5rem' }}>Issues with the website? Feedback? Want to use the site for your event? Contact us at <strong><a href="mailto:registration@sotahuuto.fi" style={{ color: 'var(--accent)', textDecoration: 'none' }}>registration@sotahuuto.fi</a></strong></p>
      </div>
    </div>
  );
}
