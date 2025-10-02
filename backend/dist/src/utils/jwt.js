"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRole = void 0;
exports.generateToken = generateToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyToken = verifyToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.getTokenInfo = getTokenInfo;
exports.isTokenExpired = isTokenExpired;
exports.getTokenTimeToExpiry = getTokenTimeToExpiry;
exports.isValidTokenFormat = isValidTokenFormat;
exports.generateTemporaryToken = generateTemporaryToken;
exports.validateTokenSecurity = validateTokenSecurity;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("./logger");
var UserRole;
(function (UserRole) {
    UserRole["OWNER"] = "OWNER";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["VENDOR"] = "VENDOR";
    UserRole["CUSTOMER"] = "CUSTOMER";
})(UserRole || (exports.UserRole = UserRole = {}));
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '1h');
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '7d');
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    logger_1.logger.warn('JWT secrets not set in environment variables. Using default values (INSECURE for production)');
}
function generateToken(payload) {
    try {
        const options = {
            expiresIn: JWT_EXPIRES_IN,
            issuer: 'botrt-ecommerce',
            audience: 'botrt-admin-panel',
            subject: payload.userId,
        };
        return jsonwebtoken_1.default.sign(payload, JWT_SECRET, options);
    }
    catch (error) {
        logger_1.logger.error('Error generating JWT token:', error);
        throw new Error('Token generation failed');
    }
}
function generateRefreshToken(userId) {
    try {
        const payload = {
            userId,
            type: 'refresh'
        };
        const options = {
            expiresIn: JWT_REFRESH_EXPIRES_IN,
            issuer: 'botrt-ecommerce',
            audience: 'botrt-refresh',
            subject: userId,
        };
        return jsonwebtoken_1.default.sign(payload, JWT_REFRESH_SECRET, options);
    }
    catch (error) {
        logger_1.logger.error('Error generating refresh token:', error);
        throw new Error('Refresh token generation failed');
    }
}
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, {
            issuer: 'botrt-ecommerce',
            audience: 'botrt-admin-panel',
        });
        return decoded;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.debug('Token verification failed:', {
            error: errorMessage,
            tokenPreview: token.substring(0, 20) + '...'
        });
        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'TokenExpiredError') {
            throw new Error('Token expired');
        }
        else if (errorName === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        else if (errorName === 'NotBeforeError') {
            throw new Error('Token not active');
        }
        else {
            throw new Error('Token verification failed');
        }
    }
}
function verifyRefreshToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET, {
            issuer: 'botrt-ecommerce',
            audience: 'botrt-refresh',
        });
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid refresh token type');
        }
        return decoded;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.debug('Refresh token verification failed:', {
            error: errorMessage,
            tokenPreview: token.substring(0, 20) + '...'
        });
        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'TokenExpiredError') {
            throw new Error('Refresh token expired');
        }
        else if (errorName === 'JsonWebTokenError') {
            throw new Error('Invalid refresh token');
        }
        else {
            throw new Error('Refresh token verification failed');
        }
    }
}
function getTokenInfo(token) {
    try {
        const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
        return decoded ? decoded : null;
    }
    catch (error) {
        logger_1.logger.error('Error decoding token:', error);
        return null;
    }
}
function isTokenExpired(token) {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded || !decoded.exp) {
            return true;
        }
        const currentTime = Math.floor(Date.now() / 1000);
        return decoded.exp < currentTime;
    }
    catch (error) {
        return true;
    }
}
function getTokenTimeToExpiry(token) {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded || !decoded.exp) {
            return null;
        }
        const currentTime = Math.floor(Date.now() / 1000);
        const timeToExpiry = decoded.exp - currentTime;
        return timeToExpiry > 0 ? timeToExpiry : 0;
    }
    catch (error) {
        return null;
    }
}
function isValidTokenFormat(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
}
function generateTemporaryToken(payload, expiresIn = '15m') {
    try {
        const options = {
            expiresIn: expiresIn,
            issuer: 'botrt-ecommerce',
            audience: 'botrt-temp',
            subject: payload.userId,
        };
        return jsonwebtoken_1.default.sign({ ...payload, temporary: true }, JWT_SECRET, options);
    }
    catch (error) {
        logger_1.logger.error('Error generating temporary token:', error);
        throw new Error('Temporary token generation failed');
    }
}
function validateTokenSecurity(token, _userAgent, _ipAddress) {
    const warnings = [];
    let isValid = true;
    if (!isValidTokenFormat(token)) {
        warnings.push('Invalid token format');
        isValid = false;
    }
    if (isTokenExpired(token)) {
        warnings.push('Token is expired');
        isValid = false;
    }
    const tokenInfo = getTokenInfo(token);
    if (tokenInfo) {
        const payload = tokenInfo.payload;
        const maxExpiry = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
        if (payload.exp && payload.exp > maxExpiry) {
            warnings.push('Token has suspiciously long expiry');
        }
        if (payload.iss !== 'botrt-ecommerce') {
            warnings.push('Invalid token issuer');
            isValid = false;
        }
    }
    return { isValid, warnings };
}
//# sourceMappingURL=jwt.js.map