"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUploadedFile = exports.uploadPaymentProof = void 0;
const multer_1 = __importDefault(require("multer"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const errorHandler_1 = require("./errorHandler");
const fileValidator_1 = require("../utils/fileValidator");
const uploadDir = path.join(process.cwd(), 'storage', 'secure', 'payment-proofs');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const secureFilename = fileValidator_1.FileValidator.generateSecureFilename(file.originalname, 'payment_');
        cb(null, secureFilename);
    }
});
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new errorHandler_1.AppError(`File type ${file.mimetype} is not allowed. Please upload an image or PDF.`, 400));
    }
};
exports.uploadPaymentProof = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    }
});
const validateUploadedFile = async (req, res, next) => {
    if (!req.file) {
        return next();
    }
    try {
        const validation = await fileValidator_1.FileValidator.validatePaymentProof(await fs.promises.readFile(req.file.path), req.file.originalname);
        if (!validation.isValid) {
            try {
                await fs.promises.unlink(req.file.path);
            }
            catch (error) {
                console.error('Failed to cleanup invalid uploaded file:', error);
            }
            return res.status(400).json({
                error: 'File validation failed',
                details: validation.error,
                detectedType: validation.detectedType,
                detectedMimeType: validation.detectedMimeType
            });
        }
        const buffer = await fs.promises.readFile(req.file.path);
        const malwareCheck = await fileValidator_1.FileValidator.performBasicMalwareCheck(buffer);
        if (malwareCheck.isSuspicious) {
            try {
                await fs.promises.unlink(req.file.path);
            }
            catch (error) {
                console.error('Failed to cleanup suspicious file:', error);
            }
            return res.status(400).json({
                error: 'File appears to be suspicious',
                details: malwareCheck.reasons.join(', ')
            });
        }
        req.fileValidation = validation;
        next();
    }
    catch (error) {
        console.error('File validation error:', error);
        try {
            if (req.file?.path) {
                await fs.promises.unlink(req.file.path);
            }
        }
        catch (cleanupError) {
            console.error('Failed to cleanup file after validation error:', cleanupError);
        }
        res.status(500).json({ error: 'File validation failed' });
    }
};
exports.validateUploadedFile = validateUploadedFile;
//# sourceMappingURL=uploadPaymentProof.js.map