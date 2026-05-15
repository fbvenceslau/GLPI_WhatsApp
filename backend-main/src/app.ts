import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { syncDatabase } from './models';
import webhookRoutes from './routes/webhook.routes';
import adminRoutes from './routes/admin.routes';
import { buildAdminRouter } from './admin/adminjs.config';
import { conversationService } from './services/conversation.service';
import { registrationService } from './services/registration.service';
import { ticketNotificationService } from './services/ticket-notification.service';
import logger from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// ─── Segurança (sem body parser aqui — AdminJS precisa vir antes) ──────────
app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' }));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
}));

// ─── Bootstrap ─────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  try {
    await syncDatabase();

    // AdminJS DEVE ser registrado antes do express.json()
    const adminRouter = buildAdminRouter();
    app.use('/admin', adminRouter);
    logger.info('[App] Painel AdminJS disponível em /admin');

    // Body parsers APÓS o AdminJS (exigência do @adminjs/express)
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Demais rotas
    app.use('/webhook', webhookRoutes);
    app.use('/api', adminRoutes);

    setInterval(() => conversationService.cleanExpiredSessions(), 15 * 60 * 1000);
    setInterval(() => registrationService.checkPendingRegistrations(), 3 * 60 * 1000);
    setInterval(() => ticketNotificationService.checkUpdates(), 5 * 60 * 1000);

    app.listen(PORT, () => {
      logger.info(`[App] Servidor rodando na porta ${PORT} (${process.env.NODE_ENV})`);
      logger.info(`[App] Webhook Evolution: POST http://localhost:${PORT}/webhook/evolution`);
      logger.info(`[App] Webhook WhaTicket: POST http://localhost:${PORT}/webhook/whaticket`);
    });
  } catch (error) {
    logger.error('[App] Falha crítica na inicialização:', error);
    process.exit(1);
  }
}

bootstrap();

export default app;
