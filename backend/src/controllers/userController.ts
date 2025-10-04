import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { NotificationChannel, NotificationPriority, NotificationService, NotificationType } from '../services/notificationService';
import { UserRole } from '../utils/jwt';
import { logger, toLogMetadata } from '../utils/logger';
// SECURITY FIX: Import sanitization for XSS and Log Injection protection
import { sanitizeHtml, sanitizeForLog } from '../utils/sanitizer';

// Get all users with role-based filtering
export const getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 20, role, search, storeId } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER and ADMIN can view users
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const skip = (Number(page) - 1) * Number(limit);

  // Build where clause
  const whereClause: Prisma.UserWhereInput = {};

  // Role filtering
  if (role && role !== 'all') {
    whereClause.role = role as UserRole;
  }

  // Search filtering
  if (search) {
    whereClause.OR = [
      { firstName: { contains: search as string } },
      { lastName: { contains: search as string } },
      { username: { contains: search as string } },
      { telegramId: { contains: search as string } }
    ];
  }

  // Store-based filtering for non-owners
  if (req.user.role !== 'OWNER' && storeId) {
    // ADMINs can only see users associated with their stores
    const hasAccess = await prisma.store.findFirst({
      where: {
        id: storeId as string,
        OR: [
          { ownerId: req.user.id },
          { admins: { some: { userId: req.user.id } } }
        ]
      }
    });

    if (!hasAccess) {
      throw new AppError('No access to this store', 403);
    }
  }

  try {
    // Get total count
    const total = await prisma.user.count({ where: whereClause });

    // Get users with associations
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            ownedStores: true,
            managedStores: true
          }
        },
        ownedStores: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        managedStores: {
          select: {
            store: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: Number(limit),
    });

    // Format user data for response
    const formattedUsers = users.map(user => ({
      ...user,
      stores: {
        owned: user.ownedStores,
        managed: user.managedStores.map(a => a.store)
      },
      _count: {
        orders: user._count.orders,
        stores: user._count.ownedStores + user._count.managedStores
      }
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: unknown) {
    logger.error('Error fetching users:', toLogMetadata(error));
    throw new AppError('Failed to fetch users', 500);
  }
});

// Get user by ID
export const getUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Users can view their own profile, admins can view others
  if (req.user.id !== id && !['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      ownedStores: {
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
          createdAt: true
        }
      },
      managedStores: {
        include: {
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              currency: true
            }
          }
        }
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      }
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Format response
  const formattedUser = {
    ...user,
    stores: {
      owned: user.ownedStores,
      managed: user.managedStores.map(a => a.store)
    }
  };

  res.json({ user: formattedUser });
});

// Update user role (OWNER only)
export const updateUserRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { role, storeAssignments } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER can change roles
  if (req.user.role !== 'OWNER') {
    throw new AppError('Only owners can change user roles', 403);
  }

  // Validate role
  if (!Object.values(UserRole).includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  // Can't change your own role
  if (req.user.id === id) {
    throw new AppError('Cannot change your own role', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  try {
    // Update user role and store assignments in transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update user role
      const updated = await tx.user.update({
        where: { id },
        data: { role },
        include: {
          ownedStores: true,
          managedStores: { include: { store: true } },
          vendorStores: { include: { store: true } }
        }
      });

      // Clear existing store assignments (except owned stores for OWNER role)
      if (role !== 'OWNER') {
        await tx.storeAdmin.deleteMany({
          where: { userId: id }
        });
        await tx.storeVendor.deleteMany({
          where: { userId: id }
        });
      }

      // Apply new store assignments
      if (storeAssignments && Array.isArray(storeAssignments)) {
        for (const assignment of storeAssignments) {
          const { storeId, role: assignmentRole } = assignment;

          // Verify store exists and user has access to assign
          const store = await tx.store.findUnique({
            where: { id: storeId }
          });

          if (!store) {
            throw new AppError(`Store ${storeId} not found`, 400);
          }

          // Create appropriate assignment
          if (assignmentRole === 'ADMIN') {
            await tx.storeAdmin.create({
              data: {
                userId: id,
                storeId,
                assignedBy: req.user.id
              }
            });
          } else if (assignmentRole === 'VENDOR') {
            await tx.storeVendor.create({
              data: {
                userId: id,
                storeId,
                assignedBy: req.user.id,
                isActive: true,
                permissions: JSON.stringify(['read_products', 'update_inventory'])
              }
            });
          }
        }
      }

      return updated;
    });

    // SECURITY FIX: CWE-117 - Sanitize log data
    logger.info(`User role updated: ${sanitizeForLog(id)} changed from ${sanitizeForLog(user.role)} to ${sanitizeForLog(role)} by ${sanitizeForLog(req.user.id)}`);

    // Notify user about role change
    NotificationService.send({
      title: 'Роль изменена',
      message: `Ваша роль в системе изменена на ${role}`,
      type: NotificationType.USER_REGISTERED,
      priority: NotificationPriority.HIGH,
      recipients: [id],
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.SOCKET],
      data: {
        newRole: role,
        changedBy: req.user.id,
        storeAssignments
      }
    });

    res.json({
      user: updatedUser,
      message: 'User role updated successfully'
    });

  } catch (error: unknown) {
    logger.error('Error updating user role:', toLogMetadata(error));
    throw new AppError('Failed to update user role', 500);
  }
});

