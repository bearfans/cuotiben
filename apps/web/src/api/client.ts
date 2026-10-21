import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 60_000,
});

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data } = await axios.post<{ accessToken: string }>(
      '/api/v1/auth/refresh',
      null,
      { withCredentials: true, timeout: 20_000 },
    );
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const url = config?.url ?? '';
    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !url.includes('/auth/')
    ) {
      config._retry = true;
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const token = await refreshPromise;
      refreshPromise = null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return api.request(config);
      }
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; details?: string[] } | undefined;
    if (data?.details?.length) return data.details[0];
    if (data?.message) return data.message;
    if (error.code === 'ECONNABORTED') return '请求超时，请检查网络后重试';
    if (!error.response) return '网络连接失败，请稍后重试';
  }
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}
