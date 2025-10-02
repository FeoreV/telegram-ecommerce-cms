"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMapping = exports.upsertMapping = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
exports.upsertMapping = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { source, entityType, localId, externalId, storeId } = req.body;
    if (!req.user)
        throw new errorHandler_1.AppError('Authentication required', 401);
    if (!source || !entityType || !localId || !externalId) {
        throw new errorHandler_1.AppError('source, entityType, localId, externalId are required', 400);
    }
    if (req.user.role !== 'OWNER') {
        if (!storeId)
            throw new errorHandler_1.AppError('storeId required for non-owner', 400);
        const hasAccess = await prisma_1.prisma.store.findFirst({
            where: {
                id: storeId,
                OR: [
                    { ownerId: req.user.id },
                    { admins: { some: { userId: req.user.id } } }
                ]
            },
            select: { id: true },
        });
        if (!hasAccess)
            throw new errorHandler_1.AppError('No access to this store', 403);
    }
    const mapping = await prisma_1.prisma.integrationMapping.upsert({
        where: {
            source_entityType_localId: {
                source,
                entityType,
                localId,
            },
        },
        update: { externalId, storeId: storeId || null },
        create: { source, entityType, localId, externalId, storeId: storeId || null },
    });
    return res.status(201).json({ mapping });
});
exports.getMapping = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { source, entityType, externalId, localId } = req.query;
    if (!req.user)
        throw new errorHandler_1.AppError('Authentication required', 401);
    if (!source || !entityType || (!externalId && !localId)) {
        throw new errorHandler_1.AppError('source, entityType and (externalId or localId) required', 400);
    }
    const where = { source, entityType };
    if (externalId)
        where.externalId = externalId;
    if (localId)
        where.localId = localId;
    const mapping = await prisma_1.prisma.integrationMapping.findFirst({ where });
    if (!mapping)
        return res.status(404).json({ error: 'Mapping not found' });
    return res.json({ mapping });
});
//# sourceMappingURL=integrationController.js.map