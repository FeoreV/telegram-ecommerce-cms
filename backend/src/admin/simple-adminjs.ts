// Use dynamic import-compatible patterns to support ESM-only adminjs in CJS builds
// Avoid TS transforming import() under CommonJS by using eval
const AdminJSImport = async () => (await (eval('import("adminjs")'))).default;
const AdminJSExpressImport = async () => (await (eval('import("@adminjs/express")'))).default;
// Use dynamic import to bypass module resolution issues
import { Database as PrismaDatabase, Resource as PrismaResource } from '@adminjs/prisma';
let Database: typeof PrismaDatabase;
let Resource: typeof PrismaResource;
import { Express } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

export const setupSimpleAdminJS = async (app: Express) => {
  try {
    logger.info('🚀 Setting up SIMPLE AdminJS...');

    // Dynamically import admin modules first
    const AdminJS = await AdminJSImport();
    const AdminJSExpress = await AdminJSExpressImport();

    // Dynamically import Prisma adapter to bypass module resolution issues and ESM
    try {
      const prismaAdapter = await (eval('import("@adminjs/prisma")')) as { Database: typeof PrismaDatabase; Resource: typeof PrismaResource };
      Database = prismaAdapter.Database;
      Resource = prismaAdapter.Resource;

      // Register adapter
      AdminJS.registerAdapter({
        Database,
        Resource,
      });
    } catch (importError) {
      logger.error('Failed to import @adminjs/prisma:', importError);
      throw new Error('AdminJS Prisma adapter not available');
    }

    logger.info('✅ Adapter registered');

    // Minimal AdminJS configuration
    const admin = new AdminJS({
      databases: [
        {
          db: prisma,
        },
      ],
      rootPath: '/admin',
      branding: {
        companyName: 'Test Admin',
      },
    });

    logger.info('✅ AdminJS instance created');

    // Simple router without authentication
    const adminRouter = AdminJSExpress.buildRouter(admin);
    app.use(admin.options.rootPath, adminRouter);

    logger.info(`✅ Simple AdminJS started on ${admin.options.rootPath}`);
    
    return admin;
  } catch (error) {
    logger.error('❌ Simple AdminJS setup failed:', error);
    throw error;
  }
};
