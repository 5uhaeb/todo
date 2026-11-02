import axios from 'axios';
import { supabase } from '../supabase.js';

const configuredUrl = import.meta.env.VITE_API_URL;
const mixedContent = window.location.protocol === 'https:' && configuredUrl?.startsWith('http:');
const api = axios.create({
  baseURL: mixedContent ? '/api' : configuredUrl || '/api',
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
