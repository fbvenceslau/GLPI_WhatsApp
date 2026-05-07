import { Router } from 'express';
import { listCategories, lookupUser } from '../controllers/glpi.controller';
import { requireApiKey } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireApiKey);

router.get('/glpi/categories', listCategories);
router.get('/glpi/users', lookupUser);

export default router;
