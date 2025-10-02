"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSessions = void 0;
const logger_1 = require("./logger");
const redisStore_1 = require("./redisStore");
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 60 * 60 * 1000);
    }
    getSession(telegramId) {
        let session = this.sessions.get(telegramId);
        if (session) {
            return session;
        }
        const newSession = {
            userId: '',
            telegramId,
            lastActivity: new Date(),
        };
        logger_1.logger.debug(`Creating new session for ${telegramId}`);
        this.sessions.set(telegramId, newSession);
        return newSession;
    }
    updateSession(telegramId, updates) {
        const session = this.getSession(telegramId);
        Object.assign(session, updates);
        session.lastActivity = new Date();
        this.sessions.set(telegramId, session);
        void redisStore_1.redisSessionStore.set(telegramId, session);
        logger_1.logger.debug(`Session updated for ${telegramId}:`, {
            userId: session.userId,
            hasToken: !!session.token,
            role: session.role
        });
    }
    clearSession(telegramId) {
        this.sessions.delete(telegramId);
        void redisStore_1.redisSessionStore.del(telegramId);
        logger_1.logger.debug(`Session cleared for ${telegramId}`);
    }
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [telegramId, session] of this.sessions.entries()) {
            if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
                this.clearSession(telegramId);
            }
        }
    }
    getStats() {
        return {
            totalSessions: this.sessions.size,
            activeSessions: Array.from(this.sessions.values()).filter(session => Date.now() - session.lastActivity.getTime() < 60 * 60 * 1000).length,
        };
    }
}
exports.userSessions = new SessionManager();
//# sourceMappingURL=sessionManager.js.map