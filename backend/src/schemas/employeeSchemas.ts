import { z } from 'zod';

// Схемы валидации для управления сотрудниками

export const EmployeeInviteSchema = z.object({
  email: z.string().email('Неверный формат email'),
  firstName: z.string().min(1, 'Имя обязательно'),
  lastName: z.string().min(1, 'Фамилия обязательна'), 
  role: z.enum(['ADMIN', 'VENDOR']).optional(),
  customRoleId: z.string().cuid('Неверный ID кастомной роли').optional(),
  storeId: z.string().cuid('Неверный ID магазина'),
  permissions: z.array(z.string()).optional(),
  message: z.string().max(500, 'Сообщение не должно превышать 500 символов').optional()
}).refine(
  (data) => data.role || data.customRoleId,
  {
    message: 'Необходимо указать либо стандартную роль, либо кастомную роль'
  }
);

export const UpdateEmployeeRoleSchema = z.object({
  userId: z.string().cuid('Неверный ID пользователя'),
  storeId: z.string().cuid('Неверный ID магазина'),
  role: z.enum(['ADMIN', 'VENDOR']).optional(),
  customRoleId: z.string().cuid('Неверный ID кастомной роли').optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
}).refine(
  (data) => data.role || data.customRoleId,
  {
    message: 'Необходимо указать либо стандартную роль, либо кастомную роль'
  }
);

export const EmployeePermissionSchema = z.object({
  userId: z.string().cuid(),
  storeId: z.string().cuid(),
  permissions: z.array(z.string()),
  reason: z.string().max(200).optional()
});

export const EmployeeSearchSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['ADMIN', 'VENDOR', 'ALL']).default('ALL'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).default('ALL'),
  storeId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// Типы для TypeScript
export type EmployeeInvite = z.infer<typeof EmployeeInviteSchema>;
export type UpdateEmployeeRole = z.infer<typeof UpdateEmployeeRoleSchema>;
export type EmployeePermission = z.infer<typeof EmployeePermissionSchema>;
export type EmployeeSearch = z.infer<typeof EmployeeSearchSchema>;

// Дополнительные схемы для аудита
export const EmployeeActionLogSchema = z.object({
  action: z.enum(['INVITE_SENT', 'ROLE_CHANGED', 'PERMISSIONS_UPDATED', 'DEACTIVATED', 'ACTIVATED']),
  targetUserId: z.string().cuid(),
  storeId: z.string().cuid(),
  details: z.record(z.string(), z.any()).optional(),
  reason: z.string().max(500).optional()
});

export type EmployeeActionLog = z.infer<typeof EmployeeActionLogSchema>;
