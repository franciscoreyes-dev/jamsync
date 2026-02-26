import axios from 'axios';

export function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('jamsync_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  Object.assign(config.headers, getAuthHeader());
  return config;
});
