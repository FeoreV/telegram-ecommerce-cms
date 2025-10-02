export interface InvitationData {
    storeId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN' | 'VENDOR';
    permissions?: string[];
    message?: string;
    invitedBy: string;
}
export declare class EmployeeService {
    static sendInvitation(data: InvitationData): Promise<string>;
    static acceptInvitation(token: string, telegramId?: string): Promise<void>;
    static rejectInvitation(token: string, reason?: string): Promise<void>;
    static getEmployeeActivity(storeId: string, userId?: string, limit?: number, offset?: number): Promise<unknown[]>;
    static logActivity(userId: string, storeId: string, action: string, details?: Record<string, unknown>, ipAddress?: string, userAgent?: string): Promise<void>;
    static cleanupExpiredInvitations(): Promise<number>;
}
//# sourceMappingURL=employeeService.d.ts.map