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

function requireString(name: keyof EnvSchema, def?: string): string {
  const v = (process.env[name as string] ?? def) as string | undefined;
  if (!v || v.length === 0) throw new Error(`Missing env ${String(name)}`);
  return v;
}

function optionalString(name: keyof EnvSchema): string | undefined {
  const v = process.env[name as string];
  return v && v.length > 0 ? v : undefined;
}

function requireNumber(name: keyof EnvSchema, def?: number): number {
  const raw = process.env[name as string];
  const v = raw ? Number(raw) : def;
  if (!Number.isFinite(v)) throw new Error(`Invalid number env ${String(name)}`);
  return v as number;
}

export const env: EnvSchema = {
  PORT: requireNumber('PORT', 3001),
  NODE_ENV: (process.env.NODE_ENV as EnvSchema['NODE_ENV']) || 'development',
  DATABASE_URL: requireString('DATABASE_URL'),
  REDIS_URL: optionalString('REDIS_URL'),
  FRONTEND_URL: optionalString('FRONTEND_URL'),
  JWT_SECRET: requireString('JWT_SECRET', 'change-me'),
  MEDUSA_BASE_URL: optionalString('MEDUSA_BASE_URL'),
  MEDUSA_WEBHOOK_TOKEN: optionalString('MEDUSA_WEBHOOK_TOKEN'),
  DEV_BYPASS_ROLES: optionalString('DEV_BYPASS_ROLES'),
  SUPER_ADMIN_TELEGRAM_ID: optionalString('SUPER_ADMIN_TELEGRAM_ID'),
  CORS_WHITELIST: optionalString('CORS_WHITELIST'),
  TRUSTED_IPS: optionalString('TRUSTED_IPS'),
  JWT_EXPIRES_IN: optionalString('JWT_EXPIRES_IN'),
  JWT_REFRESH_EXPIRES_IN: optionalString('JWT_REFRESH_EXPIRES_IN'),
  LOG_LEVEL: optionalString('LOG_LEVEL'),
  LOG_FILE_MAX_SIZE: optionalString('LOG_FILE_MAX_SIZE'),
  LOG_FILE_MAX_FILES: optionalString('LOG_FILE_MAX_FILES'),
};


