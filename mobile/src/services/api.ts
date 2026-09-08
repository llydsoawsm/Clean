import { API_BASE_URL } from '@/config/api';
import type { HealthResponse } from '@/types/health';
import type { AuthResponse, ShopMeResponse } from '@/types/auth';

const REQUEST_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/${path}`, {
      ...options,
      signal: controller.signal,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError('The server returned an invalid response.', response.status);
    }

    if (!response.ok) {
      const message = getErrorMessage(body);
      throw new ApiError(message, response.status);
    }

    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The server took too long to respond.');
    }
    throw new ApiError('Unable to connect to Clean server. Check the API URL and Wi-Fi connection.');
  } finally {
    clearTimeout(timeout);
  }
}

async function get<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request<T>(path, { method: 'GET', headers });
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request<T>(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function getErrorMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null) return 'The server returned an error.';
  const error = (body as { error?: unknown }).error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' ? message : 'The server returned an error.';
}

export const api = {
  getHealth: () => get<HealthResponse>('health'),
  register: (data: { shopName: string; ownerName: string; email: string; password: string }) =>
    post<AuthResponse>('auth/register', data),
  login: (data: { email: string; password: string }) => post<AuthResponse>('auth/login', data),
  getShopMe: (token: string) => get<ShopMeResponse>('shops/me', token),
  syncPush: (payload: { customers?: any[]; services?: any[]; orders?: any[]; payments?: any[]; statusHistory?: any[] }, token: string) =>
    post<{ success: boolean; data: { results: Record<string, any[]>; pushedAt: string } }>('sync/push', payload, token),
  syncPull: (since: string, token: string, limit?: number) =>
    get<{ success: boolean; data: { customers: any[]; services: any[]; orders: any[]; payments: any[]; statusHistory: any[]; nextCursor: string; pulledAt: string } }>(
      `sync/pull?since=${encodeURIComponent(since)}${limit ? `&limit=${limit}` : ''}`,
      token
    ),
};
