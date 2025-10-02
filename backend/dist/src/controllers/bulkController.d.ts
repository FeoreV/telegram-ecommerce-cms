import { Response } from 'express';
import multer from 'multer';
export declare const upload: multer.Multer;
export declare const importProducts: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const exportProducts: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const bulkUpdateProducts: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const bulkDeleteProducts: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
export declare const getBulkTemplate: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
declare const _default: {
    upload: multer.Multer;
    importProducts: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    exportProducts: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    bulkUpdateProducts: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    bulkDeleteProducts: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
    getBulkTemplate: (req: import("express").Request, res: Response, next: import("express").NextFunction) => void;
};
export default _default;
//# sourceMappingURL=bulkController.d.ts.map