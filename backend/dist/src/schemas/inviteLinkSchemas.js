"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UseInviteLinkSchema = exports.InviteLinkSearchSchema = exports.UpdateInviteLinkSchema = exports.CreateInviteLinkSchema = void 0;
const zod_1 = require("zod");
exports.CreateInviteLinkSchema = zod_1.z.object({
    storeId: zod_1.z.string().cuid('Неверный ID магазина'),
    role: zod_1.z.enum(['ADMIN', 'VENDOR']).optional(),
    customRoleId: zod_1.z.string().cuid('Неверный ID кастомной роли').optional(),
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
    maxUses: zod_1.z.number().int().min(1).max(1000).default(1),
    expiresAt: zod_1.z.string().datetime().optional(),
    description: zod_1.z.string().max(200, 'Описание не должно превышать 200 символов').optional()
}).refine((data) => data.role || data.customRoleId, {
    message: 'Необходимо указать либо стандартную роль, либо кастомную роль'
});
exports.UpdateInviteLinkSchema = zod_1.z.object({
    id: zod_1.z.string().cuid('Неверный ID ссылки'),
    isActive: zod_1.z.boolean().optional(),
    maxUses: zod_1.z.number().int().min(1).max(1000).optional(),
    expiresAt: zod_1.z.string().datetime().optional(),
    description: zod_1.z.string().max(200).optional()
});
exports.InviteLinkSearchSchema = zod_1.z.object({
    storeId: zod_1.z.string().cuid().optional(),
    isActive: zod_1.z.boolean().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20)
});
exports.UseInviteLinkSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Токен обязателен'),
    firstName: zod_1.z.string().min(1, 'Имя обязательно'),
    lastName: zod_1.z.string().min(1, 'Фамилия обязательна'),
    email: zod_1.z.string().email('Неверный формат email'),
    telegramId: zod_1.z.string().optional()
});
//# sourceMappingURL=inviteLinkSchemas.js.map