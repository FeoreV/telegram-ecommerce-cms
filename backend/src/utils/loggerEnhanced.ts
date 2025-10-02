import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import path from 'path';
import { env } from './env';

// Log levels with priorities
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
} as const;

// Log categories for better organization
export enum LogCategory {
  SECURITY = 'security',
  AUTH = 'auth',
  DATABASE = 'database',
  API = 'api',
  SOCKET = 'socket',
  NOTIFICATION = 'notification',
  ORDER = 'order',
  PAYMENT = 'payment',
  SYSTEM = 'system',
  PERFORMANCE = 'performance',
  AUDIT = 'audit',
}

// Enhanced log metadata interface
export interface LogMetadata {
  category?: LogCategory;
  userId?: string;
  sessionId?: string;
  orderId?: string;
  storeId?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  statusCode?: number;
  requestId?: string;
  component?: string;
  action?: string;
  [key: string]: unknown;
}

// Helper function to convert error objects to LogMetadata
export function toLogMetadata(obj: unknown): LogMetadata {
  if (obj instanceof Error) {
    return {
      message: obj.message,
      name: obj.name,
      stack: obj.stack,
    };
  }
  if (typeof obj === 'object' && obj !== null) {
    return obj as LogMetadata;
  }
  return { value: obj };
}

// Sensitive data patterns to mask
const SENSITIVE_PATTERNS = {
  // JWT tokens
  jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
  // API keys
  apiKey: /^[a-f0-9]{32,}$/i,
  // Telegram bot tokens
  telegramToken: /^\d+:[A-Za-z0-9_-]{35}$/,
  // Credit card numbers
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  // Email addresses (partial masking)
  email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  // Phone numbers
  phone: /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g,
  // Authorization headers
  authorization: /^Bearer\s+(.+)$/i,
  // Passwords
  password: /password|pwd|secret/i
};

// Fields that should be completely removed or masked
const SENSITIVE_FIELDS = [
  'password', 'pwd', 'secret', 'token', 'apiKey', 'authorization',
  'refreshToken', 'accessToken', 'telegramBotToken', 'paymentToken',
  'cardNumber', 'cvv', 'ssn', 'socialSecurityNumber'
];

/**
 * Mask sensitive data in objects and strings
 */
export const maskSensitiveData = (data: unknown, depth = 0): unknown => {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (typeof data === 'string') {
    return maskSensitiveString(data);
  }

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(item => maskSensitiveData(item, depth + 1));
    }

    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field should be masked
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        masked[key] = maskValue(value);
      } else {
        masked[key] = maskSensitiveData(value, depth + 1);
      }
    }
    return masked;
  }

  return data;
};

/**
 * Mask sensitive strings
 */
const maskSensitiveString = (str: unknown): string => {
  // Ensure we have a string
  if (typeof str !== 'string') {
    return String(str);
  }
  
  let masked = str;

  try {
    // JWT tokens
    if (SENSITIVE_PATTERNS.jwt.test(str)) {
      const parts = str.split('.');
      return `${parts[0].substring(0, 4)}...${parts[2] ? '.' + parts[2].substring(0, 4) + '...' : ''}`;
    }

    // API keys
    if (SENSITIVE_PATTERNS.apiKey.test(str)) {
      return str.substring(0, 4) + '...' + str.substring(str.length - 4);
    }

    // Telegram bot tokens
    if (SENSITIVE_PATTERNS.telegramToken.test(str)) {
      const parts = str.split(':');
      return `${parts[0]}:${parts[1].substring(0, 4)}...`;
    }

    // Authorization headers
    const authMatch = str.match(SENSITIVE_PATTERNS.authorization);
    if (authMatch) {
      return `Bearer ${authMatch[1].substring(0, 4)}...`;
    }
  } catch (error) {
    // If any regex fails, just return the string as-is
    return String(str);
  }

  // Credit cards
  masked = masked.replace(SENSITIVE_PATTERNS.creditCard, (match) => {
    return match.substring(0, 4) + '****';
  });

  // Emails (partial masking)
  masked = masked.replace(SENSITIVE_PATTERNS.email, (match, user, domain) => {
    const maskedUser = user.length > 2 ? user.substring(0, 2) + '***' : user;
    return `${maskedUser}@${domain}`;
  });

  // Phone numbers
  masked = masked.replace(SENSITIVE_PATTERNS.phone, (match) => {
    return '***-***-' + match.substring(match.length - 4);
  });

  return masked;
};

/**
 * Mask a single value based on its type
 */
const maskValue = (value: unknown): string => {
  if (typeof value === 'string') {
    if (value.length <= 4) {
      return '***';
    }
    return value.substring(0, 2) + '***' + value.substring(value.length - 2);
  }
  return '[MASKED]';
};

