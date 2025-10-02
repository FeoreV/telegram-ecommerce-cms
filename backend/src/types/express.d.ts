import { UserRole } from '../utils/jwt';

export interface UserWithPermissions {
  id: string;
  telegramId?: string | null;
  email?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  isActive?: boolean;
  permissions?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: UserWithPermissions;
      session?: {
        id: string;
        userId?: string;
      };
    }
  }
}
