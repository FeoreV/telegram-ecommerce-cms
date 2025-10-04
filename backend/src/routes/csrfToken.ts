/**
 * CSRF Token Route
 * Provides CSRF tokens for client applications
 */

import { Router } from 'express';
import { getCsrfToken } from '../middleware/csrf';

const router = Router();

/**
 * GET /api/csrf-token
 * Returns a CSRF token for the client to use in subsequent requests
 * This should be called before any state-changing operations
 */
router.get('/csrf-token', getCsrfToken);

export default router;