// Utility function to serialize errors properly
export const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const errorWithExtras = error as Error & { 
      code?: string; 
      statusCode?: number; 
      details?: unknown; 
    };
    
    const serialized = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      ...(errorWithExtras.code && { code: errorWithExtras.code }),
      ...(errorWithExtras.statusCode && { statusCode: errorWithExtras.statusCode }),
      ...(errorWithExtras.details && { details: errorWithExtras.details }),
    };
    
    // Mask sensitive data in error details
    return maskSensitiveData(serialized) as Record<string, unknown>;
  }
  return { message: String(error) };
};

// Custom log format for production with data masking
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'label'],
  }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, metadata }: { timestamp: string; level: string; message: string; metadata?: unknown }) => {
    const base: Record<string, unknown> = {
      timestamp,
      level: level.toUpperCase(),
      message: maskSensitiveString(message),
      service: 'telegram-ecommerce-backend',
      environment: env.NODE_ENV,
    };
    
    if (typeof metadata === 'object' && metadata) {
      Object.assign(base, maskSensitiveData(metadata));
    }
    
    return JSON.stringify(base);
  })
);

// Custom log format for development with optional masking
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp'],
  }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, metadata }: { timestamp: string; level: string; message: string; metadata?: unknown }) => {
    const safeMetadata = typeof metadata === 'object' && metadata ? metadata : {};
    // In development, mask only highly sensitive data (tokens, passwords)
    const filteredMetadata = env.NODE_ENV === 'development' ? 
      maskSensitiveData(safeMetadata) : safeMetadata;
    const category = (filteredMetadata as { category?: string }).category ? `[${(filteredMetadata as { category: string }).category.toUpperCase()}]` : '';
    const metaStr = Object.keys(filteredMetadata as Record<string, unknown>).length > 0 ? 
      `\n${JSON.stringify(filteredMetadata, null, 2)}` : '';
    
    return `${timestamp} ${level} ${category} ${maskSensitiveString(message)}${metaStr}`;
  })
);

// Ensure logs directory exists
const logsDir = path.resolve(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (dirError) {
  console.error('Failed to create logs directory:', dirError);
}

// Remove existing log artifacts so each boot starts fresh
const purgeLogsDirectory = (directory: string) => {
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      try {
        if (entry.isDirectory()) {
          fs.rmSync(target, { recursive: true, force: true });
        } else {
          fs.unlinkSync(target);
        }
      } catch (entryError) {
        console.warn('Failed to remove log artifact:', target, entryError);
      }
    }
  } catch (purgeError) {
    console.warn('Failed to purge logs directory:', directory, purgeError);
  }
};

purgeLogsDirectory(logsDir);

// Configure transports based on environment
const createTransports = (): winston.transport[] => {
  const transports: winston.transport[] = [];

  // Console transport for development
  if (env.NODE_ENV !== 'production') {
    transports.push(
      new winston.transports.Console({
        level: 'debug',
        format: developmentFormat,
      })
    );
  }

  // File transports with rotation
  const fileTransportOptions = {
    dirname: logsDir,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: env.LOG_FILE_MAX_SIZE || '20m',
    maxFiles: env.LOG_FILE_MAX_FILES || '14d',
    format: productionFormat,
    auditFile: path.join(logsDir, 'audit.json'),
  };

  // Error logs
  transports.push(
    new DailyRotateFile({
      ...fileTransportOptions,
      filename: 'error-%DATE%.log',
      level: 'error',
    })
  );

  // Combined logs
  transports.push(
    new DailyRotateFile({
      ...fileTransportOptions,
      filename: 'combined-%DATE%.log',
    })
  );

  // HTTP/API logs
  transports.push(
    new DailyRotateFile({
      ...fileTransportOptions,
      filename: 'http-%DATE%.log',
      level: 'http',
    })
  );

  // Security logs (separate file for important events)
  transports.push(
    new DailyRotateFile({
      ...fileTransportOptions,
      filename: 'security-%DATE%.log',
      format: winston.format.combine(
        winston.format((info: winston.Logform.TransformableInfo) => {
          const metadata = info.metadata && typeof info.metadata === 'object' ? info.metadata as { category?: string } : {};
          return metadata.category === LogCategory.SECURITY ? info : false;
        })(),
        productionFormat
      ),
    })
  );

  // Audit logs
  transports.push(
    new DailyRotateFile({
      ...fileTransportOptions,
      filename: 'audit-%DATE%.log',
      format: winston.format.combine(
        winston.format((info: winston.Logform.TransformableInfo) => {
          const metadata = info.metadata && typeof info.metadata === 'object' ? info.metadata as { category?: string } : {};
          return metadata.category === LogCategory.AUDIT ? info : false;
        })(),
        productionFormat
      ),
    })
  );

  return transports;
};

// Create enhanced logger
class EnhancedLogger {
  private winston: winston.Logger;

