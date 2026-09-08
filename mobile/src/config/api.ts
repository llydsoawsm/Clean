const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

if (!configuredBaseUrl) {
  console.warn('EXPO_PUBLIC_API_BASE_URL is not configured.');
}

export const API_BASE_URL = (configuredBaseUrl ?? 'http://127.0.0.1:3000/api/v1')
  .replace(/\/$/, '');
