import express from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrfProtection';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/loggerEnhanced';

const router = express.Router();

// Get all categories
router.get('/', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { products: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  res.json(categories);
}));

// Get category by ID
router.get('/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          store: true,
          variants: true
        }
      },
      _count: {
        select: { products: true }
      }
    }
  });

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json(category);
}));

// Create new category (SECURITY: CSRF protected)
router.post('/', csrfProtection, authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  // Generate slug from name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const category = await prisma.category.create({
    data: {
      name,
      slug,
    }
  });

  logger.info('Category created', {
    categoryId: category.id,
    categoryName: category.name,
    userId: req.user?.id
  });

  res.status(201).json(category);
}));

// Update category (SECURITY: CSRF protected)
router.put('/:id', csrfProtection, authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const { name } = req.body;

  const updateData: any = {};
  if (name) {
    updateData.name = name;
    updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  const category = await prisma.category.update({
    where: { id },
    data: updateData
  });

  logger.info('Category updated', {
    categoryId: category.id,
    categoryName: category.name,
    userId: req.user?.id
  });

  res.json(category);
}));

// Delete category (SECURITY: CSRF protected)
router.delete('/:id', csrfProtection, authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  // Check if category has products
  const productsCount = await prisma.product.count({
    where: { categoryId: id }
  });

  if (productsCount > 0) {
    return res.status(400).json({
      error: 'Cannot delete category with existing products',
      productsCount
    });
  }

  await prisma.category.delete({
    where: { id }
  });

  logger.info('Category deleted', {
    categoryId: id,
    userId: req.user?.id
  });

  res.json({ message: 'Category deleted successfully' });
}));

export default router;
