import { z } from 'zod';
export declare const CreateInviteLinkSchema: z.ZodObject<{
    storeId: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        ADMIN: "ADMIN";
        VENDOR: "VENDOR";
    }>>;
    customRoleId: z.ZodOptional<z.ZodString>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    maxUses: z.ZodDefault<z.ZodNumber>;
    expiresAt: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const UpdateInviteLinkSchema: z.ZodObject<{
    id: z.ZodString;
    isActive: z.ZodOptional<z.ZodBoolean>;
    maxUses: z.ZodOptional<z.ZodNumber>;
    expiresAt: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const InviteLinkSearchSchema: z.ZodObject<{
    storeId: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const UseInviteLinkSchema: z.ZodObject<{
    token: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodString;
    telegramId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateInviteLink = z.infer<typeof CreateInviteLinkSchema>;
export type UpdateInviteLink = z.infer<typeof UpdateInviteLinkSchema>;
export type InviteLinkSearch = z.infer<typeof InviteLinkSearchSchema>;
export type UseInviteLink = z.infer<typeof UseInviteLinkSchema>;
//# sourceMappingURL=inviteLinkSchemas.d.ts.map