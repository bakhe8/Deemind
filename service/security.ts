import type { Request, Response, NextFunction } from 'express';

export function makeAuthMiddleware(expectedToken?: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (!expectedToken) return next();
    const header = req.headers['authorization'];
    if (!header || header !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
}
