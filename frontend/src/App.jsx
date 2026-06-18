import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import EventRegistrants from './pages/EventRegistrants';
import Profile from './pages/Profile';
import { AuthProvider, useAuth, fullName } from './AuthContext';
import VerifyEmail from './pages/VerifyEmail';
import EditEvent from './pages/EditEvent';
import ResetPassword from './pages/ResetPassword';
import Checkout from './pages/Checkout';
import ForgotPassword from './pages/ForgotPassword';
import StripeProvider from './components/StripeProvider';


function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav>
      <Link to="/" className="site-title">Ilmoportaali</Link>
      <div className="nav-center">
        <Link to="/events">Events</Link>
        <Link to="/teams">Teams</Link>
        {(user?.role === 'admin' || user?.role === 'creator') && (
          <Link to="/dashboard">Management</Link>
        )}
        {user?.role === 'admin' && (
          <Link to="/admin">Admin</Link>
        )}
      </div>
      <div className="nav-right">
        {user ? (
          <>
            <Link to="/profile">{fullName(user)}</Link>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
              Log out
            </button>
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
      <StripeProvider>
        <BrowserRouter>
          <Nav />
          <div className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/checkout" element={<Checkout />} />
              <Route path="/events/:id/checkout" element={<Checkout />} />
              <Route path="/events/:id/registrants" element={<EventRegistrants />} />
              <Route path="/events/:id/edit" element={<EditEvent />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/:id" element={<TeamDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
            </Routes>
          </div>
        </BrowserRouter>
      </StripeProvider>
    </AuthProvider>
  );
}