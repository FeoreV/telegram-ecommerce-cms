"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.winstonLogger = exports.logger = exports.serializeError = exports.maskSensitiveData = exports.LogCategory = exports.LOG_LEVELS = void 0;
exports.toLogMetadata = toLogMetadata;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./env");
exports.LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
};
var LogCategory;
(function (LogCategory) {
    LogCategory["SECURITY"] = "security";
    LogCategory["AUTH"] = "auth";
    LogCategory["DATABASE"] = "database";
    LogCategory["API"] = "api";
    LogCategory["SOCKET"] = "socket";
    LogCategory["NOTIFICATION"] = "notification";
    LogCategory["ORDER"] = "order";
    LogCategory["PAYMENT"] = "payment";
    LogCategory["SYSTEM"] = "system";
    LogCategory["PERFORMANCE"] = "performance";
    LogCategory["AUDIT"] = "audit";
})(LogCategory || (exports.LogCategory = LogCategory = {}));
function toLogMetadata(obj) {
    if (obj instanceof Error) {
        return {
            message: obj.message,
            name: obj.name,
            stack: obj.stack,
        };
    }
    if (typeof obj === 'object' && obj !== null) {
        return obj;
    }
    return { value: obj };
}
const SENSITIVE_PATTERNS = {
    jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
    apiKey: /^[a-f0-9]{32,}$/i,
    telegramToken: /^\d+:[A-Za-z0-9_-]{35}$/,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    email: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    phone: /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g,
    authorization: /^Bearer\s+(.+)$/i,
    password: /password|pwd|secret/i
};
const SENSITIVE_FIELDS = [
    'password', 'pwd', 'secret', 'token', 'apiKey', 'authorization',
    'refreshToken', 'accessToken', 'telegramBotToken', 'paymentToken',
    'cardNumber', 'cvv', 'ssn', 'socialSecurityNumber'
];
const maskSensitiveData = (data, depth = 0) => {
    if (depth > 10) {
        return '[MAX_DEPTH_REACHED]';
    }
    if (typeof data === 'string') {
        return maskSensitiveString(data);
    }
    if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data)) {
            return data.map(item => (0, exports.maskSensitiveData)(item, depth + 1));
        }
        const masked = {};
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
                masked[key] = maskValue(value);
            }
            else {
                masked[key] = (0, exports.maskSensitiveData)(value, depth + 1);
            }
        }
        return masked;
    }
    return data;
};
exports.maskSensitiveData = maskSensitiveData;
const maskSensitiveString = (str) => {
    if (typeof str !== 'string') {
        return String(str);
    }
    let masked = str;
    try {
        if (SENSITIVE_PATTERNS.jwt.test(str)) {
            const parts = str.split('.');
            return `${parts[0].substring(0, 4)}...${parts[2] ? '.' + parts[2].substring(0, 4) + '...' : ''}`;
        }
        if (SENSITIVE_PATTERNS.apiKey.test(str)) {
            return str.substring(0, 4) + '...' + str.substring(str.length - 4);
        }
        if (SENSITIVE_PATTERNS.telegramToken.test(str)) {
            const parts = str.split(':');
            return `${parts[0]}:${parts[1].substring(0, 4)}...`;
        }
        const authMatch = str.match(SENSITIVE_PATTERNS.authorization);
        if (authMatch) {
            return `Bearer ${authMatch[1].substring(0, 4)}...`;
        }
    }
    catch (error) {
        return String(str);
    }
    masked = masked.replace(SENSITIVE_PATTERNS.creditCard, (match) => {
        return match.substring(0, 4) + '****';
    });
    masked = masked.replace(SENSITIVE_PATTERNS.email, (match, user, domain) => {
        const maskedUser = user.length > 2 ? user.substring(0, 2) + '***' : user;
        return `${maskedUser}@${domain}`;
    });
    masked = masked.replace(SENSITIVE_PATTERNS.phone, (match) => {
        return '***-***-' + match.substring(match.length - 4);
    });
    return masked;
};
const maskValue = (value) => {
    if (typeof value === 'string') {
        if (value.length <= 4) {
            return '***';
        }
        return value.substring(0, 2) + '***' + value.substring(value.length - 2);
    }
    return '[MASKED]';
};
const serializeError = (error) => {
    if (error instanceof Error) {
        const errorWithExtras = error;
        const serialized = {
            message: error.message,
            name: error.name,
            stack: error.stack,
            ...(errorWithExtras.code && { code: errorWithExtras.code }),
            ...(errorWithExtras.statusCode && { statusCode: errorWithExtras.statusCode }),
            ...(errorWithExtras.details && { details: errorWithExtras.details }),
        };
        return (0, exports.maskSensitiveData)(serialized);
    }
    return { message: String(error) };
};
exports.serializeError = serializeError;
const productionFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'label'],
}), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, metadata }) => {
    const base = {
        timestamp,
        level: level.toUpperCase(),
        message: maskSensitiveString(message),
        service: 'telegram-ecommerce-backend',
        environment: env_1.env.NODE_ENV,
    };
    if (typeof metadata === 'object' && metadata) {
        Object.assign(base, (0, exports.maskSensitiveData)(metadata));
    }
    return JSON.stringify(base);
}));
const developmentFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.metadata({
    fillExcept: ['message', 'level', 'timestamp'],
}), winston_1.default.format.colorize(), winston_1.default.format.printf(({ timestamp, level, message, metadata }) => {
    const safeMetadata = typeof metadata === 'object' && metadata ? metadata : {};
    const filteredMetadata = env_1.env.NODE_ENV === 'development' ?
        (0, exports.maskSensitiveData)(safeMetadata) : safeMetadata;
    const category = filteredMetadata.category ? `[${filteredMetadata.category.toUpperCase()}]` : '';
    const metaStr = Object.keys(filteredMetadata).length > 0 ?
        `\n${JSON.stringify(filteredMetadata, null, 2)}` : '';
    return `${timestamp} ${level} ${category} ${maskSensitiveString(message)}${metaStr}`;
}));
const logsDir = path_1.default.resolve(process.cwd(), 'logs');
try {
    if (!fs_1.default.existsSync(logsDir)) {
        fs_1.default.mkdirSync(logsDir, { recursive: true });
    }
}
catch (dirError) {
    console.error('Failed to create logs directory:', dirError);
}
const purgeLogsDirectory = (directory) => {
    try {
        const entries = fs_1.default.readdirSync(directory, { withFileTypes: true });
        for (const entry of entries) {
            const target = path_1.default.join(directory, entry.name);
            try {
                if (entry.isDirectory()) {
                    fs_1.default.rmSync(target, { recursive: true, force: true });
                }
                else {
                    fs_1.default.unlinkSync(target);
                }
            }
            catch (entryError) {
                console.warn('Failed to remove log artifact:', target, entryError);
            }
        }
    }
    catch (purgeError) {
        console.warn('Failed to purge logs directory:', directory, purgeError);
    }
};
purgeLogsDirectory(logsDir);
const createTransports = () => {
    const transports = [];
    if (env_1.env.NODE_ENV !== 'production') {
        transports.push(new winston_1.default.transports.Console({
            level: 'debug',
            format: developmentFormat,
        }));
    }
    const fileTransportOptions = {
        dirname: logsDir,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: env_1.env.LOG_FILE_MAX_SIZE || '20m',
        maxFiles: env_1.env.LOG_FILE_MAX_FILES || '14d',
        format: productionFormat,
        auditFile: path_1.default.join(logsDir, 'audit.json'),
    };
    transports.push(new winston_daily_rotate_file_1.default({
        ...fileTransportOptions,
        filename: 'error-%DATE%.log',
        level: 'error',
    }));
    transports.push(new winston_daily_rotate_file_1.default({
        ...fileTransportOptions,
        filename: 'combined-%DATE%.log',
    }));
    transports.push(new winston_daily_rotate_file_1.default({
        ...fileTransportOptions,
        filename: 'http-%DATE%.log',
        level: 'http',
    }));
    transports.push(new winston_daily_rotate_file_1.default({
        ...fileTransportOptions,
        filename: 'security-%DATE%.log',
        format: winston_1.default.format.combine(winston_1.default.format((info) => {
            const metadata = info.metadata && typeof info.metadata === 'object' ? info.metadata : {};
            return metadata.category === LogCategory.SECURITY ? info : false;
        })(), productionFormat),
    }));
    transports.push(new winston_daily_rotate_file_1.default({
        ...fileTransportOptions,
        filename: 'audit-%DATE%.log',
        format: winston_1.default.format.combine(winston_1.default.format((info) => {
            const metadata = info.metadata && typeof info.metadata === 'object' ? info.metadata : {};
            return metadata.category === LogCategory.AUDIT ? info : false;
        })(), productionFormat),
    }));
    return transports;
};
class EnhancedLogger {
    constructor(existingLogger, skipInitializationLog = false) {
        if (existingLogger) {
            this.winston = existingLogger;
        }
        else {
            this.winston = winston_1.default.createLogger({
                level: env_1.env.LOG_LEVEL || (env_1.env.NODE_ENV === 'production' ? 'info' : 'debug'),
                levels: exports.LOG_LEVELS,
                format: productionFormat,
                defaultMeta: {
                    service: 'telegram-ecommerce-backend',
                    environment: env_1.env.NODE_ENV,
                    pid: process.pid,
                },
                transports: createTransports(),
                exitOnError: false,
            });
            this.winston.on('error', (error) => {
                console.error('Logger error:', error);
            });
        }
        if (!skipInitializationLog && !existingLogger) {
            this.info('Logger initialized successfully', {
                category: LogCategory.SYSTEM,
                level: this.winston.level,
                environment: env_1.env.NODE_ENV,
            });
        }
    }
    get winstonInstance() {
        return this.winston;
    }
    error(message, metadata = {}) {
        this.winston.error(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
    }
    warn(message, metadata = {}) {
        this.winston.warn(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
    }
    info(message, metadata = {}) {
        this.winston.info(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
    }
    http(message, metadata = {}) {
        this.winston.http(message, { ...metadata, category: metadata.category || LogCategory.API });
    }
    debug(message, metadata = {}) {
        this.winston.debug(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
    }
    verbose(message, metadata = {}) {
        this.winston.verbose(message, { ...metadata, category: metadata.category || LogCategory.SYSTEM });
    }
    security(message, metadata = {}) {
        this.winston.warn(message, { ...metadata, category: LogCategory.SECURITY });
    }
    auth(message, metadata = {}) {
        this.winston.info(message, { ...metadata, category: LogCategory.AUTH });
    }
    audit(message, metadata = {}) {
        this.winston.info(message, { ...metadata, category: LogCategory.AUDIT });
    }
    performance(message, metadata = {}) {
        this.winston.info(message, { ...metadata, category: LogCategory.PERFORMANCE });
    }
    database(message, metadata = {}) {
        this.winston.debug(message, { ...metadata, category: LogCategory.DATABASE });
    }
    socket(message, metadata = {}) {
        this.winston.debug(message, { ...metadata, category: LogCategory.SOCKET });
    }
    order(message, metadata = {}) {
        this.winston.info(message, { ...metadata, category: LogCategory.ORDER });
    }
    payment(message, metadata = {}) {
        this.winston.info(message, { ...metadata, category: LogCategory.PAYMENT });
    }
    notification(message, metadata = {}) {
        this.winston.debug(message, { ...metadata, category: LogCategory.NOTIFICATION });
    }
    logError(error, message = 'An error occurred', metadata = {}) {
        const errorData = (0, exports.serializeError)(error);
        this.error(message, {
            ...metadata,
            error: errorData,
        });
    }
    timer(label, metadata = {}) {
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
    logRequest(req, metadata = {}) {
        this.http('Incoming request', {
            ...metadata,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get ? req.get('User-Agent') : req.userAgent,
            requestId: req.id,
        });
    }
    logResponse(req, res, duration, metadata = {}) {
        this.http('Request completed', {
            ...metadata,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            requestId: req.id,
        });
    }
    getStats() {
        return {
            level: this.winston.level,
            transports: this.winston.transports.length,
            environment: env_1.env.NODE_ENV,
            logsDirectory: logsDir,
        };
    }
    child(bindings) {
        const childLogger = this.winston.child(bindings);
        return new EnhancedLogger(childLogger, true);
    }
}
exports.logger = new EnhancedLogger();
exports.winstonLogger = exports.logger.winstonInstance;
exports.default = exports.logger;
//# sourceMappingURL=loggerEnhanced.js.map