"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_CATEGORIES = exports.AVAILABLE_PERMISSIONS = exports.AssignCustomRoleSchema = exports.CustomRoleSearchSchema = exports.UpdateCustomRoleSchema = exports.CreateCustomRoleSchema = void 0;
const zod_1 = require("zod");
exports.CreateCustomRoleSchema = zod_1.z.object({
    storeId: zod_1.z.string().cuid('Неверный ID магазина'),
    name: zod_1.z.string().min(1, 'Название роли обязательно').max(50, 'Название не должно превышать 50 символов'),
    description: zod_1.z.string().max(200, 'Описание не должно превышать 200 символов').optional(),
    permissions: zod_1.z.array(zod_1.z.string()).min(1, 'Необходимо выбрать хотя бы одно разрешение'),
    color: zod_1.z.string().regex(/^#[0-9A-F]{6}$/i, 'Неверный формат цвета (должен быть hex)').default('#6366f1'),
    icon: zod_1.z.string().max(20, 'Название иконки не должно превышать 20 символов').optional()
});
exports.UpdateCustomRoleSchema = zod_1.z.object({
    id: zod_1.z.string().cuid('Неверный ID роли'),
    name: zod_1.z.string().min(1).max(50).optional(),
    description: zod_1.z.string().max(200).optional(),
    permissions: zod_1.z.array(zod_1.z.string()).min(1).optional(),
    color: zod_1.z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    icon: zod_1.z.string().max(20).optional(),
    isActive: zod_1.z.boolean().optional()
});
exports.CustomRoleSearchSchema = zod_1.z.object({
    storeId: zod_1.z.string().cuid(),
    search: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20)
});
exports.AssignCustomRoleSchema = zod_1.z.object({
    userId: zod_1.z.string().cuid('Неверный ID пользователя'),
    storeId: zod_1.z.string().cuid('Неверный ID магазина'),
    customRoleId: zod_1.z.string().cuid('Неверный ID роли')
});
exports.AVAILABLE_PERMISSIONS = [
    { value: 'PRODUCT_CREATE', label: 'Создание товаров', category: 'products' },
    { value: 'PRODUCT_UPDATE', label: 'Редактирование товаров', category: 'products' },
    { value: 'PRODUCT_DELETE', label: 'Удаление товаров', category: 'products' },
    { value: 'PRODUCT_VIEW', label: 'Просмотр товаров', category: 'products' },
    { value: 'ORDER_VIEW', label: 'Просмотр заказов', category: 'orders' },
    { value: 'ORDER_UPDATE', label: 'Обновление заказов', category: 'orders' },
    { value: 'ORDER_CONFIRM', label: 'Подтверждение заказов', category: 'orders' },
    { value: 'ORDER_REJECT', label: 'Отклонение заказов', category: 'orders' },
    { value: 'ORDER_DELETE', label: 'Удаление заказов', category: 'orders' },
    { value: 'INVENTORY_VIEW', label: 'Просмотр склада', category: 'inventory' },
    { value: 'INVENTORY_UPDATE', label: 'Управление складом', category: 'inventory' },
    { value: 'ANALYTICS_VIEW', label: 'Просмотр аналитики', category: 'analytics' },
    { value: 'ANALYTICS_EXPORT', label: 'Экспорт отчетов', category: 'analytics' },
    { value: 'USER_VIEW', label: 'Просмотр пользователей', category: 'users' },
    { value: 'USER_UPDATE', label: 'Редактирование пользователей', category: 'users' },
    { value: 'USER_CREATE', label: 'Создание пользователей', category: 'users' },
    { value: 'STORE_VIEW', label: 'Просмотр настроек магазина', category: 'store' },
    { value: 'STORE_UPDATE', label: 'Изменение настроек магазина', category: 'store' },
    { value: 'NOTIFICATION_SEND', label: 'Отправка уведомлений', category: 'notifications' },
    { value: 'BOT_MANAGE', label: 'Управление ботом', category: 'bots' },
    { value: 'BOT_CONFIG', label: 'Настройка бота', category: 'bots' }
];
exports.PERMISSION_CATEGORIES = [
    { key: 'products', label: 'Товары', icon: '📦', color: '#3b82f6' },
    { key: 'orders', label: 'Заказы', icon: '📋', color: '#10b981' },
    { key: 'inventory', label: 'Склад', icon: '📊', color: '#f59e0b' },
    { key: 'analytics', label: 'Аналитика', icon: '📈', color: '#8b5cf6' },
    { key: 'users', label: 'Пользователи', icon: '👥', color: '#ef4444' },
    { key: 'store', label: 'Магазин', icon: '🏪', color: '#06b6d4' },
    { key: 'notifications', label: 'Уведомления', icon: '🔔', color: '#84cc16' },
    { key: 'bots', label: 'Боты', icon: '🤖', color: '#ec4899' }
];
//# sourceMappingURL=customRoleSchemas.js.map