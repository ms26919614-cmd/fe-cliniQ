import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('cliniq_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only auto-logout on 401 for non-optional endpoints
    // Requests marked with _skipAuthRedirect won't trigger logout
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !error.config?._skipAuthRedirect
    ) {
      localStorage.removeItem('cliniq_token');
      localStorage.removeItem('cliniq_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
