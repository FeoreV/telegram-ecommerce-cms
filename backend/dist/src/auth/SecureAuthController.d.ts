import { Request, Response } from 'express';
export declare const loginWithEmail: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const loginWithTelegram: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const refreshToken: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const logout: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getProfile: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateProfile: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const changePassword: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const setPassword: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const verifyToken: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const autoRefresh: (req: Request, res: Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=SecureAuthController.d.ts.map