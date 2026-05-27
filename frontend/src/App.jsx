import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Teams from './pages/Teams';
import EventRegistrants from './pages/EventRegistrants';
import Profile from './pages/Profile';
import { AuthProvider, useAuth, fullName } from './AuthContext';
import VerifyEmail from './pages/VerifyEmail';

function Nav() {
  const { user, logout } = useAuth();
  return (
    <nav>
      <Link to="/" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Ilmoportaali</Link>
      <div>
        <Link to="/">Events</Link>
		<Link to="/teams">Teams</Link>
        {user ? (
          <>
            {(user.role === 'admin' || user.role === 'creator') && (
              <Link to="/dashboard">Event Management</Link>
            )}
            {user.role === 'admin' && (
              <Link to="/admin">Admin</Link>
            )}
			<Link to="/profile" style={{ marginLeft: '1rem', opacity: 0.7 }}>{fullName(user)}</Link>
            <button
              onClick={logout}
              className="btn btn-secondary"
              style={{ marginLeft: '1rem' }}
            >Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Nav />
        <div className="container">
          <Routes>
            <Route path="/" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
			<Route path="/admin" element={<Admin />} />
			<Route path="/teams" element={<Teams />} />
			<Route path="/events/:id/registrants" element={<EventRegistrants />} />
			<Route path="/profile" element={<Profile />} />
			<Route path="/verify-email" element={<VerifyEmail />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}