// Toggle user active status
export const toggleUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER and ADMIN can toggle status
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  // Can't deactivate yourself
  if (req.user.id === id) {
    throw new AppError('Cannot deactivate your own account', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // ADMIN can't deactivate OWNER
  if (req.user.role === 'ADMIN' && user.role === 'OWNER') {
    throw new AppError('Admins cannot deactivate owners', 403);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      isActive: !user.isActive
    }
  });

  // SECURITY FIX: CWE-117 - Sanitize log data
  logger.info(`User status toggled: ${sanitizeForLog(id)} ${user.isActive ? 'deactivated' : 'activated'} by ${sanitizeForLog(req.user.id)}`);

  // Notify user about status change
  if (updatedUser.isActive) {
    NotificationService.send({
      title: 'Аккаунт активирован',
      message: 'Ваш аккаунт был активирован администратором',
      type: NotificationType.USER_REGISTERED,
      priority: NotificationPriority.MEDIUM,
      recipients: [id],
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.SOCKET],
      data: {
        activatedBy: req.user.id
      }
    });
  }

  res.json({
    user: updatedUser,
    message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`
  });
});

// Assign user to store
export const assignUserToStore = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, storeId, role } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER can assign users to stores
  if (req.user.role !== 'OWNER') {
    throw new AppError('Only owners can assign users to stores', 403);
  }

  // Validate role
  if (!['ADMIN', 'VENDOR'].includes(role)) {
    throw new AppError('Invalid assignment role. Must be ADMIN or VENDOR', 400);
  }

  // Check if user and store exist
  const [user, store] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.store.findUnique({ where: { id: storeId } })
  ]);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  try {
    // Create assignment
    let assignment: Prisma.StoreAdminCreateInput | Prisma.StoreVendorCreateInput | undefined;
    if (role === 'ADMIN') {
      // Check if already assigned
      const existing = await prisma.storeAdmin.findFirst({
        where: {
          userId,
          storeId
        }
      });

      if (existing) {
        throw new AppError('User is already an admin of this store', 400);
      }

      assignment = await prisma.storeAdmin.create({
        data: {
          userId,
          storeId
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              username: true
            }
          },
          store: {
            select: {
              name: true,
              slug: true
            }
          }
        }
      }) as any;
    } else {
      // Create vendor assignment
      assignment = await prisma.storeVendor.create({
        data: {
          userId,
          storeId,
          assignedBy: req.user.id,
          isActive: true,
          permissions: JSON.stringify(['read_products', 'update_inventory'])
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              role: true
            }
          },
          store: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      }) as any;
    }

    // SECURITY FIX: CWE-117 - Sanitize log data
    logger.info(`User ${sanitizeForLog(userId)} assigned as ${sanitizeForLog(role)} to store ${sanitizeForLog(storeId)} by ${sanitizeForLog(req.user.id)}`);

    // Notify user about assignment
    NotificationService.send({
      title: 'Новое назначение',
      message: `Вы назначены как ${role === 'ADMIN' ? 'администратор' : 'продавец'} магазина "${store.name}"`,
      type: NotificationType.USER_REGISTERED,
      priority: NotificationPriority.HIGH,
      recipients: [userId],
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.SOCKET],
      data: {
        storeId,
        storeName: store.name,
        role,
        assignedBy: req.user.id
      }
    });

    res.json({
      assignment,
      message: 'User assigned to store successfully'
    });

  } catch (error: unknown) {
    logger.error('Error assigning user to store:', toLogMetadata(error));
    throw new AppError('Failed to assign user to store', 500);
  }
});

// Remove user from store
export const removeUserFromStore = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId, storeId, role } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER can remove users from stores
  if (req.user.role !== 'OWNER') {
    throw new AppError('Only owners can remove users from stores', 403);
  }

  try {
    let removed = false;

    if (role === 'ADMIN') {
      const result = await prisma.storeAdmin.deleteMany({
        where: {
          userId,
          storeId
        }
      });
      removed = result.count > 0;
    } else if (role === 'VENDOR') {
      // Remove vendor assignment
      const result = await prisma.storeVendor.deleteMany({
        where: {
          userId,
          storeId
        }
      });
      removed = result.count > 0;
    }

    if (!removed) {
      throw new AppError('Assignment not found', 404);
    }

    // SECURITY FIX: CWE-117 - Sanitize log data
    logger.info(`User ${sanitizeForLog(userId)} removed as ${sanitizeForLog(role)} from store ${sanitizeForLog(storeId)} by ${sanitizeForLog(req.user.id)}`);

    // Get store info for notification
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true }
    });

    // Notify user about removal
    if (store) {
      // SECURITY FIX: Sanitize store name to prevent XSS (CWE-79)
      const safeStoreName = sanitizeHtml(store.name);
      const safeRole = role === 'ADMIN' ? 'администратор' : 'продавец';

      NotificationService.send({
        title: 'Доступ к магазину отозван',
        message: `Ваш доступ к магазину "${safeStoreName}" как ${safeRole} был отозван`,
        type: NotificationType.USER_REGISTERED,
        priority: NotificationPriority.MEDIUM,
        recipients: [userId],
        channels: [NotificationChannel.TELEGRAM, NotificationChannel.SOCKET],
        data: {
          storeId,
          storeName: safeStoreName,
          role,
          removedBy: req.user.id
        }
      });
    }

    res.json({ message: 'User removed from store successfully' });

  } catch (error: unknown) {
    logger.error('Error removing user from store:', toLogMetadata(error));
    throw new AppError('Failed to remove user from store', 500);
  }
});

// Get role statistics
export const getRoleStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER and ADMIN can view statistics
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  try {
    const stats = await prisma.user.groupBy({
      by: ['role'],
      where: {
        isActive: true
      },
      _count: {
        id: true
      }
    });

    const totalUsers = await prisma.user.count({
      where: { isActive: true }
    });

    const inactiveUsers = await prisma.user.count({
      where: { isActive: false }
    });

    const recentRegistrations = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    });

    const roleStats = stats.map(stat => ({
      role: stat.role,
      count: stat._count.id,
      percentage: (stat._count.id / totalUsers) * 100
    }));

    res.json({
      roleDistribution: roleStats,
      summary: {
        totalUsers,
        activeUsers: totalUsers,
        inactiveUsers,
        recentRegistrations
      }
    });

  } catch (error: unknown) {
    logger.error('Error fetching role statistics:', toLogMetadata(error));
    throw new AppError('Failed to fetch role statistics', 500);
  }
});

// Delete user (OWNER only)
export const deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER can delete users
  if (req.user.role !== 'OWNER') {
    throw new AppError('Only owners can delete users', 403);
  }

  // Can't delete yourself
  if (req.user.id === id) {
    throw new AppError('Cannot delete your own account', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          ownedStores: true,
          orders: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if user owns any stores
  if (user._count.ownedStores > 0) {
    throw new AppError('Cannot delete user who owns stores. Transfer store ownership first.', 400);
  }

  try {
    await prisma.user.delete({
      where: { id }
    });

    // SECURITY FIX: CWE-117 - Sanitize log data
    logger.info(`User deleted: ${sanitizeForLog(id)} by ${sanitizeForLog(req.user.id)}`);

    res.json({ message: 'User deleted successfully' });

  } catch (error: unknown) {
    logger.error('Error deleting user:', toLogMetadata(error));
    throw new AppError('Failed to delete user', 500);
  }
});

// Get user activity logs
export const getUserActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Users can view their own activity, admins can view others
  if (req.user.id !== id && !['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const skip = (Number(page) - 1) * Number(limit);

  try {
    const [activities, total] = await Promise.all([
      prisma.employeeActivity.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          store: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      }),
      prisma.employeeActivity.count({
        where: { userId: id }
      })
    ]);

    res.json({
      activities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error: unknown) {
    logger.error('Error fetching user activity:', toLogMetadata(error));
    throw new AppError('Failed to fetch user activity', 500);
  }
});

// Get user detailed info with stats
export const getUserDetailed = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Users can view their own profile, admins can view others
  if (req.user.id !== id && !['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          orders: true,
          ownedStores: true,
          managedStores: true,
          vendorStores: true,
          sessions: true,
          notifications: true,
          adminLogs: true
        }
      },
      ownedStores: {
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
          status: true,
          botStatus: true,
          createdAt: true,
          _count: {
            select: {
              products: true,
              orders: true
            }
          }
        }
      },
      managedStores: {
        include: {
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              currency: true,
              status: true
            }
          }
        }
      },
      vendorStores: {
        where: {
          isActive: true
        },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              currency: true
            }
          },
          customRole: {
            select: {
              id: true,
              name: true,
              color: true,
              permissions: true
            }
          }
        }
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          store: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      },
      sessions: {
        where: {
          isRevoked: false,
          expiresAt: {
            gte: new Date()
          }
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          ipAddress: true,
          userAgent: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      }
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Get order statistics
  const orderStats = await prisma.order.groupBy({
    by: ['status'],
    where: {
      customerId: id
    },
    _count: {
      id: true
    },
    _sum: {
      totalAmount: true
    }
  });

  // Get recent activity count
  const recentActivityCount = await prisma.employeeActivity.count({
    where: {
      userId: id,
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    }
  });

  // Format response
  const formattedUser = {
    ...user,
    stores: {
      owned: user.ownedStores,
      admin: user.managedStores.map(a => a.store),
      vendor: user.vendorStores.map(v => ({
        ...v.store,
        customRole: v.customRole,
        permissions: v.permissions
      }))
    },
    statistics: {
      orders: orderStats.map(stat => ({
        status: stat.status,
        count: stat._count.id,
        totalAmount: stat._sum.totalAmount || 0
      })),
      totalOrders: user._count.orders,
      totalStores: user._count.ownedStores + user._count.managedStores + user._count.vendorStores,
      activeSessions: user._count.sessions,
      notifications: user._count.notifications,
      adminActions: user._count.adminLogs,
      recentActivity: recentActivityCount
    }
  };

  res.json({ user: formattedUser });
});

// Ban user (set isActive to false)
export const banUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER and ADMIN can ban users
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  // Can't ban yourself
  if (req.user.id === id) {
    throw new AppError('Cannot ban your own account', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // ADMIN can't ban OWNER
  if (req.user.role === 'ADMIN' && user.role === 'OWNER') {
    throw new AppError('Admins cannot ban owners', 403);
  }

  if (!user.isActive) {
    throw new AppError('User is already banned', 400);
  }

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Ban user
      const banned = await tx.user.update({
        where: { id },
        data: { isActive: false }
      });

      // Revoke all active sessions
      await tx.userSession.updateMany({
        where: {
          userId: id,
          isRevoked: false
        },
        data: {
          isRevoked: true,
          revokedAt: new Date()
        }
      });

      // Log the ban action
      await tx.adminLog.create({
        data: {
          action: 'USER_BANNED',
          details: JSON.stringify({
            userId: id,
            reason: reason || 'No reason provided',
            bannedBy: req.user.id
          }),
          adminId: req.user.id
        }
      });

      return banned;
    });

    // SECURITY FIX: CWE-117 - Sanitize log data
    logger.info(`User banned: ${sanitizeForLog(id)} by ${sanitizeForLog(req.user.id)}, reason: ${sanitizeForLog(reason || 'No reason')}`);

    // Notify user about ban
    NotificationService.send({
      title: 'Аккаунт заблокирован',
      message: `Ваш аккаунт был заблокирован администратором. ${reason ? `Причина: ${reason}` : ''}`,
      type: NotificationType.USER_REGISTERED,
      priority: NotificationPriority.HIGH,
      recipients: [id],
      channels: [NotificationChannel.TELEGRAM],
      data: {
        bannedBy: req.user.id,
        reason: reason || 'No reason provided'
      }
    });

    res.json({
      user: updatedUser,
      message: 'User banned successfully'
    });

  } catch (error: unknown) {
    logger.error('Error banning user:', toLogMetadata(error));
    throw new AppError('Failed to ban user', 500);
  }
});

// Unban user (set isActive to true)
export const unbanUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER and ADMIN can unban users
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions', 403);
  }

  const user = await prisma.user.findUnique({
    where: { id }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.isActive) {
    throw new AppError('User is not banned', 400);
  }

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Unban user
      const unbanned = await tx.user.update({
        where: { id },
        data: { isActive: true }
      });

      // Log the unban action
      await tx.adminLog.create({
        data: {
          action: 'USER_UNBANNED',
          details: JSON.stringify({
            userId: id,
            unbannedBy: req.user.id
          }),
          adminId: req.user.id
        }
      });

      return unbanned;
    });

    // SECURITY FIX: CWE-117 - Sanitize log data
    logger.info(`User unbanned: ${sanitizeForLog(id)} by ${sanitizeForLog(req.user.id)}`);

    // Notify user about unban
    NotificationService.send({
      title: 'Аккаунт разблокирован',
      message: 'Ваш аккаунт был разблокирован администратором. Теперь вы можете снова пользоваться системой.',
      type: NotificationType.USER_REGISTERED,
      priority: NotificationPriority.HIGH,
      recipients: [id],
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.SOCKET],
      data: {
        unbannedBy: req.user.id
      }
    });

    res.json({
      user: updatedUser,
      message: 'User unbanned successfully'
    });

  } catch (error: unknown) {
    logger.error('Error unbanning user:', toLogMetadata(error));
    throw new AppError('Failed to unban user', 500);
  }
});

// Bulk actions on users
export const bulkUserActions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { action, userIds, data } = req.body;

  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  // Only OWNER can perform bulk actions
  if (req.user.role !== 'OWNER') {
    throw new AppError('Only owners can perform bulk actions', 403);
  }

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new AppError('User IDs array is required', 400);
  }

  // Can't perform bulk actions on yourself
  if (userIds.includes(req.user.id)) {
    throw new AppError('Cannot perform bulk actions on your own account', 400);
  }

  try {
    let result;

    switch (action) {
      case 'ban':
        result = await prisma.user.updateMany({
          where: {
            id: { in: userIds },
            role: { not: 'OWNER' } // Protect OWNER accounts
          },
          data: { isActive: false }
        });

        // Revoke sessions
        await prisma.userSession.updateMany({
          where: {
            userId: { in: userIds },
            isRevoked: false
          },
          data: {
            isRevoked: true,
            revokedAt: new Date()
          }
        });
        break;

      case 'unban':
        result = await prisma.user.updateMany({
          where: {
            id: { in: userIds }
          },
          data: { isActive: true }
        });
        break;

      case 'changeRole':
        if (!data?.role) {
          throw new AppError('Role is required for changeRole action', 400);
        }
        result = await prisma.user.updateMany({
          where: {
            id: { in: userIds },
            role: { not: 'OWNER' } // Protect OWNER accounts
          },
          data: { role: data.role }
        });
        break;

      case 'delete': {
        // Check if any user owns stores
        const usersWithStores = await prisma.user.findMany({
          where: {
            id: { in: userIds },
            ownedStores: {
              some: {}
            }
          },
          select: { id: true }
        });

        if (usersWithStores.length > 0) {
          throw new AppError('Cannot delete users who own stores', 400);
        }

        result = await prisma.user.deleteMany({
          where: {
            id: { in: userIds },
            role: { not: 'OWNER' } // Protect OWNER accounts
          }
        });
        break;
      }

      default:
        throw new AppError('Invalid action', 400);
    }

    // SECURITY FIX: CWE-117 - Sanitize log data
    logger.info(`Bulk action ${sanitizeForLog(action)} performed on ${userIds.length} users by ${sanitizeForLog(req.user.id)}`);

    // SECURITY FIX: CWE-79 - Sanitize message in JSON response
    res.json({
      message: `Bulk action ${sanitizeHtml(action)} completed successfully`,
      affectedCount: result.count
    });

  } catch (error: unknown) {
    logger.error('Error performing bulk action:', toLogMetadata(error));
    throw new AppError('Failed to perform bulk action', 500);
  }
});
