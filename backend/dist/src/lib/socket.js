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
                origin,
                methods: ['GET', 'POST'],
            },
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