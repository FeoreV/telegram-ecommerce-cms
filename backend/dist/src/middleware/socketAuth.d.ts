import { Socket, ExtendedError } from 'socket.io';
export interface AuthenticatedSocket extends Socket {
    userId?: string;
    user?: {
        id: string;
        telegramId: string;
        role: string;
        username?: string;
        firstName?: string;
        lastName?: string;
    };
}
export declare const socketAuthMiddleware: (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => Promise<void>;
//# sourceMappingURL=socketAuth.d.ts.map