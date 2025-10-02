import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
export declare const activityTracker: (action: string, getDetails?: (req: AuthenticatedRequest) => unknown) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const ActivityTrackers: {
    productCreated: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    productUpdated: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    productDeleted: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    orderViewed: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    orderUpdated: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    orderConfirmed: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    orderRejected: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    inventoryUpdated: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    employeeInvited: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    employeeRoleChanged: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    employeeRemoved: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    login: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    logout: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    settingsChanged: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    analyticsExported: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    reportGenerated: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
};
export declare const logLoginActivity: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=activityTracker.d.ts.map