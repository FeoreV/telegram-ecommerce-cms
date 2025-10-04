"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMemory = exports.uploadPaymentProof = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("./errorHandler");
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/payment-proofs');
    },
    filename: (req, file, cb) => {
        const extension = path_1.default.extname(file.originalname);
        const basename = path_1.default.basename(file.originalname, extension);
        const sanitizedBasename = basename.replace(/[^a-zA-Z0-9-_]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const secureFilename = `${sanitizedBasename}-${uniqueSuffix}${extension}`;
        if (secureFilename.includes('/') || secureFilename.includes('\\') || secureFilename.includes('..')) {
            const err = new Error('SECURITY: Invalid filename detected');
            return cb(err, secureFilename);
        }
        const uploadDir = path_1.default.resolve(process.cwd(), 'uploads/payment-proofs');
        const finalPath = path_1.default.resolve(uploadDir, secureFilename);
        if (!finalPath.startsWith(uploadDir)) {
            const err = new Error('SECURITY: Path traversal attempt detected');
            return cb(err, secureFilename);
        }
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
}).single('paymentProof');
exports.uploadMemory = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    }
}).single('paymentProof');
//# sourceMappingURL=upload.js.map