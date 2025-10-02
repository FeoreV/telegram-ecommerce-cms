import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
export declare const getOrders: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const createOrder: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const confirmPayment: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const rejectOrder: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const getOrder: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const shipOrder: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const deliverOrder: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const cancelOrder: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const uploadOrderPaymentProof: (req: AuthenticatedRequest, res: Response) => Response<any, Record<string, any>>;
export declare const getPaymentProof: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const getOrderStats: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=orderController.d.ts.map