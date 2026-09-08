import express from 'express';
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
app.use(express.json());

app.get('/api/v1', (_request, response) => {
  response.json({ success: true, message: 'Clean API v1' });
});

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/shops', shopsRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/services', servicesRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/sync', syncRouter);
app.use(errorHandler);
