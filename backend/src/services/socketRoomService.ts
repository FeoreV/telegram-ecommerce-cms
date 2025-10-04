import { prisma } from '../lib/prisma'
import { getIO } from '../lib/socket'
import { AuthenticatedSocket } from '../middleware/socketAuth'
import { logger, toLogMetadata } from '../utils/logger'
import { sanitizeForLog } from '../utils/sanitizer'

export class SocketRoomService {
  /**
   * Join user to appropriate rooms based on their role and permissions
   */
  static async joinUserToRooms(socket: AuthenticatedSocket): Promise<void> {
    if (!socket.user) {
      logger.error('Socket user not authenticated')
      return
    }

    const { id: userId, role } = socket.user

    try {
      // Join user-specific room (for personal notifications)
      const userRoom = `user_${userId}`
      socket.join(userRoom)
      logger.info(`User ${userId} joined room: ${userRoom}`)

      // Role-based room joining
      switch (role) {
        case 'OWNER': {
          // OWNER gets access to all admin rooms and all stores
          const ownerAdminRoom = `admin_${userId}`
          socket.join(ownerAdminRoom)
          socket.join('admins') // Global admin room
          socket.join('owners') // OWNER-only room

          // Join all store rooms (OWNER has access to all stores)
          const allStores = await prisma.store.findMany({
            select: { id: true }
          })

          for (const store of allStores) {
            socket.join(`store_${store.id}`)
          }

          logger.info(`OWNER ${userId} joined admin rooms and ${allStores.length} store rooms`)
          break
        }

        case 'ADMIN': {
          // ADMIN gets access to admin room and assigned stores
          const adminRoom = `admin_${userId}`
          socket.join(adminRoom)
          socket.join('admins') // Global admin room

          // Find stores where user is admin
          const adminStores = await prisma.store.findMany({
            where: {
              OR: [
                { ownerId: userId },
                { admins: { some: { userId } } }
              ]
            },
            select: { id: true, name: true }
          })

          for (const store of adminStores) {
            socket.join(`store_${store.id}`)
          }

          logger.info(`ADMIN ${userId} joined admin room and ${adminStores.length} store rooms`)
          break
        }

        case 'VENDOR': {
          // VENDOR gets access to assigned stores only
          const vendorStores = await prisma.store.findMany({
            where: {
              OR: [
                { ownerId: userId },
                { admins: { some: { userId } } }
              ]
            },
            select: { id: true, name: true }
          })

          for (const store of vendorStores) {
            socket.join(`store_${store.id}`)
          }

          logger.info(`VENDOR ${userId} joined ${vendorStores.length} store rooms`)
          break
        }

        case 'CUSTOMER':
          // CUSTOMER only gets personal room (already joined above)
          logger.info(`CUSTOMER ${userId} joined personal room only`)
          break

        default:
          logger.warn(`Unknown role ${sanitizeForLog(role)} for user ${sanitizeForLog(userId)}`)
      }

      // Emit successful room joining event
      socket.emit('rooms_joined', {
        userId,
        role,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      logger.error(`Error joining user ${sanitizeForLog(userId)} to rooms:`, toLogMetadata(error))
      socket.emit('room_join_error', {
        error: 'Failed to join rooms',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Leave user from all rooms (on disconnect)
   */
  static leaveUserFromRooms(socket: AuthenticatedSocket): void {
    if (!socket.user) {
      return
    }

    const { id: userId, role } = socket.user

    // Socket.IO automatically handles leaving rooms on disconnect,
    // but we can perform cleanup if needed
    logger.info(`User ${userId} (${role}) disconnected from socket ${socket.id}`)
  }

  /**
   * Broadcast notification to specific room
   */
  static broadcastToRoom(room: string, event: string, data: Record<string, unknown>): void {
    try {
      const io = getIO()
      io.to(room).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      })

      logger.info(`Broadcasted ${event} to room ${room}`)
    } catch (error) {
      logger.error(`Failed to broadcast to room ${sanitizeForLog(room)}:`, toLogMetadata(error))
    }
  }

  /**
   * Broadcast to user-specific room
   */
  static notifyUser(userId: string, event: string, data: Record<string, unknown>): void {
    this.broadcastToRoom(`user_${userId}`, event, data)
  }

  /**
   * Broadcast to admin rooms
   */
  static notifyAdmins(event: string, data: Record<string, unknown>): void {
    this.broadcastToRoom('admins', event, data)
  }

  /**
   * Broadcast to owners only
   */
  static notifyOwners(event: string, data: Record<string, unknown>): void {
    this.broadcastToRoom('owners', event, data)
  }

  /**
   * Broadcast to specific store
   */
  static notifyStore(storeId: string, event: string, data: Record<string, unknown>): void {
    this.broadcastToRoom(`store_${storeId}`, event, data)
  }

  /**
   * Broadcast order-related notifications with smart routing
   */
  static notifyOrderUpdate(orderId: string, storeId: string, event: string, data: Record<string, unknown>): void {
    // Notify all admins
    this.notifyAdmins(event, { ...data, orderId, storeId })

    // Notify specific store
    this.notifyStore(storeId, event, { ...data, orderId })

    // If customer ID is provided, notify customer
    if (data.customerId) {
      this.notifyUser(data.customerId as string, event, { ...data, orderId, storeId })
    }
  }

  /**
   * Get room members count (for monitoring)
   */
  static async getRoomInfo(room: string): Promise<{ memberCount: number; members: string[] }> {
    try {
      const io = getIO()
      const sockets = await io.in(room).fetchSockets()

      return {
        memberCount: sockets.length,
        members: sockets.map(s => (s as unknown as AuthenticatedSocket).userId || s.id)
      }
    } catch (error) {
      logger.error(`Failed to get room info for ${sanitizeForLog(room)}:`, toLogMetadata(error))
      return { memberCount: 0, members: [] }
    }
  }

  /**
   * Health check for Socket.IO rooms
   */
  static async getSocketStats(): Promise<{
    totalConnections: number
    adminConnections: number
    customerConnections: number
    roomStats: Record<string, number>
  }> {
    try {
      const io = getIO()
      const allSockets = await io.fetchSockets()

      let adminCount = 0
      let customerCount = 0
      const roomStats: Record<string, number> = {}

      for (const socket of allSockets) {
        const authSocket = socket as unknown as AuthenticatedSocket
        if (authSocket.user) {
          if (['OWNER', 'ADMIN'].includes(authSocket.user.role)) {
            adminCount++
          } else {
            customerCount++
          }
        }

        // Count room memberships
        for (const room of socket.rooms) {
          if (room !== socket.id) { // Exclude auto-joined room
            roomStats[room] = (roomStats[room] || 0) + 1
          }
        }
      }

      return {
        totalConnections: allSockets.length,
        adminConnections: adminCount,
        customerConnections: customerCount,
        roomStats
      }
    } catch (error) {
      logger.error('Failed to get socket stats:', toLogMetadata(error))
      return {
        totalConnections: 0,
        adminConnections: 0,
        customerConnections: 0,
        roomStats: {}
      }
    }
  }
}
