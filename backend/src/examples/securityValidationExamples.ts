/**
 * Security Validation Examples
 * Demonstrates how to use validation and sanitization utilities
 */

import { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { sanitizeHtml, sanitizePath, sanitizeUrl } from '../utils/sanitizer';
import {
    validateEmail,
    validateFileExtension,
    validateFileSize,
    validateInteger,
    validatePasswordStrength,
    validateUrl
} from '../utils/validator';

/**
 * Example 1: User Registration with Validation
 */
export async function registerUserExample(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name, website } = req.body;

    // 1. Validate email
    if (!validateEmail(email)) {
      throw new AppError('Invalid email format', 400);
    }

    // 2. Validate password strength
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      throw new AppError(`Weak password: ${passwordCheck.errors.join(', ')}`, 400);
    }

    // 3. Sanitize name to prevent XSS
    const safeName = sanitizeHtml(name);

    // 4. Validate and sanitize website URL (if provided)
    let safeWebsite = null;
    if (website) {
      if (!validateUrl(website)) {
        throw new AppError('Invalid website URL', 400);
      }
      safeWebsite = sanitizeUrl(website, ['example.com', 'trusted-domain.com']);
    }

    // Now safe to use: safeName, email, password (hashed), safeWebsite
    res.json({
      message: 'Validation passed',
      data: { email, name: safeName, website: safeWebsite }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Example 2: File Upload Validation
 */
export async function uploadFileExample(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;

    if (!file) {
      throw new AppError('No file provided', 400);
    }

    // 1. Validate file extension
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
    if (!validateFileExtension(file.originalname, allowedExtensions)) {
      throw new AppError(`Only ${allowedExtensions.join(', ')} files allowed`, 400);
    }

    // 2. Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (!validateFileSize(file.size, maxSize)) {
      throw new AppError('File too large (max 10MB)', 400);
    }

    // 3. Sanitize file path
    const uploadDir = 'uploads/secure';
    const safePath = sanitizePath(file.path, uploadDir);

    res.json({
      message: 'File validated successfully',
      filename: file.filename,
      size: file.size
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Example 3: Product Creation with Multiple Validations
 */
export async function createProductExample(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, price, imageUrl, category } = req.body;

    // 1. Sanitize text fields
    const safeName = sanitizeHtml(name);
    const safeDescription = sanitizeHtml(description);
    const safeCategory = sanitizeHtml(category);

    // 2. Validate price as positive integer
    const priceValidation = validateInteger(price, 0);
    if (!priceValidation.valid) {
      throw new AppError(`Invalid price: ${priceValidation.error}`, 400);
    }

    // 3. Validate image URL
    if (imageUrl) {
      if (!validateUrl(imageUrl)) {
        throw new AppError('Invalid image URL', 400);
      }

      // Only allow images from trusted CDN
      const allowedDomains = ['cdn.example.com', 'images.example.com'];
      const safeImageUrl = sanitizeUrl(imageUrl, allowedDomains);
    }

    res.json({
      message: 'Product validation passed',
      product: {
        name: safeName,
        description: safeDescription,
        price: priceValidation.value,
        category: safeCategory
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Example 4: Comment/Review Submission with XSS Prevention
 */
export async function submitReviewExample(req: Request, res: Response, next: NextFunction) {
  try {
    const { rating, comment, productId } = req.body;

    // 1. Validate rating (1-5)
    const ratingValidation = validateInteger(rating, 1, 5);
    if (!ratingValidation.valid) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }

    // 2. Sanitize comment (preserve basic formatting but prevent XSS)
    const safeComment = sanitizeHtml(comment);

    // 3. Validate comment length
    if (safeComment.length > 1000) {
      throw new AppError('Comment too long (max 1000 characters)', 400);
    }

    res.json({
      message: 'Review submitted',
      review: {
        rating: ratingValidation.value,
        comment: safeComment,
        productId
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Example 5: External API Integration with SSRF Prevention
 */
export async function fetchExternalDataExample(req: Request, res: Response, next: NextFunction) {
  try {
    const { apiUrl } = req.body;

    // 1. Validate URL format
    if (!validateUrl(apiUrl)) {
      throw new AppError('Invalid API URL', 400);
    }

    // 2. Sanitize URL and ensure it's from allowed domains
    const allowedDomains = ['api.partner.com', 'data.trusted-source.com'];
    const safeUrl = sanitizeUrl(apiUrl, allowedDomains);

    // 3. Now safe to make external request
    // const response = await fetch(safeUrl);

    res.json({
      message: 'URL validated',
      safeUrl
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Example 6: Batch Operations with Validation
 */
export async function batchUpdateExample(req: Request, res: Response, next: NextFunction) {
  try {
    const { updates } = req.body; // Array of updates

    if (!Array.isArray(updates)) {
      throw new AppError('Updates must be an array', 400);
    }

    // Limit batch size to prevent DoS
    if (updates.length > 100) {
      throw new AppError('Maximum 100 updates per batch', 400);
    }

    // Validate each update
    const validatedUpdates = updates.map((update, index) => {
      const { id, name, price } = update;

      // Validate ID
      if (!id || typeof id !== 'string') {
        throw new AppError(`Invalid ID at index ${index}`, 400);
      }

      // Sanitize name
      const safeName = sanitizeHtml(name);

      // Validate price
      const priceValidation = validateInteger(price, 0);
      if (!priceValidation.valid) {
        throw new AppError(`Invalid price at index ${index}: ${priceValidation.error}`, 400);
      }

      return {
        id,
        name: safeName,
        price: priceValidation.value
      };
    });

    res.json({
      message: 'Batch validated',
      count: validatedUpdates.length,
      updates: validatedUpdates
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Example 7: Search with Sanitization
 */
export async function searchExample(req: Request, res: Response, next: NextFunction) {
  try {
    const { query, category, minPrice, maxPrice } = req.query;

    // 1. Sanitize search query
    const safeQuery = typeof query === 'string' ? sanitizeHtml(query) : '';

    // 2. Sanitize category
    const safeCategory = typeof category === 'string' ? sanitizeHtml(category) : undefined;

    // 3. Validate price range
    const minPriceValidation = minPrice ? validateInteger(minPrice) : { valid: true, value: 0 };
    const maxPriceValidation = maxPrice ? validateInteger(maxPrice) : { valid: true, value: undefined };

    if (!minPriceValidation.valid) {
      throw new AppError('Invalid minimum price', 400);
    }

    if (!maxPriceValidation.valid) {
      throw new AppError('Invalid maximum price', 400);
    }

    res.json({
      message: 'Search validated',
      params: {
        query: safeQuery,
        category: safeCategory,
        minPrice: minPriceValidation.value,
        maxPrice: maxPriceValidation.value
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * How to use in your routes:
 *
 * import { registerUserExample, uploadFileExample } from '../examples/securityValidationExamples';
 *
 * router.post('/register', registerUserExample);
 * router.post('/upload', upload.single('file'), uploadFileExample);
 * router.post('/products', createProductExample);
 */

