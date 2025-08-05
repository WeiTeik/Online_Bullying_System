import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const complaintsAPI = {
  getAll: () => api.get('/api/complaints/'),
  create: (data) => api.post('/api/complaints/', data),
  getById: (id) => api.get(`/api/complaints/${id}/`),
  update: (id, data) => api.put(`/api/complaints/${id}/`, data),
  delete: (id) => api.delete(`/api/complaints/${id}/`),
  getMyComplaints: () => api.get('/api/complaints/my-complaints/'),
  getStatistics: () => api.get('/api/complaints/statistics/'),
};

export const authAPI = {
  login: (credentials) => api.post('/api/users/auth/login/', credentials),
  register: (userData) => api.post('/api/users/auth/register/', userData),
  logout: () => api.post('/api/users/auth/logout/'),
  getProfile: () => api.get('/api/users/profile/'),
};

export const usersAPI = {
  getAll: () => api.get('/api/users/'),
  getById: (id) => api.get(`/api/users/${id}/`),
  updateProfile: (data) => api.put('/api/users/profile/', data),
};

export default api;