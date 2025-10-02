import { Permission } from '../auth/RolePermissionManager';
export interface EmployeePermissionCheck {
    userId: string;
    storeId: string;
    permission: Permission;
}
export interface EmployeeStoreRole {
    userId: string;
    storeId: string;
    role: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOMER';
    permissions: Permission[];
    isActive: boolean;
}
export declare class EmployeePermissionService {
    static getUserStoreRole(userId: string, storeId: string): Promise<EmployeeStoreRole | null>;
    static checkPermission(check: EmployeePermissionCheck): Promise<boolean>;
    static getUserStores(userId: string): Promise<Array<{
        store: {
            id: string;
            name: string;
            description?: string;
        };
        role: string;
        permissions: Permission[];
        isActive: boolean;
    }>>;
    static updateVendorPermissions(userId: string, storeId: string, permissions: Permission[]): Promise<boolean>;
    static canManageUser(managerId: string, targetUserId: string, storeId: string): Promise<boolean>;
    static getStorePermissionStats(storeId: string): Promise<{
        totalEmployees: number;
        activeEmployees: number;
        adminCount: number;
        vendorCount: number;
        recentActivity: number;
    }>;
}
//# sourceMappingURL=employeePermissionService.d.ts.map