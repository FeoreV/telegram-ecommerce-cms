"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSimpleAdminJS = void 0;
const AdminJSImport = async () => (await (eval('import("adminjs")'))).default;
const AdminJSExpressImport = async () => (await (eval('import("@adminjs/express")'))).default;
let Database;
let Resource;
const logger_1 = require("../utils/logger");
const prisma_1 = require("../lib/prisma");
const setupSimpleAdminJS = async (app) => {
    try {
        logger_1.logger.info('🚀 Setting up SIMPLE AdminJS...');
        const AdminJS = await AdminJSImport();
        const AdminJSExpress = await AdminJSExpressImport();
        try {
            const prismaAdapter = await (eval('import("@adminjs/prisma")'));
            Database = prismaAdapter.Database;
            Resource = prismaAdapter.Resource;
            AdminJS.registerAdapter({
                Database,
                Resource,
            });
        }
        catch (importError) {
            logger_1.logger.error('Failed to import @adminjs/prisma:', importError);
            throw new Error('AdminJS Prisma adapter not available');
        }
        logger_1.logger.info('✅ Adapter registered');
        const admin = new AdminJS({
            databases: [
                {
                    db: prisma_1.prisma,
                },
            ],
            rootPath: '/admin',
            branding: {
                companyName: 'Test Admin',
            },
        });
        logger_1.logger.info('✅ AdminJS instance created');
        const adminRouter = AdminJSExpress.buildRouter(admin);
        app.use(admin.options.rootPath, adminRouter);
        logger_1.logger.info(`✅ Simple AdminJS started on ${admin.options.rootPath}`);
        return admin;
    }
    catch (error) {
        logger_1.logger.error('❌ Simple AdminJS setup failed:', error);
        throw error;
    }
};
exports.setupSimpleAdminJS = setupSimpleAdminJS;
//# sourceMappingURL=simple-adminjs.js.map