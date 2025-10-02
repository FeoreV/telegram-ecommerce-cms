import 'dotenv/config';
type EnvSchema = {
    PORT: number;
    NODE_ENV: 'development' | 'production' | 'test';
    DATABASE_URL: string;
    REDIS_URL?: string;
    FRONTEND_URL?: string;
    JWT_SECRET: string;
    MEDUSA_BASE_URL?: string;
    MEDUSA_WEBHOOK_TOKEN?: string;
    DEV_BYPASS_ROLES?: string;
    SUPER_ADMIN_TELEGRAM_ID?: string;
    CORS_WHITELIST?: string;
    TRUSTED_IPS?: string;
    JWT_EXPIRES_IN?: string;
    JWT_REFRESH_EXPIRES_IN?: string;
    LOG_LEVEL?: string;
    LOG_FILE_MAX_SIZE?: string;
    LOG_FILE_MAX_FILES?: string;
};
export declare const env: EnvSchema;
export {};
//# sourceMappingURL=env.d.ts.map