import { Request, Response } from 'express';
export declare const telegramAuth: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const generateQRAuth: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const checkQRAuth: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const refreshToken: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const logout: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getProfile: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateProfile: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const generateDeepLink: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getActiveSessions: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const revokeSession: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const cleanupExpiredSessions: () => void;
export declare const promoteUser: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=authController.d.ts.map