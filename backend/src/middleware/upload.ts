import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import { AppError } from './errorHandler';

// SECURITY: Helper function to safely resolve paths and prevent traversal
function safePathResolve(...paths: string[]): string {
  const resolved = path.resolve(...paths);
  const normalized = path.normalize(resolved);

  // Ensure no path traversal sequences remain
  if (normalized.includes('..')) {
    throw new Error('SECURITY: Path traversal detected in resolved path');
  }

  return normalized;
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/payment-proofs');
  },
  filename: (req, file, cb) => {
    // SECURITY FIX: Sanitize filename to prevent path traversal (CWE-22)
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension);

    // Remove any potentially dangerous characters
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9-_]/g, '_');

    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const secureFilename = `${sanitizedBasename}-${uniqueSuffix}${extension}`;

    // SECURITY FIX: Validate filename doesn't contain path separators
    if (secureFilename.includes('/') || secureFilename.includes('\\') || secureFilename.includes('..')) {
      const err: any = new Error('SECURITY: Invalid filename detected');
      return cb(err, secureFilename);
    }

    // SECURITY FIX: Validate final path is within upload directory (CWE-22/23 protection)
    try {
      const uploadDir = safePathResolve(process.cwd(), 'uploads/payment-proofs');
      const finalPath = safePathResolve(uploadDir, secureFilename);

      // Ensure the final path is within the upload directory
      if (!finalPath.startsWith(uploadDir + path.sep) && finalPath !== uploadDir) {
        const err: any = new Error('SECURITY: Path traversal attempt detected');
        return cb(err, secureFilename);
      }
    } catch (error: any) {
      return cb(error, secureFilename);
    }

    cb(null, secureFilename);
  }
});

// File filter to allow only specific file types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type ${file.mimetype} is not allowed. Please upload an image or PDF.`, 400));
  }
};

// Multer configuration
export const uploadPaymentProof = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  }
}).single('paymentProof');

// Memory storage for temporary processing (if needed)
export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
}).single('paymentProof');
