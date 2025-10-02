import { logger } from './logger';
import { redisSessionStore } from './redisStore';

export interface UserSession {
  userId: string;
  telegramId: string;
  token?: string;
  role?: string;
  currentStore?: string;
  currentCategory?: string;
  orderingStep?: 'selecting' | 'contact' | 'confirmation';
  tempData?: any; // For temporary data during flows
  purchaseMode?: 'direct' | 'cart'; // Purchase mode: direct buy or cart
  cart?: any[]; // Shopping cart items
  storeCreation?: {
    step: number | 'name' | 'description' | 'slug' | 'currency' | 'contact';
    data: any;
  } | null;
  botCreation?: {
    storeId: string;
    storeName: string;
    step: 'token' | 'username';
    token?: string;
    username?: string;
  } | null;
  pendingRejection?: {
    reason: string;
  } | null;
  paymentProofFlow?: {
    orderId: string;
    awaitingPhoto: boolean;
  } | null;
  lastActivity: Date;
}

class SessionManager {
  private sessions: Map<string, UserSession> = new Map();
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Clean up expired sessions every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  getSession(telegramId: string): UserSession {
    let session = this.sessions.get(telegramId);
    
    if (session) {
      return session;
    }

    // Create new session
    const newSession: UserSession = {
      userId: '',
      telegramId,
      lastActivity: new Date(),
    };

    logger.debug(`Creating new session for ${telegramId}`);
    this.sessions.set(telegramId, newSession);
    
    return newSession;
  }

  updateSession(telegramId: string, updates: Partial<UserSession>): void {
    const session = this.getSession(telegramId);
    Object.assign(session, updates);
    session.lastActivity = new Date();
    
    this.sessions.set(telegramId, session);
    void redisSessionStore.set(telegramId, session);
    
    logger.debug(`Session updated for ${telegramId}:`, {
      userId: session.userId,
      hasToken: !!session.token,
      role: session.role
    });
  }

  clearSession(telegramId: string): void {
    this.sessions.delete(telegramId);
    void redisSessionStore.del(telegramId);
    
    logger.debug(`Session cleared for ${telegramId}`);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [telegramId, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.clearSession(telegramId);
      }
    }
  }

  // Get session statistics
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(
        session => Date.now() - session.lastActivity.getTime() < 60 * 60 * 1000 // 1 hour
      ).length,
    };
  }
}

export const userSessions = new SessionManager();