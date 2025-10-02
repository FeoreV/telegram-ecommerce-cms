import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../utils/jwt';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        telegramId: string;
        role: UserRole;
        username?: string;
        firstName?: string;
        lastName?: string;
    };
}
export declare const authMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const requireRole: (roles: UserRole[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const requireStoreAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=auth.d.ts.map