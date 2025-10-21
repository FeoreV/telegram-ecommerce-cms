import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let ioInstance: SocketServer | undefined;

export function initSocket(server: HttpServer, origin: string): SocketServer {
  if (!ioInstance) {
    ioInstance = new SocketServer(server, {
      cors: {
        origin: origin || '*',
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Authorization', 'Content-Type'],
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 45000,
      allowEIO3: true,
    });
  }
  return ioInstance;
}

export function getIO(): SocketServer {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized. Call initSocket() first.');
  }
  return ioInstance;
}


