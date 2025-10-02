import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';
import { AppError } from './errorHandler';
import { FileValidator } from '../utils/fileValidator';

// Secure upload directory outside of public/static serving area
const uploadDir = path.join(process.cwd(), 'storage', 'secure', 'payment-proofs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate secure filename
    const secureFilename = FileValidator.generateSecureFilename(file.originalname, 'payment_');
    cb(null, secureFilename);
  }
});

// Basic file filter - real validation happens after upload with magic byte check
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf'
  ];

  // Basic MIME type check - the real security validation happens post-upload
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
});

// Post-upload validation middleware with magic byte checking
export const validateUploadedFile = async (req: any, res: any, next: any) => {
  if (!req.file) {
    return next();
  }

  try {
    // Validate file using magic bytes
    const validation = await FileValidator.validatePaymentProof(
      await fs.promises.readFile(req.file.path),
      req.file.originalname
    );
    
    if (!validation.isValid) {
      // Delete the invalid file
      try {
        await fs.promises.unlink(req.file.path);
      } catch (error) {
        console.error('Failed to cleanup invalid uploaded file:', error);
      }
      
      return res.status(400).json({
        error: 'File validation failed',
        details: validation.error,
        detectedType: validation.detectedType,
        detectedMimeType: validation.detectedMimeType
      });
    }

    // Basic malware check
    const buffer = await fs.promises.readFile(req.file.path);
    const malwareCheck = await FileValidator.performBasicMalwareCheck(buffer);
    
    if (malwareCheck.isSuspicious) {
      // Delete suspicious file
      try {
        await fs.promises.unlink(req.file.path);
      } catch (error) {
        console.error('Failed to cleanup suspicious file:', error);
      }
      
      return res.status(400).json({
        error: 'File appears to be suspicious',
        details: malwareCheck.reasons.join(', ')
      });
    }

    // Attach validation info to request
    req.fileValidation = validation;
    next();
  } catch (error) {
    console.error('File validation error:', error);
    
    // Cleanup file on error
    try {
      if (req.file?.path) {
        await fs.promises.unlink(req.file.path);
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup file after validation error:', cleanupError);
    }
    
    res.status(500).json({ error: 'File validation failed' });
  }
};