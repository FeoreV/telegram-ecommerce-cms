"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logLoginActivity = exports.ActivityTrackers = exports.activityTracker = void 0;
const employeeService_1 = require("../services/employeeService");
const sanitizer_1 = require("../utils/sanitizer");
const activityTracker = (action, getDetails) => {
    return async (req, res, next) => {
        next();
        if (req.user && req.user.role !== 'CUSTOMER') {
            try {
                const storeId = req.params.storeId || req.body.storeId || req.query.storeId;
                if (storeId) {
                    const details = getDetails ? getDetails(req) : undefined;
                    employeeService_1.EmployeeService.logActivity(req.user.id, storeId, action, (details || {}), req.ip, req.get('User-Agent')).catch((err) => {
                        console.warn('Failed to log employee activity:', (0, sanitizer_1.sanitizeObjectForLog)(err));
                    });
                }
            }
            catch (err) {
                console.warn('Activity tracker error:', err);
            }
        }
    };
};
exports.activityTracker = activityTracker;
exports.ActivityTrackers = {
    productCreated: (0, exports.activityTracker)('PRODUCT_CREATED', (req) => ({
        productId: req.body.id,
        productName: req.body.name
    })),
    productUpdated: (0, exports.activityTracker)('PRODUCT_UPDATED', (req) => ({
        productId: req.params.id || req.body.id,
        changes: req.body
    })),
    productDeleted: (0, exports.activityTracker)('PRODUCT_DELETED', (req) => ({
        productId: req.params.id
    })),
    orderViewed: (0, exports.activityTracker)('ORDER_VIEWED', (req) => ({
        orderId: req.params.id
    })),
    orderUpdated: (0, exports.activityTracker)('ORDER_UPDATED', (req) => ({
        orderId: req.params.id || req.body.orderId,
        newStatus: req.body.status,
        changes: req.body
    })),
    orderConfirmed: (0, exports.activityTracker)('ORDER_CONFIRMED', (req) => ({
        orderId: req.params.id || req.body.orderId
    })),
    orderRejected: (0, exports.activityTracker)('ORDER_REJECTED', (req) => ({
        orderId: req.params.id || req.body.orderId,
        reason: req.body.rejectionReason
    })),
    inventoryUpdated: (0, exports.activityTracker)('INVENTORY_UPDATED', (req) => ({
        productId: req.params.productId || req.body.productId,
        variantId: req.params.variantId || req.body.variantId,
        previousQty: req.body.previousQty,
        newQty: req.body.newQty,
        changeType: req.body.changeType
    })),
    employeeInvited: (0, exports.activityTracker)('EMPLOYEE_INVITED', (req) => ({
        invitedEmail: req.body.email,
        role: req.body.role
    })),
    employeeRoleChanged: (0, exports.activityTracker)('EMPLOYEE_ROLE_CHANGED', (req) => ({
        targetUserId: req.body.userId,
        newRole: req.body.role,
        permissions: req.body.permissions
    })),
    employeeRemoved: (0, exports.activityTracker)('EMPLOYEE_REMOVED', (req) => ({
        removedUserId: req.params.userId,
        reason: req.body.reason
    })),
    login: (0, exports.activityTracker)('LOGIN'),
    logout: (0, exports.activityTracker)('LOGOUT'),
    settingsChanged: (0, exports.activityTracker)('SETTINGS_CHANGED', (req) => ({
        section: req.body.section,
        changes: req.body.changes
    })),
    analyticsExported: (0, exports.activityTracker)('ANALYTICS_EXPORTED', (req) => ({
        reportType: req.query.type,
        dateRange: { from: req.query.from, to: req.query.to }
    })),
    reportGenerated: (0, exports.activityTracker)('REPORT_GENERATED', (req) => ({
        reportType: req.body.type,
        parameters: req.body.parameters
    }))
};
const logLoginActivity = async (req, res, next) => {
    if (req.user && req.user.role !== 'CUSTOMER') {
        try {
            const { prisma } = await import('../lib/prisma');
            const stores = await prisma.store.findMany({
                where: {
                    OR: [
                        { ownerId: req.user.id },
                        { admins: { some: { userId: req.user.id } } },
                        { vendors: { some: { userId: req.user.id } } }
                    ]
                },
                select: { id: true }
            });
            for (const store of stores) {
                employeeService_1.EmployeeService.logActivity(req.user.id, store.id, 'LOGIN', {
                    loginTime: new Date().toISOString(),
                    method: 'web'
                }, req.ip, req.get('User-Agent')).catch((err) => {
                    console.warn('Failed to log login activity:', (0, sanitizer_1.sanitizeObjectForLog)(err));
                });
            }
        }
        catch (err) {
            console.warn('Login activity tracker error:', err);
        }
    }
    next();
};
exports.logLoginActivity = logLoginActivity;
//# sourceMappingURL=activityTracker.js.map