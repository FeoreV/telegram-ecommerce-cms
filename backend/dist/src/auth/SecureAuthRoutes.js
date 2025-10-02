"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const SecureAuthController_1 = require("./SecureAuthController");
const SecureAuthMiddleware_1 = require("./SecureAuthMiddleware");
const SecureAuthSystem_1 = require("./SecureAuthSystem");
const router = express_1.default.Router();
router.post('/login/email', SecureAuthMiddleware_1.loginSlowDown, SecureAuthController_1.loginWithEmail);
router.post('/login/telegram', SecureAuthMiddleware_1.loginSlowDown, SecureAuthController_1.loginWithTelegram);
router.post('/telegram', SecureAuthMiddleware_1.loginSlowDown, SecureAuthController_1.loginWithTelegram);
router.post('/refresh-token', SecureAuthController_1.refreshToken);
router.post('/auto-refresh', SecureAuthController_1.autoRefresh);
router.post('/verify-token', SecureAuthMiddleware_1.optionalAuthMiddleware, SecureAuthController_1.verifyToken);
router.post('/logout', SecureAuthMiddleware_1.secureAuthMiddleware, SecureAuthController_1.logout);
router.get('/profile', SecureAuthMiddleware_1.secureAuthMiddleware, SecureAuthController_1.getProfile);
router.patch('/profile', SecureAuthMiddleware_1.secureAuthMiddleware, SecureAuthController_1.updateProfile);
router.post('/change-password', SecureAuthMiddleware_1.secureAuthMiddleware, SecureAuthController_1.changePassword);
router.post('/set-password', ...SecureAuthMiddleware_1.ownerAuthMiddlewareStack, SecureAuthController_1.setPassword);
router.get('/permissions/:userId?', SecureAuthMiddleware_1.secureAuthMiddleware, (0, SecureAuthMiddleware_1.requireRole)([SecureAuthSystem_1.UserRole.OWNER, SecureAuthSystem_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { SecureAuthSystem } = await Promise.resolve().then(() => __importStar(require('./SecureAuthSystem')));
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
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../lib/prisma')));
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
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../lib/prisma')));
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