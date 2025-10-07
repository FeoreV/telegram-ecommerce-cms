"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketRoomService = void 0;
const prisma_1 = require("../lib/prisma");
const socket_1 = require("../lib/socket");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
class SocketRoomService {
    static async joinUserToRooms(socket) {
        if (!socket.user) {
            logger_1.logger.error('Socket user not authenticated');
            return;
        }
        const { id: userId, role } = socket.user;
        try {
            const userRoom = `user_${userId}`;
            socket.join(userRoom);
            logger_1.logger.info(`User ${userId} joined room: ${userRoom}`);
            switch (role) {
                case 'OWNER': {
                    const ownerAdminRoom = `admin_${userId}`;
                    socket.join(ownerAdminRoom);
                    socket.join('admins');
                    socket.join('owners');
                    const allStores = await prisma_1.prisma.store.findMany({
                        select: { id: true }
                    });
                    for (const store of allStores) {
                        socket.join(`store_${store.id}`);
                    }
                    logger_1.logger.info(`OWNER ${userId} joined admin rooms and ${allStores.length} store rooms`);
                    break;
                }
                case 'ADMIN': {
                    const adminRoom = `admin_${userId}`;
                    socket.join(adminRoom);
                    socket.join('admins');
                    const adminStores = await prisma_1.prisma.store.findMany({
                        where: {
                            OR: [
                                { ownerId: userId },
                                { admins: { some: { userId } } }
                            ]
                        },
                        select: { id: true, name: true }
                    });
                    for (const store of adminStores) {
                        socket.join(`store_${store.id}`);
                    }
                    logger_1.logger.info(`ADMIN ${userId} joined admin room and ${adminStores.length} store rooms`);
                    break;
                }
                case 'VENDOR': {
                    const vendorStores = await prisma_1.prisma.store.findMany({
                        where: {
                            OR: [
                                { ownerId: userId },
                                { admins: { some: { userId } } }
                            ]
                        },
                        select: { id: true, name: true }
                    });
                    for (const store of vendorStores) {
                        socket.join(`store_${store.id}`);
                    }
                    logger_1.logger.info(`VENDOR ${userId} joined ${vendorStores.length} store rooms`);
                    break;
                }
                case 'CUSTOMER':
                    logger_1.logger.info(`CUSTOMER ${userId} joined personal room only`);
                    break;
                default:
                    logger_1.logger.warn(`Unknown role ${(0, sanitizer_1.sanitizeForLog)(role)} for user ${(0, sanitizer_1.sanitizeForLog)(userId)}`);
            }
            socket.emit('rooms_joined', {
                userId,
                role,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger_1.logger.error(`Error joining user ${(0, sanitizer_1.sanitizeForLog)(userId)} to rooms:`, (0, logger_1.toLogMetadata)(error));
            socket.emit('room_join_error', {
                error: 'Failed to join rooms',
                timestamp: new Date().toISOString()
            });
        }
    }
    static leaveUserFromRooms(socket) {
        if (!socket.user) {
            return;
        }
        const { id: userId, role } = socket.user;
        logger_1.logger.info(`User ${userId} (${role}) disconnected from socket ${socket.id}`);
    }
    static broadcastToRoom(room, event, data) {
        try {
            const io = (0, socket_1.getIO)();
            io.to(room).emit(event, {
                ...data,
                timestamp: new Date().toISOString()
            });
            logger_1.logger.info(`Broadcasted ${event} to room ${room}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to broadcast to room ${(0, sanitizer_1.sanitizeForLog)(room)}:`, (0, logger_1.toLogMetadata)(error));
        }
    }
    static notifyUser(userId, event, data) {
        this.broadcastToRoom(`user_${userId}`, event, data);
    }
    static notifyAdmins(event, data) {
        this.broadcastToRoom('admins', event, data);
    }
    static notifyOwners(event, data) {
        this.broadcastToRoom('owners', event, data);
    }
    static notifyStore(storeId, event, data) {
        this.broadcastToRoom(`store_${storeId}`, event, data);
    }
    static notifyOrderUpdate(orderId, storeId, event, data) {
        this.notifyAdmins(event, { ...data, orderId, storeId });
        this.notifyStore(storeId, event, { ...data, orderId });
        if (data.customerId) {
            this.notifyUser(data.customerId, event, { ...data, orderId, storeId });
        }
    }
    static async getRoomInfo(room) {
        try {
            const io = (0, socket_1.getIO)();
            const sockets = await io.in(room).fetchSockets();
            return {
                memberCount: sockets.length,
                members: sockets.map(s => s.userId || s.id)
            };
        }
        catch (error) {
            logger_1.logger.error(`Failed to get room info for ${(0, sanitizer_1.sanitizeForLog)(room)}:`, (0, logger_1.toLogMetadata)(error));
            return { memberCount: 0, members: [] };
        }
    }
    static async getSocketStats() {
        try {
            const io = (0, socket_1.getIO)();
            const allSockets = await io.fetchSockets();
            let adminCount = 0;
            let customerCount = 0;
            const roomStats = {};
            for (const socket of allSockets) {
                const authSocket = socket;
                if (authSocket.user) {
                    if (['OWNER', 'ADMIN'].includes(authSocket.user.role)) {
                        adminCount++;
                    }
                    else {
                        customerCount++;
                    }
                }
                for (const room of socket.rooms) {
                    if (room !== socket.id) {
                        roomStats[room] = (roomStats[room] || 0) + 1;
                    }
                }
            }
            return {
                totalConnections: allSockets.length,
                adminConnections: adminCount,
                customerConnections: customerCount,
                roomStats
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get socket stats:', (0, logger_1.toLogMetadata)(error));
            return {
                totalConnections: 0,
                adminConnections: 0,
                customerConnections: 0,
                roomStats: {}
            };
        }
    }
}
exports.SocketRoomService = SocketRoomService;
//# sourceMappingURL=socketRoomService.js.map