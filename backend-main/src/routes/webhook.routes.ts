import { Router } from 'express';
import {
  handleEvolutionWebhook,
  handleWhaTicketWebhook,
  healthCheck,
} from '../controllers/webhook.controller';
import { validateWebhookSecret, validateWhaTicketSecret } from '../middlewares/auth.middleware';

const router = Router();

router.get('/health', healthCheck);

// Webhook principal da Evolution API (mensagens WhatsApp)
router.post('/evolution', validateWebhookSecret, handleEvolutionWebhook);

// Webhook do WhaTicket (fechamento de tickets para sync com GLPI)
router.post('/whaticket', validateWhaTicketSecret, handleWhaTicketWebhook);

export default router;
