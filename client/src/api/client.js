import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const TOKEN_KEY = 'cd_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const api = axios.create({
  baseURL: BASE_URL,
});

// Attach JWT to every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralized auth handling. On 401, clear token and bounce to /login.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      setToken(null);
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

/** Extract a human-friendly message from an axios error. */
export function errorMessage(error, fallback = 'Error') {
  return (
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}

/** Build an absolute URL for media tags (img/video) with token in query. */
export function mediaUrl(path) {
  const token = getToken();
  const sep = path.includes('?') ? '&' : '?';
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`;
}

export { BASE_URL };
export default api;
