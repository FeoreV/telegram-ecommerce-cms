import { Response } from 'express';
export declare const createBackup: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const listBackups: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const downloadBackup: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const restoreBackup: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const deleteBackup: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const getBackupStatus: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const scheduleBackups: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
declare const _default: {
    createBackup: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    listBackups: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    downloadBackup: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    restoreBackup: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    deleteBackup: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    getBackupStatus: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    scheduleBackups: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
};
export default _default;
//# sourceMappingURL=backupController.d.ts.map