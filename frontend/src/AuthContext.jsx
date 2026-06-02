import { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in by calling /auth/me
    // Token is in httpOnly cookie, automatically sent by axios with withCredentials
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = (userData) => {
    // Token is now in httpOnly cookie set by login endpoint
    // No need to manually store it
    setUser(userData);
  };

  const logout = async () => {
    // Call logout endpoint to clear cookies on server
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err.message);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export const fullName = (user) => {
  if (!user) return '';
  if (user.last_name && user.first_name) return `${user.last_name}, ${user.first_name}`;
  if (user.first_name || user.last_name) return `${user.last_name || ''} ${user.first_name || ''}`.trim();
  return user.email || '';
};