import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  // Client errors raised by express.json() (malformed JSON, payload too large, etc.)
  const status = typeof error?.status === 'number' ? error.status : undefined;
  if (status && status >= 400 && status < 500) {
    response.status(status).json({
      success: false,
      error: {
        code: error.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'BAD_REQUEST',
        message: error.type === 'entity.parse.failed' ? 'Request body is not valid JSON' : 'Bad request',
      },
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred',
    },
  });
};
