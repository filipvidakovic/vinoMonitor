import axios, { type AxiosInstance, AxiosError } from 'axios';

const createApiInstance = (baseURL: string): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  // Add token
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Handle 401
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

export const authApi = createApiInstance(
  import.meta.env.VITE_AUTH_API_URL + "/api/v1"
);

export const vineyardApi = createApiInstance(
  import.meta.env.VITE_VINEYARDS_API_URL + "/api/v1"
);

export const harvestApi = createApiInstance(
  import.meta.env.VITE_HARVEST_API_URL + "/api/v1"
);

export const fermentationApi = createApiInstance(
  import.meta.env.VITE_FERMENTATION_API_URL + "/api/v1"
);