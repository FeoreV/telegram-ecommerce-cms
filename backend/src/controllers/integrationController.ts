import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';

interface IntegrationMappingUniqueInput {
  source: 'MEDUSA';
  entityType: 'STORE' | 'PRODUCT' | 'VARIANT' | 'ORDER';
  localId: string;
}

interface UpsertMappingBody {
  source: 'MEDUSA';
  entityType: 'STORE' | 'PRODUCT' | 'VARIANT' | 'ORDER';
  localId: string;
  externalId: string;
  storeId?: string;
}

interface GetMappingQuery {
  source: 'MEDUSA';
  entityType: 'STORE' | 'PRODUCT' | 'VARIANT' | 'ORDER';
  externalId?: string;
  localId?: string;
}

export const upsertMapping = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { source, entityType, localId, externalId, storeId } = req.body as UpsertMappingBody;

  if (!req.user) throw new AppError('Authentication required', 401);
  if (!source || !entityType || !localId || !externalId) {
    throw new AppError('source, entityType, localId, externalId are required', 400);
  }

  // RBAC: only OWNER globally, or ADMIN of the store (if store-scoped)
  if (req.user.role !== 'OWNER') {
    if (!storeId) throw new AppError('storeId required for non-owner', 400);
    const hasAccess = await prisma.store.findFirst({
      where: {
        id: storeId,
        OR: [
          { ownerId: req.user.id },
          { admins: { some: { userId: req.user.id } } }
        ]
      },
      select: { id: true },
    });
    if (!hasAccess) throw new AppError('No access to this store', 403);
  }

  const mapping = await prisma.integrationMapping.upsert({
    where: {
      source_entityType_localId: {
        source,
        entityType,
        localId,
      } as IntegrationMappingUniqueInput,
    },
    update: { externalId, storeId: storeId || null },
    create: { source, entityType, localId, externalId, storeId: storeId || null },
  });

  return res.status(201).json({ mapping });
});

export const getMapping = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { source, entityType, externalId, localId } = req.query as unknown as GetMappingQuery;

  if (!req.user) throw new AppError('Authentication required', 401);
  if (!source || !entityType || (!externalId && !localId)) {
    throw new AppError('source, entityType and (externalId or localId) required', 400);
  }

  const where: Prisma.IntegrationMappingWhereInput = { source, entityType };
  if (externalId) where.externalId = externalId;
  if (localId) where.localId = localId;

  const mapping = await prisma.integrationMapping.findFirst({ where });
  if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
  return res.json({ mapping });
});


