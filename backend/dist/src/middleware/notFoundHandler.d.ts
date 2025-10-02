import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../utils/jwt';
interface NotFoundRequest extends Request {
    user?: {
        id: string;
        role: UserRole;
        telegramId: string;
    };
}
export declare const apiNotFoundHandler: (req: NotFoundRequest, res: Response, _next: NextFunction) => Response<any, Record<string, any>>;
export declare const secureNotFoundHandler: (req: NotFoundRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const notFoundMiddleware: (req: NotFoundRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export {};
//# sourceMappingURL=notFoundHandler.d.ts.map