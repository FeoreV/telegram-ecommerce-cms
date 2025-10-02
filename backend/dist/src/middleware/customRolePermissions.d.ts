import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
export declare const requireCustomPermission: (permission: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function checkUserPermission(userId: string, storeId: string, permission: string): Promise<boolean>;
export declare function getUserPermissions(userId: string, storeId: string): Promise<string[]>;
export declare function getUserRole(userId: string, storeId: string): Promise<{
    type: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOM' | null;
    customRole?: {
        id: string;
        name: string;
        color: string;
        icon?: string;
    };
}>;
export declare const enrichUserWithPermissions: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
declare module 'express-serve-static-core' {
    interface Request {
        userPermissions?: string[];
        userRole?: {
            type: 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOM' | null;
            customRole?: {
                id: string;
                name: string;
                color: string;
                icon?: string;
            };
        };
    }
}
//# sourceMappingURL=customRolePermissions.d.ts.map