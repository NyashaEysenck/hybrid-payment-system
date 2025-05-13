// utils/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN'
});

// Add custom request interceptor to handle self-signed certificates
api.interceptors.request.use(
  (config) => {
    // Add any request headers or modifications here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add custom response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle the error
      console.error('API Error:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
