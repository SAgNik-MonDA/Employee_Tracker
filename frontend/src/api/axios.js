import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : 'https://employee-tracker-backend-6t0z.onrender.com/api',
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 & expired-subscription 403 responses
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      window.location.href = '/login';
    } else if (error.response && error.response.status === 403 && error.response.data?.subscriptionExpired) {
      try {
        const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
        if (storedUser?.role && storedUser.role !== 'Admin' && storedUser.role !== 'SuperAdmin') {
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('token');
          window.location.href = '/login';
        }
      } catch {
        // ignore storage parse failure
      }
    }
    return Promise.reject(error);
  }
);

export default API;
