import { Router } from 'express';
import { database } from '../../database/knex';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response) => {
  let databaseStatus: 'connected' | 'disconnected' = 'connected';

  try {
    await database.raw('select 1 as health_check');
  } catch (error) {
    databaseStatus = 'disconnected';
    console.error('Health database check failed:', error);
  }

  const apiStatus = 'running';
  const healthy = databaseStatus === 'connected';

  response.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'Clean API is running' : 'Clean API database is unavailable',
    data: {
      api: apiStatus,
      database: databaseStatus,
    },
  });
});
