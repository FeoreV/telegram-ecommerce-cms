import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { UserRole } from '../utils/jwt';
import {
  getBasicHealth,
  getDetailedHealth,
  getReadinessProbe,
  getLivenessProbe,
  getPerformanceMetrics,
  getSystemInfo,
  getResourceHistory,
  getDiagnostics,
  getPublicDiagnostics,
} from '../controllers/healthController';

const router = Router();

// Basic health check (public endpoint)
router.get('/', getBasicHealth);

// Public diagnostics snapshot
router.get('/diagnostics/public', getPublicDiagnostics);

// Kubernetes/Docker health probes (public)
router.get('/ready', getReadinessProbe);
router.get('/live', getLivenessProbe);

// Detailed health check (authenticated)
router.get('/detailed', authMiddleware, requireRole([UserRole.OWNER, UserRole.ADMIN]), getDetailedHealth);

// Performance metrics (authenticated)
router.get('/metrics', authMiddleware, requireRole([UserRole.OWNER, UserRole.ADMIN]), getPerformanceMetrics);

// Resource usage history (authenticated)
router.get('/history', authMiddleware, requireRole([UserRole.OWNER, UserRole.ADMIN]), getResourceHistory);

// System information (owner only)
router.get('/system', authMiddleware, requireRole([UserRole.OWNER]), getSystemInfo);

// Application diagnostics (owner only)
router.get('/diagnostics', authMiddleware, requireRole([UserRole.OWNER]), getDiagnostics);

export default router;
