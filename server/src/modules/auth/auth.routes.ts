import { Router } from 'express';
import { registerSchema, loginSchema } from './auth.schemas';
import * as authService from './auth.service';

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
      return;
    }

    const result = await authService.register(parsed.data);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    if (err.statusCode) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.statusCode === 409 ? 'EMAIL_EXISTS' : 'AUTH_ERROR', message: err.message },
      });
      return;
    }
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
      return;
    }

    const result = await authService.login(parsed.data);
    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    if (err.statusCode) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: err.message },
      });
      return;
    }
    next(error);
  }
});
