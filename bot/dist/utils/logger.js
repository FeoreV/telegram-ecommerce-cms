"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'telegram-bot' },
    transports: [],
});
if (process.env.NODE_ENV !== 'production') {
    exports.logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }));
}
const logsDir = path_1.default.resolve(process.cwd(), 'logs');
try {
    if (!fs_1.default.existsSync(logsDir)) {
        fs_1.default.mkdirSync(logsDir, { recursive: true });
    }
}
catch (dirError) {
    console.error('Failed to create logs directory:', dirError);
}
try {
    const entries = fs_1.default.readdirSync(logsDir, { withFileTypes: true });
    for (const entry of entries) {
        const target = path_1.default.join(logsDir, entry.name);
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
catch (cleanupError) {
    console.warn('Failed to purge logs directory:', logsDir, cleanupError);
}
const errorFileTransport = new winston_1.default.transports.File({ filename: path_1.default.join(logsDir, 'bot-error.log'), level: 'error' });
const combinedFileTransport = new winston_1.default.transports.File({ filename: path_1.default.join(logsDir, 'bot-combined.log') });
errorFileTransport.on('error', (err) => {
    console.error('Winston error file transport error:', err);
});
combinedFileTransport.on('error', (err) => {
    console.error('Winston combined file transport error:', err);
});
exports.logger.add(errorFileTransport);
exports.logger.add(combinedFileTransport);
//# sourceMappingURL=logger.js.map