import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function validateWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-webhook-secret'] || req.query.secret;
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret) {
    logger.warn('[Auth] WEBHOOK_SECRET não configurado — validação desabilitada em dev.');
    next();
    return;
  }

  if (secret !== expectedSecret) {
    logger.warn(`[Auth] Webhook com secret inválido de ${req.ip}`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

export function validateWhaTicketSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-whaticket-secret'];
  const expectedSecret = process.env.WHATICKET_WEBHOOK_SECRET;

  if (!expectedSecret) {
    next();
    return;
  }

  if (secret !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.ADMIN_SECRET;

  if (!expectedKey || apiKey !== expectedKey) {
    res.status(401).json({ error: 'API Key inválida.' });
    return;
  }

  next();
}
