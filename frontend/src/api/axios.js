import axios from 'axios';
import { getSession } from '../auth/client.js';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 120000 });
api.interceptors.request.use(config => {
  const session = getSession();
  if (session) config.headers.Authorization = 'Bearer ' + session.access_token;
  return config;
});
export default api;