  constructor(existingLogger?: winston.Logger, skipInitializationLog = false) {
    if (existingLogger) {
      this.winston = existingLogger;
    } else {
      this.winston = winston.createLogger({
        level: env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug'),
        levels: LOG_LEVELS,
        format: productionFormat,
        defaultMeta: {
          service: 'telegram-ecommerce-backend',
          environment: env.NODE_ENV,
          pid: process.pid,
        },
        transports: createTransports(),
        exitOnError: false,
      });

      // Handle transport errors gracefully
      this.winston.on('error', (error) => {
        console.error('Logger error:', error);
      });
    }

    if (!skipInitializationLog && !existingLogger) {
      this.info('Logger initialized successfully', {
        category: LogCategory.SYSTEM,
        level: this.winston.level,
        environment: env.NODE_ENV,
      });
    }
  }

  // Getter for winston instance
  get winstonInstance() {
    return this.winston;
  }

  // Core logging methods with enhanced metadata support
  error(message: string, metadata: LogMetadata = {}) {
    this.winston.error(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
  }

  warn(message: string, metadata: LogMetadata = {}) {
    this.winston.warn(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
  }

  info(message: string, metadata: LogMetadata = {}) {
    this.winston.info(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
  }

  http(message: string, metadata: LogMetadata = {}) {
    this.winston.http(message, { ...metadata, category: metadata.category || LogCategory.API });
  }

  debug(message: string, metadata: LogMetadata = {}) {
    this.winston.debug(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
  }

  verbose(message: string, metadata: LogMetadata = {}) {
    this.winston.verbose(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
  }

  // Specialized logging methods
  security(message: string, metadata: Omit<LogMetadata, 'category'> = {}) {
    this.winston.warn(message, { ...metadata, category: LogCategory.SECURITY });
  }

  auth(message: string, metadata: Omit<LogMetadata, 'category'> = {}) {
    this.winston.info(message, { ...metadata, category: LogCategory.AUTH });
  }

  audit(message: string, metadata: Omit<LogMetadata, 'category'> = {}) {
    this.winston.info(message, { ...metadata, category: LogCategory.AUDIT });
  }

  performance(message: string, metadata: Omit<LogMetadata, 'category'> = {}) {
    this.winston.info(message, { ...metadata, category: LogCategory.PERFORMANCE });
  }

  database(message: string, metadata: Omit<LogMetadata, 'category'> = {}) {
    this.winston.debug(message, { ...metadata, category: LogCategory.DATABASE });
  }

  socket(message: string, metadata: Omit<LogMetadata, 'category'> = {}) {
    this.winston.debug(message, { ...metadata, category: LogCategory.SOCKET });
  }

  order(message: string, metadata: Omit<LogMetadata, 'category'> = {}) {
    this.winston.info(message, { ...metadata, category: LogCategory.ORDER });
  }

  payment(message: string, metadata: Omit<LogMetadata, 'category'> = {}) {
    this.winston.info(message, { ...metadata, category: LogCategory.PAYMENT });
  }

  notification(message: string, metadata: Omit<LogMetadata, 'category'> = {}) {
    this.winston.debug(message, { ...metadata, category: LogCategory.NOTIFICATION });
  }

  // Error logging with automatic serialization
  logError(error: unknown, message = 'An error occurred', metadata: LogMetadata = {}) {
    const errorData = serializeError(error);
    this.error(message, {
      ...metadata,
      error: errorData,
    });
  }

  // Performance timing helper
  timer(label: string, metadata: LogMetadata = {}) {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.performance(`${label} completed`, {
          ...metadata,
          duration,
          label,
        });
        return duration;
      },
    };
  }

  // Request/Response logging
  logRequest(req: { method?: string; url?: string; ip?: string; userAgent?: string; get?: (header: string) => string | undefined; id?: string; [key: string]: unknown }, metadata: LogMetadata = {}) {
    this.http('Incoming request', {
      ...metadata,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get ? req.get('User-Agent') : req.userAgent,
      requestId: req.id,
    });
  }

  logResponse(req: { method?: string; url?: string; id?: string; [key: string]: unknown }, res: { statusCode?: number; [key: string]: unknown }, duration: number, metadata: LogMetadata = {}) {
    this.http('Request completed', {
      ...metadata,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      requestId: req.id,
    });
  }

  // Get logger statistics
  getStats() {
    return {
      level: this.winston.level,
      transports: this.winston.transports.length,
      environment: env.NODE_ENV,
      logsDirectory: logsDir,
    };
  }

  child(bindings: Record<string, unknown>) {
    const childLogger = this.winston.child(bindings);
    return new EnhancedLogger(childLogger, true);
  }
}

// Export singleton instance
export const logger = new EnhancedLogger();

// Export winston instance for advanced use cases
export const winstonLogger = logger.winstonInstance;

export default logger;
