/**
 * Example Routes with Security Validation
 * Demonstrates how to use validation middleware in real routes
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  sanitizeBody,
  sanitizeQuery,
  validateEmailField,
  validateRequired,
  validateStringLength,
  validateIntegerField,
  validateEnum,
  validateArrayField,
  logValidatedRequest
} from '../middleware/inputValidation';
import { csrfProtection } from '../middleware/csrf';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * Example 1: User registration with validation
 * POST /api/examples/register
 */
router.post('/register',
  sanitizeBody,                                  // Sanitize all inputs
  validateRequired('name', 'email', 'password'), // Required fields
  validateEmailField('email'),                   // Validate email format
  validateStringLength('name', 2, 100),          // Name length
  validateStringLength('password', 8, 128),      // Password length
  logValidatedRequest,                           // Log for audit
  asyncHandler(async (req, res) => {
    // All inputs are now validated and sanitized
    const { name, email, password } = req.body;
    
    res.json({
      message: 'Registration validated',
      data: { name, email }
    });
  })
);

/**
 * Example 2: Product creation with validation
 * POST /api/examples/product
 */
router.post('/product',
  authMiddleware,                                // Require authentication
  csrfProtection(),                                // CSRF protection
  sanitizeBody,                                  // Sanitize inputs
  validateRequired('name', 'price', 'category'), // Required fields
  validateStringLength('name', 2, 200),          // Name length
  validateIntegerField('price', 0),              // Price must be positive
  validateEnum('category', ['electronics', 'clothing', 'food', 'other']), // Valid categories
  logValidatedRequest,
  asyncHandler(async (req, res) => {
    const { name, price, category, description } = req.body;
    
    res.json({
      message: 'Product validated',
      product: { name, price, category, description }
    });
  })
);

/**
 * Example 3: Batch update with array validation
 * POST /api/examples/batch-update
 */
router.post('/batch-update',
  authMiddleware,
  csrfProtection(),
  sanitizeBody,
  validateRequired('updates'),
  validateArrayField('updates', 100),  // Max 100 items
  logValidatedRequest,
  asyncHandler(async (req, res) => {
    const { updates } = req.body;
    
    // Validate each update item
    updates.forEach((update: any, index: number) => {
      if (!update.id) {
        throw new Error(`Missing ID at index ${index}`);
      }
    });
    
    res.json({
      message: 'Batch update validated',
      count: updates.length
    });
  })
);

/**
 * Example 4: Search with query sanitization
 * GET /api/examples/search?q=query&category=electronics&minPrice=100
 */
router.get('/search',
  sanitizeQuery,  // Sanitize query parameters
  asyncHandler(async (req, res) => {
    const { q, category, minPrice, maxPrice } = req.query;
    
    // All query params are now sanitized
    res.json({
      message: 'Search validated',
      params: {
        query: q,
        category,
        priceRange: { min: minPrice, max: maxPrice }
      }
    });
  })
);

/**
 * Example 5: File upload with validation
 * POST /api/examples/upload
 */
import { uploadPaymentProof, validateUploadedFile } from '../middleware/uploadPaymentProof';

router.post('/upload',
  authMiddleware,
  uploadPaymentProof.single('file'),  // Multer middleware
  validateUploadedFile,               // Validate file (magic bytes, size)
  logValidatedRequest,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    res.json({
      message: 'File validated and uploaded',
      file: {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  })
);

/**
 * Example 6: Review submission with rating validation
 * POST /api/examples/review
 */
router.post('/review',
  authMiddleware,
  csrfProtection(),
  sanitizeBody,
  validateRequired('productId', 'rating', 'comment'),
  validateIntegerField('rating', 1, 5),       // Rating 1-5
  validateStringLength('comment', 1, 1000),   // Comment max 1000 chars
  logValidatedRequest,
  asyncHandler(async (req, res) => {
    const { productId, rating, comment } = req.body;
    
    res.json({
      message: 'Review validated',
      review: { productId, rating, comment }
    });
  })
);

/**
 * Example 7: Settings update with enum validation
 * PUT /api/examples/settings
 */
router.put('/settings',
  authMiddleware,
  csrfProtection(),
  sanitizeBody,
  validateEnum('theme', ['light', 'dark', 'auto']),
  validateEnum('language', ['en', 'ru', 'uk']),
  logValidatedRequest,
  asyncHandler(async (req, res) => {
    const { theme, language, notifications } = req.body;
    
    res.json({
      message: 'Settings validated',
      settings: { theme, language, notifications }
    });
  })
);

/**
 * Export router
 * 
 * To use in your app:
 * import securityExampleRoutes from './routes/securityExampleRoutes';
 * app.use('/api/examples', securityExampleRoutes);
 */
export default router;

