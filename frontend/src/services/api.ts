import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const apiKey = (import.meta.env.VITE_API_KEY as string | undefined) || localStorage.getItem('MUTIEXPERT_API_KEY');
  if (apiKey) {
    config.headers = config.headers ?? {};
    config.headers['X-API-Key'] = apiKey;
  }
  // FormData 时删除默认 JSON content-type，让浏览器自动设置 multipart boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
