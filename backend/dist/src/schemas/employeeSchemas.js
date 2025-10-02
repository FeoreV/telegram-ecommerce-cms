"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeActionLogSchema = exports.EmployeeSearchSchema = exports.EmployeePermissionSchema = exports.UpdateEmployeeRoleSchema = exports.EmployeeInviteSchema = void 0;
const zod_1 = require("zod");
exports.EmployeeInviteSchema = zod_1.z.object({
    email: zod_1.z.string().email('Неверный формат email'),
    firstName: zod_1.z.string().min(1, 'Имя обязательно'),
    lastName: zod_1.z.string().min(1, 'Фамилия обязательна'),
    role: zod_1.z.enum(['ADMIN', 'VENDOR']).optional(),
    customRoleId: zod_1.z.string().cuid('Неверный ID кастомной роли').optional(),
    storeId: zod_1.z.string().cuid('Неверный ID магазина'),
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
    message: zod_1.z.string().max(500, 'Сообщение не должно превышать 500 символов').optional()
}).refine((data) => data.role || data.customRoleId, {
    message: 'Необходимо указать либо стандартную роль, либо кастомную роль'
});
exports.UpdateEmployeeRoleSchema = zod_1.z.object({
    userId: zod_1.z.string().cuid('Неверный ID пользователя'),
    storeId: zod_1.z.string().cuid('Неверный ID магазина'),
    role: zod_1.z.enum(['ADMIN', 'VENDOR']).optional(),
    customRoleId: zod_1.z.string().cuid('Неверный ID кастомной роли').optional(),
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
    isActive: zod_1.z.boolean().optional()
}).refine((data) => data.role || data.customRoleId, {
    message: 'Необходимо указать либо стандартную роль, либо кастомную роль'
});
exports.EmployeePermissionSchema = zod_1.z.object({
    userId: zod_1.z.string().cuid(),
    storeId: zod_1.z.string().cuid(),
    permissions: zod_1.z.array(zod_1.z.string()),
    reason: zod_1.z.string().max(200).optional()
});
exports.EmployeeSearchSchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    role: zod_1.z.enum(['ADMIN', 'VENDOR', 'ALL']).default('ALL'),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'ALL']).default('ALL'),
    storeId: zod_1.z.string().cuid().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20)
});
exports.EmployeeActionLogSchema = zod_1.z.object({
    action: zod_1.z.enum(['INVITE_SENT', 'ROLE_CHANGED', 'PERMISSIONS_UPDATED', 'DEACTIVATED', 'ACTIVATED']),
    targetUserId: zod_1.z.string().cuid(),
    storeId: zod_1.z.string().cuid(),
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    reason: zod_1.z.string().max(500).optional()
});
//# sourceMappingURL=employeeSchemas.js.map