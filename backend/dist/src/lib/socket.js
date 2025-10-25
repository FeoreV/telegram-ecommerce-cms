"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.getIO = getIO;
const socket_io_1 = require("socket.io");
const loggerEnhanced_1 = require("../utils/loggerEnhanced");
let ioInstance;
function initSocket(server, origin) {
    if (!ioInstance) {
        const allowedOrigins = Array.isArray(origin)
            ? origin.filter(Boolean)
            : (origin ? [origin] : []);
        ioInstance = new socket_io_1.Server(server, {
            cors: {
                origin: (requestOrigin, callback) => {
                    const effectiveOrigin = requestOrigin || 'none';
                    const isAllowed = allowedOrigins.length === 0
                        ? true
                        : allowedOrigins.some((allowed) => {
                            const a = String(allowed).replace(/\/$/, '');
                            const r = String(effectiveOrigin).replace(/\/$/, '');
                            return a.toLowerCase() === r.toLowerCase();
                        });
                    loggerEnhanced_1.logger.warn('Socket.IO CORS check', {
                        requestOrigin: effectiveOrigin,
                        allowedOrigins,
                        decision: isAllowed ? 'allow' : 'deny',
                    });
                    if (isAllowed)
                        return callback(null, true);
                    return callback(new Error('Origin not allowed by Socket.IO CORS'), false);
                },
                methods: ['GET', 'POST'],
                credentials: true,
                allowedHeaders: ['Authorization', 'Content-Type'],
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
            connectTimeout: 45000,
            allowEIO3: true,
            allowRequest: (req, callback) => {
                try {
                    const handshakeOrigin = req.headers?.origin || req.headers?.referer || 'none';
                    const ua = req.headers?.['user-agent'];
                    const host = req.headers?.host;
                    const url = req.url;
                    loggerEnhanced_1.logger.warn('Socket.IO handshake request', {
                        handshakeOrigin,
                        configuredCorsOrigin: allowedOrigins,
                        url,
                        host,
                        userAgent: ua,
                        connectionHeader: req.headers?.['connection'],
                        upgradeHeader: req.headers?.['upgrade'],
                    });
                }
                catch (e) {
                    loggerEnhanced_1.logger.error('Failed to log Socket.IO handshake request', { error: e.message });
                }
                callback(null, true);
            },
        });
        loggerEnhanced_1.logger.info('Socket.IO initialized', { configuredCorsOrigin: allowedOrigins, transports: ['websocket', 'polling'] });
    }
    return ioInstance;
}
function getIO() {
    if (!ioInstance) {
        throw new Error('Socket.IO not initialized. Call initSocket() first.');
    }
    return ioInstance;
}
//# sourceMappingURL=socket.js.map