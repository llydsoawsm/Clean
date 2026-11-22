import express, { type Request, type Response, type NextFunction } from 'express';
import { config } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { shopsRouter } from './modules/shops/shops.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { servicesRouter } from './modules/services/services.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { syncRouter } from './modules/sync/sync.routes';

export const app = express();

app.disable('x-powered-by');

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (config.corsOrigin === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && config.corsOrigin.split(',').map((s) => s.trim()).includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Lightweight in-memory rate limiter for auth endpoints (30 requests / 15 min per IP)
const authRateMap = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_REQUESTS = 30;

function authRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (config.nodeEnv === 'test') {
    next();
    return;
  }
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = authRateMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    authRateMap.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > AUTH_MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Please try again later.' },
    });
    return;
  }
  next();
}

// 5MB limit to accommodate large offline sync push batches
app.use(express.json({ limit: '5mb' }));

app.get('/', (_request, response) => {
  response.json({
    success: true,
    message: 'Clean API is running',
    endpoints: {
      root: '/api/v1',
      health: '/api/v1/health',
    },
  });
});

app.get('/api/v1', (_request, response) => {
  response.json({ success: true, message: 'Clean API v1' });
});

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRateLimiter, authRouter);
app.use('/api/v1/shops', shopsRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/services', servicesRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/sync', syncRouter);
app.use(errorHandler);
