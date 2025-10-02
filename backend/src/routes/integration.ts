import { Router } from 'express';
import { upsertMapping, getMapping } from '../controllers/integrationController';

const router = Router();

router.post('/mappings', upsertMapping);
router.get('/mappings', getMapping);

export default router;


