import { Router } from 'express';
import { listCategories, lookupUser } from '../controllers/glpi.controller';
import { requireApiKey } from '../middlewares/auth.middleware';
import { ticketNotificationService } from '../services/ticket-notification.service';

const router = Router();

router.use(requireApiKey);

router.get('/glpi/categories', listCategories);
router.get('/glpi/users', lookupUser);

router.post('/debug/check-notifications', async (req, res) => {
  const force = req.query.force === 'true';
  await ticketNotificationService.checkUpdates(force);
  res.json({ ok: true, force });
});
export default router;
