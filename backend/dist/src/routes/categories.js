"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const csrfProtection_1 = require("../middleware/csrfProtection");
const errorHandler_1 = require("../middleware/errorHandler");
const loggerEnhanced_1 = require("../utils/loggerEnhanced");
const router = express_1.default.Router();
router.get('/', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const categories = await prisma_1.prisma.category.findMany({
        include: {
            _count: {
                select: { products: true }
            }
        },
        orderBy: { name: 'asc' }
    });
    res.json(categories);
}));
router.get('/:id', auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const category = await prisma_1.prisma.category.findUnique({
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
router.post('/', (0, csrfProtection_1.csrfProtection)(), auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const category = await prisma_1.prisma.category.create({
        data: {
            name,
            slug,
        }
    });
    loggerEnhanced_1.logger.info('Category created', {
        categoryId: category.id,
        categoryName: category.name,
        userId: req.user?.id
    });
    res.status(201).json(category);
}));
router.put('/:id', (0, csrfProtection_1.csrfProtection)(), auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const updateData = {};
    if (name) {
        updateData.name = name;
        updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    const category = await prisma_1.prisma.category.update({
        where: { id },
        data: updateData
    });
    loggerEnhanced_1.logger.info('Category updated', {
        categoryId: category.id,
        categoryName: category.name,
        userId: req.user?.id
    });
    res.json(category);
}));
router.delete('/:id', (0, csrfProtection_1.csrfProtection)(), auth_1.authMiddleware, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const productsCount = await prisma_1.prisma.product.count({
        where: { categoryId: id }
    });
    if (productsCount > 0) {
        return res.status(400).json({
            error: 'Cannot delete category with existing products',
            productsCount
        });
    }
    await prisma_1.prisma.category.delete({
        where: { id }
    });
    loggerEnhanced_1.logger.info('Category deleted', {
        categoryId: id,
        userId: req.user?.id
    });
    res.json({ message: 'Category deleted successfully' });
}));
exports.default = router;
//# sourceMappingURL=categories.js.map