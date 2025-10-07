"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const SecureAuthController_1 = require("./SecureAuthController");
const SecureAuthMiddleware_1 = require("./SecureAuthMiddleware");
const SecureAuthSystem_1 = require("./SecureAuthSystem");
const csrfProtection_1 = require("../middleware/csrfProtection");
const router = express_1.default.Router();
router.post('/login/email', SecureAuthMiddleware_1.loginSlowDown, SecureAuthController_1.loginWithEmail);
router.post('/login/telegram', SecureAuthMiddleware_1.loginSlowDown, SecureAuthController_1.loginWithTelegram);
router.post('/telegram', SecureAuthMiddleware_1.loginSlowDown, SecureAuthController_1.loginWithTelegram);
router.post('/refresh-token', SecureAuthController_1.refreshToken);
router.post('/auto-refresh', SecureAuthController_1.autoRefresh);
router.post('/verify-token', SecureAuthMiddleware_1.optionalAuthMiddleware, SecureAuthController_1.verifyToken);
router.post('/logout', SecureAuthMiddleware_1.secureAuthMiddleware, csrfProtection_1.csrfProtection, SecureAuthController_1.logout);
router.get('/profile', SecureAuthMiddleware_1.secureAuthMiddleware, SecureAuthController_1.getProfile);
router.patch('/profile', SecureAuthMiddleware_1.secureAuthMiddleware, csrfProtection_1.csrfProtection, SecureAuthController_1.updateProfile);
router.post('/change-password', SecureAuthMiddleware_1.secureAuthMiddleware, csrfProtection_1.csrfProtection, SecureAuthController_1.changePassword);
router.post('/set-password', ...SecureAuthMiddleware_1.ownerAuthMiddlewareStack, csrfProtection_1.csrfProtection, SecureAuthController_1.setPassword);
router.get('/permissions/:userId?', SecureAuthMiddleware_1.secureAuthMiddleware, (0, SecureAuthMiddleware_1.requireRole)([SecureAuthSystem_1.UserRole.OWNER, SecureAuthSystem_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { SecureAuthSystem } = await import('./SecureAuthSystem.js');
        const targetUserId = req.params.userId || req.user?.id;
        if (targetUserId !== req.user?.id && req.user?.role !== SecureAuthSystem_1.UserRole.OWNER) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        const permissions = await SecureAuthSystem.getUserPermissions(targetUserId);
        res.json({
            success: true,
            userId: targetUserId,
            permissions
        });
    }
    catch (error) {
        console.error('Error fetching permissions', error);
        res.status(500).json({
            error: 'Failed to get permissions',
            code: 'PERMISSIONS_ERROR'
        });
    }
});
router.get('/health', async (req, res) => {
    try {
        const { prisma } = await import('../lib/prisma.js');
        await prisma.user.count();
        let redisStatus = 'not_configured';
        if (process.env.REDIS_URL) {
            redisStatus = 'connected';
        }
        res.json({
            success: true,
            status: 'healthy',
            services: {
                database: 'connected',
                redis: redisStatus,
                jwt: 'operational'
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Health check error', error);
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: 'Service check failed',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/stats', ...SecureAuthMiddleware_1.ownerAuthMiddlewareStack, async (req, res) => {
    try {
        const { prisma } = await import('../lib/prisma.js');
        const userStats = await prisma.user.groupBy({
            by: ['role'],
            _count: {
                id: true
            }
        });
        const activeUsers = await prisma.user.count({
            where: {
                isActive: true
            }
        });
        const totalUsers = await prisma.user.count();
        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                usersByRole: userStats.reduce((acc, stat) => {
                    acc[stat.role] = stat._count.id;
                    return acc;
                }, {}),
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Auth stats error', error);
        res.status(500).json({
            error: 'Failed to get auth stats',
            code: 'STATS_ERROR'
        });
    }
});
exports.default = router;
//# sourceMappingURL=SecureAuthRoutes.js.map