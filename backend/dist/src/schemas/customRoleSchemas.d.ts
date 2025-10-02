import { z } from 'zod';
export declare const CreateCustomRoleSchema: z.ZodObject<{
    storeId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    permissions: z.ZodArray<z.ZodString>;
    color: z.ZodDefault<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const UpdateCustomRoleSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    color: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const CustomRoleSearchSchema: z.ZodObject<{
    storeId: z.ZodString;
    search: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const AssignCustomRoleSchema: z.ZodObject<{
    userId: z.ZodString;
    storeId: z.ZodString;
    customRoleId: z.ZodString;
}, z.core.$strip>;
export type CreateCustomRole = z.infer<typeof CreateCustomRoleSchema>;
export type UpdateCustomRole = z.infer<typeof UpdateCustomRoleSchema>;
export type CustomRoleSearch = z.infer<typeof CustomRoleSearchSchema>;
export type AssignCustomRole = z.infer<typeof AssignCustomRoleSchema>;
export declare const AVAILABLE_PERMISSIONS: readonly [{
    readonly value: "PRODUCT_CREATE";
    readonly label: "Создание товаров";
    readonly category: "products";
}, {
    readonly value: "PRODUCT_UPDATE";
    readonly label: "Редактирование товаров";
    readonly category: "products";
}, {
    readonly value: "PRODUCT_DELETE";
    readonly label: "Удаление товаров";
    readonly category: "products";
}, {
    readonly value: "PRODUCT_VIEW";
    readonly label: "Просмотр товаров";
    readonly category: "products";
}, {
    readonly value: "ORDER_VIEW";
    readonly label: "Просмотр заказов";
    readonly category: "orders";
}, {
    readonly value: "ORDER_UPDATE";
    readonly label: "Обновление заказов";
    readonly category: "orders";
}, {
    readonly value: "ORDER_CONFIRM";
    readonly label: "Подтверждение заказов";
    readonly category: "orders";
}, {
    readonly value: "ORDER_REJECT";
    readonly label: "Отклонение заказов";
    readonly category: "orders";
}, {
    readonly value: "ORDER_DELETE";
    readonly label: "Удаление заказов";
    readonly category: "orders";
}, {
    readonly value: "INVENTORY_VIEW";
    readonly label: "Просмотр склада";
    readonly category: "inventory";
}, {
    readonly value: "INVENTORY_UPDATE";
    readonly label: "Управление складом";
    readonly category: "inventory";
}, {
    readonly value: "ANALYTICS_VIEW";
    readonly label: "Просмотр аналитики";
    readonly category: "analytics";
}, {
    readonly value: "ANALYTICS_EXPORT";
    readonly label: "Экспорт отчетов";
    readonly category: "analytics";
}, {
    readonly value: "USER_VIEW";
    readonly label: "Просмотр пользователей";
    readonly category: "users";
}, {
    readonly value: "USER_UPDATE";
    readonly label: "Редактирование пользователей";
    readonly category: "users";
}, {
    readonly value: "USER_CREATE";
    readonly label: "Создание пользователей";
    readonly category: "users";
}, {
    readonly value: "STORE_VIEW";
    readonly label: "Просмотр настроек магазина";
    readonly category: "store";
}, {
    readonly value: "STORE_UPDATE";
    readonly label: "Изменение настроек магазина";
    readonly category: "store";
}, {
    readonly value: "NOTIFICATION_SEND";
    readonly label: "Отправка уведомлений";
    readonly category: "notifications";
}, {
    readonly value: "BOT_MANAGE";
    readonly label: "Управление ботом";
    readonly category: "bots";
}, {
    readonly value: "BOT_CONFIG";
    readonly label: "Настройка бота";
    readonly category: "bots";
}];
export declare const PERMISSION_CATEGORIES: readonly [{
    readonly key: "products";
    readonly label: "Товары";
    readonly icon: "📦";
    readonly color: "#3b82f6";
}, {
    readonly key: "orders";
    readonly label: "Заказы";
    readonly icon: "📋";
    readonly color: "#10b981";
}, {
    readonly key: "inventory";
    readonly label: "Склад";
    readonly icon: "📊";
    readonly color: "#f59e0b";
}, {
    readonly key: "analytics";
    readonly label: "Аналитика";
    readonly icon: "📈";
    readonly color: "#8b5cf6";
}, {
    readonly key: "users";
    readonly label: "Пользователи";
    readonly icon: "👥";
    readonly color: "#ef4444";
}, {
    readonly key: "store";
    readonly label: "Магазин";
    readonly icon: "🏪";
    readonly color: "#06b6d4";
}, {
    readonly key: "notifications";
    readonly label: "Уведомления";
    readonly icon: "🔔";
    readonly color: "#84cc16";
}, {
    readonly key: "bots";
    readonly label: "Боты";
    readonly icon: "🤖";
    readonly color: "#ec4899";
}];
//# sourceMappingURL=customRoleSchemas.d.ts.map