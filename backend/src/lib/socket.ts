import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/loggerEnhanced';

let ioInstance: SocketServer | undefined;

export function initSocket(server: HttpServer, origin: string | string[]): SocketServer {
  if (!ioInstance) {
    // Normalize allowed origins into an array for strict matching
    const allowedOrigins = Array.isArray(origin)
      ? origin.filter(Boolean)
      : (origin ? [origin] : []);

    ioInstance = new SocketServer(server, {
      cors: {
        // Use a function to precisely allow matching origins and log decisions
        origin: (requestOrigin, callback) => {
          const effectiveOrigin = requestOrigin || 'none';
          const isAllowed =
            allowedOrigins.length === 0
              ? true // if not configured, allow (development fallback)
              : allowedOrigins.some((allowed) => {
                  // Exact match check; normalize trailing slashes
                  const a = String(allowed).replace(/\/$/, '');
                  const r = String(effectiveOrigin).replace(/\/$/, '');
                  return a.toLowerCase() === r.toLowerCase();
                });

          logger.warn('Socket.IO CORS check', {
            requestOrigin: effectiveOrigin,
            allowedOrigins,
            decision: isAllowed ? 'allow' : 'deny',
          });

          if (isAllowed) return callback(null, true);
          // Deny and surface a clear error to client
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
      // Instrumentation: log handshake details to diagnose xhr poll errors / proxy issues
      allowRequest: (req, callback) => {
        try {
          const handshakeOrigin = (req.headers?.origin as string) || (req.headers?.referer as string) || 'none';
          const ua = req.headers?.['user-agent'] as string | undefined;
          const host = req.headers?.host as string | undefined;
          const url = req.url;
          logger.warn('Socket.IO handshake request', {
            handshakeOrigin,
            configuredCorsOrigin: allowedOrigins,
            url,
            host,
            userAgent: ua,
            connectionHeader: req.headers?.['connection'],
            upgradeHeader: req.headers?.['upgrade'],
          });
        } catch (e) {
          logger.error('Failed to log Socket.IO handshake request', { error: (e as Error).message });
        }
        // Always allow; CORS enforcement happens via the CORS origin function above
        callback(null, true);
      },
    });
    logger.info('Socket.IO initialized', { configuredCorsOrigin: allowedOrigins, transports: ['websocket', 'polling'] });
  }
  return ioInstance;
}

export function getIO(): SocketServer {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized. Call initSocket() first.');
  }
  return ioInstance;
}


