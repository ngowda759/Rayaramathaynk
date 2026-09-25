import axios from 'axios';
import { CONFIG } from '../../constants/config';

export const apiClient = axios.create({
  baseURL: CONFIG.API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Add logging or analytics here
    console.error('API Error:', error?.response?.data || error.message);
    return Promise.reject(error);
  }
);
