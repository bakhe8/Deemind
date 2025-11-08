import type { Request, Response, NextFunction } from 'express';

function extractToken(req: Request) {
  const header = req.headers['authorization'];
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  if (typeof req.query.token === 'string') {
    return req.query.token;
  }
  if (typeof (req.body as any)?.token === 'string') {
    return (req.body as any).token;
  }
  const custom = req.headers['x-deemind-token'];
  if (typeof custom === 'string') {
    return custom;
  }
  return undefined;
}

export function makeAuthMiddleware(expectedToken?: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (!expectedToken) return next();
    const token = extractToken(req);
    if (token !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
}
