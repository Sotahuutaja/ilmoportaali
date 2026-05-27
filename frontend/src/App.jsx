import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Teams from './pages/Teams';
import EventRegistrants from './pages/EventRegistrants';

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
              <Link to="/dashboard">Dashboard</Link>
            )}
            {user.role === 'admin' && (
              <Link to="/admin">Admin</Link>
            )}
            <span style={{ marginLeft: '1rem', opacity: 0.7 }}>{user.name}</span>
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
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}