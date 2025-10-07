"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoRefresh = exports.verifyToken = exports.setPassword = exports.changePassword = exports.updateProfile = exports.getProfile = exports.logout = exports.refreshToken = exports.loginWithTelegram = exports.loginWithEmail = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const SecureAuthSystem_1 = require("./SecureAuthSystem");
exports.loginWithEmail = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required',
            code: 'MISSING_CREDENTIALS'
        });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({
            error: 'Invalid credential format',
            code: 'INVALID_FORMAT'
        });
    }
    if (password.length < 6) {
        return res.status(400).json({
            error: 'Password must be at least 6 characters',
            code: 'PASSWORD_TOO_SHORT'
        });
    }
    try {
        const result = await SecureAuthSystem_1.SecureAuthSystem.authenticateWithEmail(email.toLowerCase().trim(), password);
        logger_1.logger.info('User logged in successfully via email', {
            userId: result.user.id,
            email: result.user.email,
            role: result.user.role,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        };
        res.cookie('accessToken', result.accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', result.refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            success: true,
            message: 'Authentication successful',
            user: result.user,
            tokens: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: '15m'
            }
        });
    }
    catch (error) {
        logger_1.logger.warn('Email login failed', {
            email,
            error: error instanceof Error ? error.message : String(error),
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(401).json({
            error: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS'
        });
    }
});
exports.loginWithTelegram = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { telegramId, username, firstName, lastName } = req.body;
    if (!telegramId) {
        return res.status(400).json({
            error: 'Telegram ID is required',
            code: 'MISSING_TELEGRAM_ID'
        });
    }
    const telegramIdString = telegramId.toString();
    try {
        const result = await SecureAuthSystem_1.SecureAuthSystem.authenticateWithTelegram(telegramIdString, { username, firstName, lastName });
        logger_1.logger.info('User logged in successfully via Telegram', {
            userId: result.user.id,
            telegramId: telegramIdString,
            role: result.user.role,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            isNewUser: !result.user.username && username
        });
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        };
        res.cookie('accessToken', result.accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', result.refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            success: true,
            message: 'Authentication successful',
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            token: result.accessToken,
            expiresIn: '15m'
        });
    }
    catch (error) {
        logger_1.logger.error('Telegram login failed', {
            telegramId: telegramIdString,
            error: error instanceof Error ? error.message : String(error),
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(500).json({
            error: 'Authentication failed',
            code: 'TELEGRAM_AUTH_ERROR',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});
exports.refreshToken = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({
            error: 'Refresh token required',
            code: 'MISSING_REFRESH_TOKEN'
        });
    }
    try {
        const result = await SecureAuthSystem_1.SecureAuthSystem.refreshTokenPair(refreshToken);
        logger_1.logger.info('Tokens refreshed successfully', {
            userId: result.user.id,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        };
        res.cookie('accessToken', result.accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000
        });
        res.cookie('refreshToken', result.refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            success: true,
            message: 'Tokens refreshed successfully',
            user: result.user,
            tokens: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: '15m'
            }
        });
    }
    catch (error) {
        logger_1.logger.warn('Token refresh failed', {
            error: error instanceof Error ? error.message : String(error),
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(401).json({
            error: 'Invalid or expired refresh token',
            code: 'INVALID_REFRESH_TOKEN',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});
exports.logout = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { refreshToken: bodyRefreshToken } = req.body;
    const accessToken = req.token;
    const refreshToken = bodyRefreshToken || req.cookies.refreshToken;
    const sessionId = req.sessionId;
    try {
        await SecureAuthSystem_1.SecureAuthSystem.logout(accessToken, refreshToken, sessionId);
        logger_1.logger.info('User logged out successfully', {
            userId: req.user?.id,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Logout error', {
            error: error instanceof Error ? error.message : String(error),
            userId: req.user?.id,
            ip: req.ip
        });
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(500).json({
            error: 'Logout failed',
            code: 'LOGOUT_ERROR',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});
exports.getProfile = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            email: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            balance: true,
            createdAt: true,
            updatedAt: true,
            ownedStores: {
                select: {
                    id: true,
                    name: true,
                    currency: true
                }
            },
            managedStores: {
                select: {
                    storeId: true,
                    store: {
                        select: {
                            id: true,
                            name: true,
                            currency: true
                        }
                    }
                }
            }
        }
    });
    if (!user) {
        return res.status(404).json({
            error: 'User not found',
            code: 'USER_NOT_FOUND'
        });
    }
    let permissions = [];
    try {
        permissions = await SecureAuthSystem_1.SecureAuthSystem.getUserPermissions(user.id);
    }
    catch (error) {
        logger_1.logger.warn('Failed to get user permissions, continuing without them', {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error)
        });
    }
    res.json({
        success: true,
        user: {
            ...user,
            managedStores: user.managedStores.map(ms => ms.store),
            permissions
        }
    });
});
exports.updateProfile = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
    const { username, firstName, lastName, email } = req.body;
    const updates = {};
    if (username !== undefined) {
        if (typeof username === 'string' && username.length > 0) {
            updates.username = username.trim();
        }
        else if (username !== null) {
            return res.status(400).json({
                error: 'Invalid username format',
                code: 'INVALID_USERNAME'
            });
        }
        else {
            updates.username = null;
        }
    }
    if (firstName !== undefined) {
        if (typeof firstName === 'string' && firstName.length > 0) {
            updates.firstName = firstName.trim();
        }
        else if (firstName !== null) {
            return res.status(400).json({
                error: 'Invalid first name format',
                code: 'INVALID_FIRSTNAME'
            });
        }
        else {
            updates.firstName = null;
        }
    }
    if (lastName !== undefined) {
        if (typeof lastName === 'string' && lastName.length > 0) {
            updates.lastName = lastName.trim();
        }
        else if (lastName !== null) {
            return res.status(400).json({
                error: 'Invalid last name format',
                code: 'INVALID_LASTNAME'
            });
        }
        else {
            updates.lastName = null;
        }
    }
    if (email !== undefined) {
        if (typeof email === 'string' && email.includes('@')) {
            const existingUser = await prisma_1.prisma.user.findFirst({
                where: {
                    email: email.toLowerCase().trim(),
                    id: { not: req.user.id }
                }
            });
            if (existingUser) {
                return res.status(400).json({
                    error: 'Email already in use',
                    code: 'EMAIL_EXISTS'
                });
            }
            updates.email = email.toLowerCase().trim();
        }
        else if (email !== null) {
            return res.status(400).json({
                error: 'Invalid email format',
                code: 'INVALID_EMAIL'
            });
        }
        else {
            updates.email = null;
        }
    }
    try {
        const updatedUser = await prisma_1.prisma.user.update({
            where: { id: req.user.id },
            data: updates,
            select: {
                id: true,
                email: true,
                telegramId: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                updatedAt: true
            }
        });
        logger_1.logger.info('User profile updated', {
            userId: req.user.id,
            updatedFields: Object.keys(updates),
            ip: req.ip
        });
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });
    }
    catch (error) {
        logger_1.logger.error('Profile update failed', {
            error: error instanceof Error ? error.message : String(error),
            userId: req.user.id,
            updates
        });
        res.status(500).json({
            error: 'Profile update failed',
            code: 'UPDATE_ERROR'
        });
    }
});
exports.changePassword = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            error: 'Current password and new password are required',
            code: 'MISSING_PASSWORDS'
        });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({
            error: 'New password must be at least 6 characters',
            code: 'PASSWORD_TOO_SHORT'
        });
    }
    try {
        await SecureAuthSystem_1.SecureAuthSystem.changePassword(req.user.id, currentPassword, newPassword);
        logger_1.logger.info('Password changed successfully', {
            userId: req.user.id,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    }
    catch (error) {
        logger_1.logger.warn('Password change failed', {
            userId: req.user.id,
            error: error instanceof Error ? error.message : String(error),
            ip: req.ip
        });
        if (error instanceof Error && error.message.includes('Current password is incorrect')) {
            return res.status(400).json({
                error: 'Current password is incorrect',
                code: 'INCORRECT_CURRENT_PASSWORD'
            });
        }
        else if (error instanceof Error && error.message.includes('No password set')) {
            return res.status(400).json({
                error: 'No password set for this account. Contact administrator.',
                code: 'NO_PASSWORD_SET'
            });
        }
        res.status(500).json({
            error: 'Password change failed',
            code: 'PASSWORD_CHANGE_ERROR'
        });
    }
});
exports.setPassword = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user || req.user.role !== SecureAuthSystem_1.UserRole.OWNER) {
        return res.status(403).json({
            error: 'Only owners can set passwords for users',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }
    const { userId, password } = req.body;
    if (!userId || !password) {
        return res.status(400).json({
            error: 'User ID and password are required',
            code: 'MISSING_PARAMETERS'
        });
    }
    if (password.length < 6) {
        return res.status(400).json({
            error: 'Password must be at least 6 characters',
            code: 'PASSWORD_TOO_SHORT'
        });
    }
    try {
        const targetUser = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, role: true }
        });
        if (!targetUser) {
            return res.status(404).json({
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }
        await SecureAuthSystem_1.SecureAuthSystem.setPassword(userId, password);
        logger_1.logger.info('Password set for user by owner', {
            adminId: req.user.id,
            targetUserId: userId,
            targetUserRole: targetUser.role,
            ip: req.ip
        });
        res.json({
            success: true,
            message: 'Password set successfully for user'
        });
    }
    catch (error) {
        logger_1.logger.error('Set password failed', {
            error: error instanceof Error ? error.message : String(error),
            adminId: req.user.id,
            targetUserId: userId
        });
        res.status(500).json({
            error: 'Failed to set password',
            code: 'SET_PASSWORD_ERROR'
        });
    }
});
exports.verifyToken = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const token = req.token;
    const needsRefresh = SecureAuthSystem_1.SecureAuthSystem.isTokenNearExpiry(token);
    res.json({
        success: true,
        valid: true,
        user: req.user,
        sessionId: req.sessionId,
        needsRefresh,
        expiresIn: needsRefresh ? 'soon' : 'valid'
    });
});
exports.autoRefresh = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { accessToken: currentAccessToken, refreshToken } = req.body;
    const cookieAccessToken = req.cookies?.accessToken;
    const cookieRefreshToken = req.cookies?.refreshToken;
    const accessToken = currentAccessToken || cookieAccessToken;
    const refreshTokenToUse = refreshToken || cookieRefreshToken;
    if (!accessToken || !refreshTokenToUse) {
        return res.status(400).json({
            success: false,
            error: 'Both access and refresh tokens required',
            code: 'MISSING_TOKENS'
        });
    }
    try {
        const refreshResult = await SecureAuthSystem_1.SecureAuthSystem.autoRefreshIfNeeded(accessToken, refreshTokenToUse);
        if (!refreshResult.needsRefresh) {
            return res.json({
                success: true,
                refreshed: false,
                message: 'Token still valid, no refresh needed'
            });
        }
        if (refreshResult.newTokens) {
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/'
            };
            res.cookie('accessToken', refreshResult.newTokens.accessToken, {
                ...cookieOptions,
                maxAge: 2 * 60 * 60 * 1000
            });
            res.cookie('refreshToken', refreshResult.newTokens.refreshToken, {
                ...cookieOptions,
                maxAge: 30 * 24 * 60 * 60 * 1000
            });
            logger_1.logger.info('Auto-refresh successful', {
                userId: refreshResult.newTokens.user.id,
                ip: req.ip
            });
            return res.json({
                success: true,
                refreshed: true,
                tokens: {
                    accessToken: refreshResult.newTokens.accessToken,
                    refreshToken: refreshResult.newTokens.refreshToken,
                    expiresIn: '2h'
                },
                user: refreshResult.newTokens.user
            });
        }
        return res.status(401).json({
            success: false,
            error: 'Token refresh required but failed',
            code: 'REFRESH_REQUIRED',
            action: 'reauth'
        });
    }
    catch (error) {
        logger_1.logger.warn('Auto-refresh failed', {
            error: error instanceof Error ? error.message : String(error),
            ip: req.ip
        });
        return res.status(401).json({
            success: false,
            error: 'Token refresh failed',
            code: 'REFRESH_FAILED',
            message: error instanceof Error ? error.message : String(error)
        });
    }
});
//# sourceMappingURL=SecureAuthController.js.map