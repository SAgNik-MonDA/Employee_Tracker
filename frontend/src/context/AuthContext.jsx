import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify token with backend on every app load
    const verifyToken = async () => {
      try {
        const token = sessionStorage.getItem('token');

        if (!token) {
          // No token — go to login
          setLoading(false);
          return;
        }

        // Hit backend to confirm token is still valid
        const { data } = await API.get('/auth/profile');

        if (data && data.role) {
          setUser(data);
          sessionStorage.setItem('user', JSON.stringify(data));
        } else {
          throw new Error('Invalid user data');
        }
      } catch (e) {
        // Token expired or invalid — clear everything, force login
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = async (employeeCode, email, password) => {
    const { data } = await API.post('/auth/login', { employeeCode, email, password });

    const { token, ...userWithoutToken } = data;

    setUser(userWithoutToken);
    sessionStorage.setItem('user', JSON.stringify(userWithoutToken));
    sessionStorage.setItem('token', token);

    return data;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
  };

  const updateSessionUser = async () => {
    try {
      const { data } = await API.get('/auth/profile');
      if (data && data.role) {
        setUser(data);
        sessionStorage.setItem('user', JSON.stringify(data));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Update profile picture in state + sessionStorage after upload
  const updateProfilePicture = (filename) => {
    const updatedUser = { ...user, profilePicture: filename };
    setUser(updatedUser);
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateProfilePicture, updateSessionUser }}>
      {children}
    </AuthContext.Provider>
  );
};
