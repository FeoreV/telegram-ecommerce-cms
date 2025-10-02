"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectPrisma = exports.getPrisma = exports.databaseService = exports.DatabaseService = void 0;
const client_1 = require("@prisma/client");
const TLSService_1 = require("../services/TLSService");
const SecretManager_1 = require("../utils/SecretManager");
const logger_1 = require("../utils/logger");
class DatabaseService {
    constructor() {
        this.prisma = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000;
    }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    async initialize() {
        if (this.prisma) {
            return this.prisma;
        }
        try {
            const dbSecrets = SecretManager_1.secretManager.getDatabaseSecrets();
            TLSService_1.tlsService.getDatabaseTLSConfig();
            let connectionUrl = dbSecrets.url;
            if (TLSService_1.tlsService.isEnabled()) {
                const urlParams = new URLSearchParams();
                urlParams.set('sslmode', 'require');
                urlParams.set('sslcert', process.env.TLS_CLIENT_CERT_PATH || '/certs/backend.client.cert.pem');
                urlParams.set('sslkey', process.env.TLS_CLIENT_KEY_PATH || '/certs/backend.client.key.pem');
                urlParams.set('sslrootcert', process.env.TLS_CA_PATH || '/certs/ca.cert.pem');
                const separator = connectionUrl.includes('?') ? '&' : '?';
                connectionUrl += separator + urlParams.toString();
            }
            this.prisma = new client_1.PrismaClient({
                datasources: {
                    db: {
                        url: connectionUrl,
                    },
                },
                log: [
                    {
                        emit: 'event',
                        level: 'query',
                    },
                    {
                        emit: 'event',
                        level: 'error',
                    },
                    {
                        emit: 'event',
                        level: 'info',
                    },
                    {
                        emit: 'event',
                        level: 'warn',
                    },
                ],
            });
            this.prisma.$on('error', (e) => {
                logger_1.logger.error('Database error:', e);
            });
            this.prisma.$on('warn', (e) => {
                logger_1.logger.warn('Database warning:', e);
            });
            this.prisma.$on('info', (e) => {
                logger_1.logger.info('Database info:', e);
            });
            this.prisma.$on('query', (e) => {
                if (process.env.LOG_LEVEL === 'debug') {
                    logger_1.logger.debug('Database query:', {
                        query: e.query,
                        params: e.params,
                        duration: e.duration,
                    });
                }
            });
            await this.testConnection();
            logger_1.logger.info('Database service initialized successfully', {
                tlsEnabled: TLSService_1.tlsService.isEnabled(),
                connectionUrl: connectionUrl.replace(/password=[^&]+/g, 'password=***')
            });
            return this.prisma;
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize database service:', error);
            throw error;
        }
    }
    async testConnection() {
        if (!this.prisma) {
            throw new Error('Prisma client not initialized');
        }
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            logger_1.logger.info('Database connection test successful');
            this.reconnectAttempts = 0;
        }
        catch (error) {
            logger_1.logger.error('Database connection test failed:', error);
            throw error;
        }
    }
    async reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            throw new Error('Max reconnection attempts reached');
        }
        this.reconnectAttempts++;
        logger_1.logger.info(`Attempting database reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        try {
            await this.disconnect();
            await new Promise(resolve => setTimeout(resolve, this.reconnectInterval));
            await this.initialize();
            logger_1.logger.info('Database reconnection successful');
        }
        catch (error) {
            logger_1.logger.error(`Database reconnection attempt ${this.reconnectAttempts} failed:`, error);
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => this.reconnect(), this.reconnectInterval);
            }
            throw error;
        }
    }
    async disconnect() {
        if (this.prisma) {
            try {
                await this.prisma.$disconnect();
                this.prisma = null;
                logger_1.logger.info('Database disconnected successfully');
            }
            catch (error) {
                logger_1.logger.error('Error disconnecting from database:', error);
                throw error;
            }
        }
    }
    getPrisma() {
        if (!this.prisma) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.prisma;
    }
    async healthCheck() {
        if (!this.prisma) {
            return {
                status: 'disconnected',
                latency: -1,
                tlsEnabled: TLSService_1.tlsService.isEnabled(),
                connectionInfo: null
            };
        }
        try {
            const startTime = Date.now();
            const result = await this.prisma.$queryRaw `SELECT 
        version() as version,
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_addr,
        inet_server_port() as server_port,
        pg_is_in_recovery() as is_replica,
        CASE WHEN ssl_is_used() THEN 'SSL' ELSE 'No SSL' END as ssl_status
      `;
            const latency = Date.now() - startTime;
            return {
                status: 'connected',
                latency,
                tlsEnabled: TLSService_1.tlsService.isEnabled(),
                connectionInfo: result[0]
            };
        }
        catch (error) {
            logger_1.logger.error('Database health check failed:', error);
            return {
                status: 'error',
                latency: -1,
                tlsEnabled: TLSService_1.tlsService.isEnabled(),
                connectionInfo: { error: error instanceof Error ? error.message : 'Unknown error' }
            };
        }
    }
    async executeTransaction(fn, maxRetries = 3) {
        const prisma = this.getPrisma();
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await prisma.$transaction(fn);
            }
            catch (error) {
                logger_1.logger.warn(`Transaction attempt ${attempt} failed:`, error);
                if (attempt === maxRetries) {
                    logger_1.logger.error('Transaction failed after all retries:', error);
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
        }
        throw new Error('Transaction failed after all retries');
    }
    getConnectionStatus() {
        return {
            isConnected: !!this.prisma,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }
}
exports.DatabaseService = DatabaseService;
exports.databaseService = DatabaseService.getInstance();
const getPrisma = () => exports.databaseService.getPrisma();
exports.getPrisma = getPrisma;
const disconnectPrisma = () => exports.databaseService.disconnect();
exports.disconnectPrisma = disconnectPrisma;
//# sourceMappingURL=database.js.map