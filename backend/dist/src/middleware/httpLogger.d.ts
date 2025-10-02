import { Request, Response, NextFunction } from 'express';
export interface RequestWithTiming extends Request {
    startTime?: number;
    requestId?: string;
}
export declare const httpLogger: (req: RequestWithTiming, res: Response, next: NextFunction) => void;
export declare const requestIdLogger: (req: RequestWithTiming, res: Response, next: NextFunction) => void;
declare const _default: {
    httpLogger: (req: RequestWithTiming, res: Response, next: NextFunction) => void;
    requestIdLogger: (req: RequestWithTiming, res: Response, next: NextFunction) => void;
};
export default _default;
//# sourceMappingURL=httpLogger.d.ts.map