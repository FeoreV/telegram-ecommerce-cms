import { z } from 'zod';

// Схемы валидации для кастомных ролей

export const CreateCustomRoleSchema = z.object({
  storeId: z.string().cuid('Неверный ID магазина'),
  name: z.string().min(1, 'Название роли обязательно').max(50, 'Название не должно превышать 50 символов'),
  description: z.string().max(200, 'Описание не должно превышать 200 символов').optional(),
  permissions: z.array(z.string()).min(1, 'Необходимо выбрать хотя бы одно разрешение'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Неверный формат цвета (должен быть hex)').default('#6366f1'),
  icon: z.string().max(20, 'Название иконки не должно превышать 20 символов').optional()
});

export const UpdateCustomRoleSchema = z.object({
  id: z.string().cuid('Неверный ID роли'),
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).min(1).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  icon: z.string().max(20).optional(),
  isActive: z.boolean().optional()
});

export const CustomRoleSearchSchema = z.object({
  storeId: z.string().cuid(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const AssignCustomRoleSchema = z.object({
  userId: z.string().cuid('Неверный ID пользователя'),
  storeId: z.string().cuid('Неверный ID магазина'),
  customRoleId: z.string().cuid('Неверный ID роли')
});

// Типы для TypeScript
export type CreateCustomRole = z.infer<typeof CreateCustomRoleSchema>;
export type UpdateCustomRole = z.infer<typeof UpdateCustomRoleSchema>;
export type CustomRoleSearch = z.infer<typeof CustomRoleSearchSchema>;
export type AssignCustomRole = z.infer<typeof AssignCustomRoleSchema>;

// Предустановленные разрешения с описаниями
export const AVAILABLE_PERMISSIONS = [
  // Управление товарами
  { value: 'PRODUCT_CREATE', label: 'Создание товаров', category: 'products' },
  { value: 'PRODUCT_UPDATE', label: 'Редактирование товаров', category: 'products' },
  { value: 'PRODUCT_DELETE', label: 'Удаление товаров', category: 'products' },
  { value: 'PRODUCT_VIEW', label: 'Просмотр товаров', category: 'products' },
  
  // Управление заказами
  { value: 'ORDER_VIEW', label: 'Просмотр заказов', category: 'orders' },
  { value: 'ORDER_UPDATE', label: 'Обновление заказов', category: 'orders' },
  { value: 'ORDER_CONFIRM', label: 'Подтверждение заказов', category: 'orders' },
  { value: 'ORDER_REJECT', label: 'Отклонение заказов', category: 'orders' },
  { value: 'ORDER_DELETE', label: 'Удаление заказов', category: 'orders' },
  
  // Управление складом
  { value: 'INVENTORY_VIEW', label: 'Просмотр склада', category: 'inventory' },
  { value: 'INVENTORY_UPDATE', label: 'Управление складом', category: 'inventory' },
  
  // Аналитика
  { value: 'ANALYTICS_VIEW', label: 'Просмотр аналитики', category: 'analytics' },
  { value: 'ANALYTICS_EXPORT', label: 'Экспорт отчетов', category: 'analytics' },
  
  // Пользователи
  { value: 'USER_VIEW', label: 'Просмотр пользователей', category: 'users' },
  { value: 'USER_UPDATE', label: 'Редактирование пользователей', category: 'users' },
  { value: 'USER_CREATE', label: 'Создание пользователей', category: 'users' },
  
  // Магазин
  { value: 'STORE_VIEW', label: 'Просмотр настроек магазина', category: 'store' },
  { value: 'STORE_UPDATE', label: 'Изменение настроек магазина', category: 'store' },
  
  // Уведомления
  { value: 'NOTIFICATION_SEND', label: 'Отправка уведомлений', category: 'notifications' },
  
  // Боты
  { value: 'BOT_MANAGE', label: 'Управление ботом', category: 'bots' },
  { value: 'BOT_CONFIG', label: 'Настройка бота', category: 'bots' }
] as const;

export const PERMISSION_CATEGORIES = [
  { key: 'products', label: 'Товары', icon: '📦', color: '#3b82f6' },
  { key: 'orders', label: 'Заказы', icon: '📋', color: '#10b981' },
  { key: 'inventory', label: 'Склад', icon: '📊', color: '#f59e0b' },
  { key: 'analytics', label: 'Аналитика', icon: '📈', color: '#8b5cf6' },
  { key: 'users', label: 'Пользователи', icon: '👥', color: '#ef4444' },
  { key: 'store', label: 'Магазин', icon: '🏪', color: '#06b6d4' },
  { key: 'notifications', label: 'Уведомления', icon: '🔔', color: '#84cc16' },
  { key: 'bots', label: 'Боты', icon: '🤖', color: '#ec4899' }
] as const;
