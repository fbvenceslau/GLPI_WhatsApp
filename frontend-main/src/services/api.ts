import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;
  if (apiKey) config.headers['x-api-key'] = apiKey;
  return config;
});

export const glpiApi = {
  getCategories: (type?: number) =>
    api.get('/api/glpi/categories', { params: { type } }).then((r) => r.data),

  lookupUser: (email: string) =>
    api.get('/api/glpi/users', { params: { email } }).then((r) => r.data),
};

export default api;
