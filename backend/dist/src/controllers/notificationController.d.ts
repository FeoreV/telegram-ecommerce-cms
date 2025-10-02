import { Response } from 'express';
export declare const getNotifications: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const markNotificationAsRead: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const markAllNotificationsAsRead: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const deleteNotification: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const getNotificationStats: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
declare const _default: {
    getNotifications: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    markNotificationAsRead: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    markAllNotificationsAsRead: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    deleteNotification: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    getNotificationStats: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
};
export default _default;
//# sourceMappingURL=notificationController.d.ts.map