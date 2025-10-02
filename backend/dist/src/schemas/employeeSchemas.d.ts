import { z } from 'zod';
export declare const EmployeeInviteSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        ADMIN: "ADMIN";
        VENDOR: "VENDOR";
    }>>;
    customRoleId: z.ZodOptional<z.ZodString>;
    storeId: z.ZodString;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const UpdateEmployeeRoleSchema: z.ZodObject<{
    userId: z.ZodString;
    storeId: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        ADMIN: "ADMIN";
        VENDOR: "VENDOR";
    }>>;
    customRoleId: z.ZodOptional<z.ZodString>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const EmployeePermissionSchema: z.ZodObject<{
    userId: z.ZodString;
    storeId: z.ZodString;
    permissions: z.ZodArray<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const EmployeeSearchSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    role: z.ZodDefault<z.ZodEnum<{
        ALL: "ALL";
        ADMIN: "ADMIN";
        VENDOR: "VENDOR";
    }>>;
    status: z.ZodDefault<z.ZodEnum<{
        ALL: "ALL";
        ACTIVE: "ACTIVE";
        INACTIVE: "INACTIVE";
    }>>;
    storeId: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type EmployeeInvite = z.infer<typeof EmployeeInviteSchema>;
export type UpdateEmployeeRole = z.infer<typeof UpdateEmployeeRoleSchema>;
export type EmployeePermission = z.infer<typeof EmployeePermissionSchema>;
export type EmployeeSearch = z.infer<typeof EmployeeSearchSchema>;
export declare const EmployeeActionLogSchema: z.ZodObject<{
    action: z.ZodEnum<{
        ROLE_CHANGED: "ROLE_CHANGED";
        INVITE_SENT: "INVITE_SENT";
        PERMISSIONS_UPDATED: "PERMISSIONS_UPDATED";
        DEACTIVATED: "DEACTIVATED";
        ACTIVATED: "ACTIVATED";
    }>;
    targetUserId: z.ZodString;
    storeId: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EmployeeActionLog = z.infer<typeof EmployeeActionLogSchema>;
//# sourceMappingURL=employeeSchemas.d.ts.map