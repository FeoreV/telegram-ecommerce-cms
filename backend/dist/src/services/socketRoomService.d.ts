import { AuthenticatedSocket } from '../middleware/socketAuth';
export declare class SocketRoomService {
    static joinUserToRooms(socket: AuthenticatedSocket): Promise<void>;
    static leaveUserFromRooms(socket: AuthenticatedSocket): void;
    static broadcastToRoom(room: string, event: string, data: Record<string, unknown>): void;
    static notifyUser(userId: string, event: string, data: Record<string, unknown>): void;
    static notifyAdmins(event: string, data: Record<string, unknown>): void;
    static notifyOwners(event: string, data: Record<string, unknown>): void;
    static notifyStore(storeId: string, event: string, data: Record<string, unknown>): void;
    static notifyOrderUpdate(orderId: string, storeId: string, event: string, data: Record<string, unknown>): void;
    static getRoomInfo(room: string): Promise<{
        memberCount: number;
        members: string[];
    }>;
    static getSocketStats(): Promise<{
        totalConnections: number;
        adminConnections: number;
        customerConnections: number;
        roomStats: Record<string, number>;
    }>;
}
//# sourceMappingURL=socketRoomService.d.ts.map