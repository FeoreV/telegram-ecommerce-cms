import { z } from 'zod';

// Схемы валидации для инвайт ссылок

export const CreateInviteLinkSchema = z.object({
  storeId: z.string().cuid('Неверный ID магазина'),
  role: z.enum(['ADMIN', 'VENDOR']).optional(),
  customRoleId: z.string().cuid('Неверный ID кастомной роли').optional(),
  permissions: z.array(z.string()).optional(),
  maxUses: z.number().int().min(1).max(1000).default(1),
  expiresAt: z.string().datetime().optional(),
  description: z.string().max(200, 'Описание не должно превышать 200 символов').optional()
}).refine(
  (data) => data.role || data.customRoleId,
  {
    message: 'Необходимо указать либо стандартную роль, либо кастомную роль'
  }
);

export const UpdateInviteLinkSchema = z.object({
  id: z.string().cuid('Неверный ID ссылки'),
  isActive: z.boolean().optional(),
  maxUses: z.number().int().min(1).max(1000).optional(),
  expiresAt: z.string().datetime().optional(),
  description: z.string().max(200).optional()
});

export const InviteLinkSearchSchema = z.object({
  storeId: z.string().cuid().optional(),
  isActive: z.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const UseInviteLinkSchema = z.object({
  token: z.string().min(1, 'Токен обязателен'),
  firstName: z.string().min(1, 'Имя обязательно'),
  lastName: z.string().min(1, 'Фамилия обязательна'),
  email: z.string().email('Неверный формат email'),
  telegramId: z.string().optional()
});

// Типы для TypeScript
export type CreateInviteLink = z.infer<typeof CreateInviteLinkSchema>;
export type UpdateInviteLink = z.infer<typeof UpdateInviteLinkSchema>;
export type InviteLinkSearch = z.infer<typeof InviteLinkSearchSchema>;
export type UseInviteLink = z.infer<typeof UseInviteLinkSchema>;
