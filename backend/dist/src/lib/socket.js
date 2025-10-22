"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.getIO = getIO;
const socket_io_1 = require("socket.io");
let ioInstance;
function initSocket(server, origin) {
    if (!ioInstance) {
        ioInstance = new socket_io_1.Server(server, {
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
function getIO() {
    if (!ioInstance) {
        throw new Error('Socket.IO not initialized. Call initSocket() first.');
    }
    return ioInstance;
}
//# sourceMappingURL=socket.js.map