import 'dotenv/config';

function positivePort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }
  return port;
}

function requireJwtSecret(value: string | undefined): string {
  const secret = value?.trim();
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be at least 16 characters in production');
    }
    console.warn('[config] JWT_SECRET not set or too short — using dev fallback. Set JWT_SECRET in .env for production.');
    return 'dev-clean-jwt-secret-change-me-32chars!!';
  }
  return secret;
}

function parseTzOffsetMinutes(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 480; // Default Asia/Manila (UTC+8)
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < -720 || parsed > 840) return 480;
  return parsed;
}

export const config = {
  port: positivePort(process.env.PORT),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databasePath: process.env.DATABASE_PATH ?? './storage/clean.sqlite',
  jwtSecret: requireJwtSecret(process.env.JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN?.trim() || '*',
  defaultTzOffsetMinutes: parseTzOffsetMinutes(process.env.DEFAULT_TZ_OFFSET_MINUTES),
};
