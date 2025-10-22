import { Socket, ExtendedError } from 'socket.io'
import { verifyToken } from '../utils/jwt'
import { prisma } from '../lib/prisma'
import { logger } from '../utils/logger'

export interface AuthenticatedSocket extends Socket {
  userId?: string
  user?: {
    id: string
    telegramId: string
    role: string
    username?: string
    firstName?: string
    lastName?: string
  }
}

export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void
) => {
  try {
    const token = socket.handshake.auth.token

    if (!token) {
      logger.warn(`Socket connection without token: ${socket.id}`)
      // Allow connection but mark as unauthenticated
      socket.userId = undefined
      socket.user = undefined
      return next()
    }

    // Verify JWT token
    let decoded
    try {
      decoded = verifyToken(token)
    } catch (error: any) {
      logger.warn(`Socket token invalid: ${error.message} for ${socket.id}`)
      // Allow connection but mark as unauthenticated
      socket.userId = undefined
      socket.user = undefined
      return next()
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        telegramId: true,
        role: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) {
      logger.warn(`Socket user not found or inactive for ${socket.id}`)
      // Allow connection but mark as unauthenticated
      socket.userId = undefined
      socket.user = undefined
      return next()
    }

    // Attach user info to socket
    socket.userId = user.id
    socket.user = {
      id: user.id,
      telegramId: user.telegramId,
      role: user.role,
      username: user.username || undefined,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
    }

    logger.info(`Socket authenticated: ${socket.id} for user ${user.id} (${user.role})`)
    next()
  } catch (error) {
    logger.error('Socket authentication error:', error)
    next(new Error('Authentication failed: Server error'))
  }
}
