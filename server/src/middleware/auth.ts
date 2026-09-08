import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type AuthPayload } from '../modules/auth/auth.service';

export interface AuthenticatedRequest extends Request {
  auth?: AuthPayload;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
    });
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing token' },
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.auth = payload;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    const isExpired = message.toLowerCase().includes('expired');
    res.status(401).json({
      success: false,
      error: { code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED', message: isExpired ? 'Token expired' : 'Invalid token' },
    });
  }
}
