"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
const notificationService_1 = require("../services/notificationService");
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, _next) => {
    let { statusCode = 500, message } = err;
    const reqLogger = req.logger || logger_1.logger;
    reqLogger.error({
        error: {
            message: err.message,
            stack: err.stack,
            statusCode,
        },
        request: {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
        },
    });
    if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
        setImmediate(async () => {
            try {
                await notificationService_1.NotificationService.notifySystemError(err.message, {
                    statusCode,
                    stack: err.stack,
                    method: req.method,
                    url: req.url,
                    userAgent: req.headers['user-agent'],
                    ip: req.ip,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (notificationError) {
                reqLogger.error('Failed to send system error notification:', notificationError);
            }
        });
    }
    if (err.name === 'PrismaClientKnownRequestError') {
        if (err.code === 'P2002') {
            statusCode = 409;
            message = 'Resource already exists';
        }
        else if (err.code === 'P2025') {
            statusCode = 404;
            message = 'Resource not found';
        }
    }
    if (err.name === 'ValidationError') {
        statusCode = 400;
    }
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Invalid or expired token';
    }
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map