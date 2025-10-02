import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let ioInstance: SocketServer | undefined;

export function initSocket(server: HttpServer, origin: string): SocketServer {
  if (!ioInstance) {
    ioInstance = new SocketServer(server, {
      cors: {
        origin,
        methods: ['GET', 'POST'],
      },
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


