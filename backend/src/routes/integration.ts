import { Router } from 'express';
import { getMapping, upsertMapping } from '../controllers/integrationController';
import { csrfProtection } from '../middleware/csrfProtection';

const router = Router();

// SECURITY: CSRF protected state-changing endpoint
router.post('/mappings', csrfProtection(), upsertMapping);
router.get('/mappings', getMapping);

export default router;


