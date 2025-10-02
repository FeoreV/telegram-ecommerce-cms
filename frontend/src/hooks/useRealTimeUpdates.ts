import { useEffect, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { toast } from 'react-toastify'

interface UseRealTimeUpdatesOptions {
  onOrderUpdate?: () => void
  onProductUpdate?: () => void
  onStoreUpdate?: () => void
  onUserUpdate?: () => void
  enableNotifications?: boolean
}

/**
 * Custom hook for handling real-time updates in components
 * Automatically subscribes to relevant socket events and provides callbacks for data refreshing
 */
export const useRealTimeUpdates = (options: UseRealTimeUpdatesOptions = {}) => {
  const { socket, isConnected, on, off } = useSocket()
  const {
    onOrderUpdate,
    onProductUpdate,
    onStoreUpdate,
    onUserUpdate,
    enableNotifications = true,
  } = options

  // Order-related events
  const handleNewOrder = useCallback((data: any) => {
    if (onOrderUpdate) {
      onOrderUpdate()
    }
    
    if (enableNotifications) {
      const customerName = data.order.customerInfo?.name || 'Неизвестный покупатель'
      toast.success(`🛒 Новый заказ от ${customerName}`, {
        autoClose: 8000,
        onClick: () => {
          window.location.hash = '#/orders'
        }
      })
    }
  }, [onOrderUpdate, enableNotifications])

  const handleOrderUpdated = useCallback((data: any) => {
    if (onOrderUpdate) {
      onOrderUpdate()
    }
  }, [onOrderUpdate])

  const handlePaymentConfirmed = useCallback((data: any) => {
    if (onOrderUpdate) {
      onOrderUpdate()
    }
  }, [onOrderUpdate])

  const handleOrderRejected = useCallback((data: any) => {
    if (onOrderUpdate) {
      onOrderUpdate()
    }
  }, [onOrderUpdate])

  // Product-related events
  const handleProductCreated = useCallback((data: any) => {
    if (onProductUpdate) {
      onProductUpdate()
    }
  }, [onProductUpdate])

  const handleStockLow = useCallback((data: any) => {
    if (onProductUpdate) {
      onProductUpdate()
    }
    
    if (enableNotifications) {
      toast.warning(`⚠️ Мало товара: ${data.product.name}`, {
        autoClose: 10000,
        onClick: () => {
          window.location.hash = '#/products'
        }
      })
    }
  }, [onProductUpdate, enableNotifications])

  const handleOutOfStock = useCallback((data: any) => {
    if (onProductUpdate) {
      onProductUpdate()
    }
    
    if (enableNotifications) {
      toast.error(`❌ Товар закончился: ${data.product.name}`, {
        autoClose: 10000,
        onClick: () => {
          window.location.hash = '#/products'
        }
      })
    }
  }, [onProductUpdate, enableNotifications])

  // Store-related events
  const handleStoreCreated = useCallback((data: any) => {
    if (onStoreUpdate) {
      onStoreUpdate()
    }
  }, [onStoreUpdate])

  const handleStoreUpdated = useCallback((data: any) => {
    if (onStoreUpdate) {
      onStoreUpdate()
    }
  }, [onStoreUpdate])

  // User-related events
  const handleNewRegistration = useCallback((data: any) => {
    if (onUserUpdate) {
      onUserUpdate()
    }
    
    if (enableNotifications) {
      const userName = `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim()
      toast.info(`👤 Новый пользователь: ${userName || data.user.username}`, {
        autoClose: 6000,
        onClick: () => {
          window.location.hash = '#/users'
        }
      })
    }
  }, [onUserUpdate, enableNotifications])

  const handleRoleChanged = useCallback((data: any) => {
    if (onUserUpdate) {
      onUserUpdate()
    }
  }, [onUserUpdate])

  // Admin broadcast events
  const handleAdminBroadcast = useCallback((data: any) => {
    if (enableNotifications) {
      const toastMethod = {
        'success': toast.success,
        'info': toast.info,
        'warning': toast.warning,
        'error': toast.error,
      }[data.type] || toast.info

      toastMethod(`📢 ${data.message}`, {
        autoClose: data.type === 'error' ? 10000 : 7000,
      })
    }
  }, [enableNotifications])

  // Subscribe to events when component mounts
  useEffect(() => {
    if (!socket || !isConnected) return

    // Order events
    on('order:new', handleNewOrder)
    on('order:updated', handleOrderUpdated)
    on('order:payment_confirmed', handlePaymentConfirmed)
    on('order:rejected', handleOrderRejected)

    // Product events
    on('product:created', handleProductCreated)
    on('product:stock_low', handleStockLow)
    on('product:out_of_stock', handleOutOfStock)

    // Store events
    on('store:created', handleStoreCreated)
    on('store:updated', handleStoreUpdated)

    // User events
    on('user:new_registration', handleNewRegistration)
    on('user:role_changed', handleRoleChanged)

    // Admin events
    on('admin:broadcast', handleAdminBroadcast)

    // Cleanup on unmount
    return () => {
      off('order:new', handleNewOrder)
      off('order:updated', handleOrderUpdated)
      off('order:payment_confirmed', handlePaymentConfirmed)
      off('order:rejected', handleOrderRejected)
      off('product:created', handleProductCreated)
      off('product:stock_low', handleStockLow)
      off('product:out_of_stock', handleOutOfStock)
      off('store:created', handleStoreCreated)
      off('store:updated', handleStoreUpdated)
      off('user:new_registration', handleNewRegistration)
      off('user:role_changed', handleRoleChanged)
      off('admin:broadcast', handleAdminBroadcast)
    }
  }, [
    socket,
    isConnected,
    handleNewOrder,
    handleOrderUpdated,
    handlePaymentConfirmed,
    handleOrderRejected,
    handleProductCreated,
    handleStockLow,
    handleOutOfStock,
    handleStoreCreated,
    handleStoreUpdated,
    handleNewRegistration,
    handleRoleChanged,
    handleAdminBroadcast,
    on,
    off,
  ])

  return {
    isConnected,
    socket,
  }
}

/**
 * Specialized hook for dashboard real-time updates
 */
export const useDashboardRealTime = (onDataUpdate?: () => void) => {
  return useRealTimeUpdates({
    onOrderUpdate: onDataUpdate,
    onProductUpdate: onDataUpdate,
    onStoreUpdate: onDataUpdate,
    onUserUpdate: onDataUpdate,
    enableNotifications: true,
  })
}

/**
 * Specialized hook for orders page real-time updates
 */
export const useOrdersRealTime = (onOrderUpdate?: () => void) => {
  return useRealTimeUpdates({
    onOrderUpdate,
    enableNotifications: false, // Notifications handled by main context
  })
}

/**
 * Specialized hook for products page real-time updates
 */
export const useProductsRealTime = (onProductUpdate?: () => void) => {
  return useRealTimeUpdates({
    onProductUpdate,
    enableNotifications: false,
  })
}

/**
 * Specialized hook for stores page real-time updates
 */
export const useStoresRealTime = (onStoreUpdate?: () => void) => {
  return useRealTimeUpdates({
    onStoreUpdate,
    enableNotifications: false,
  })
}

/**
 * Specialized hook for users page real-time updates
 */
export const useUsersRealTime = (onUserUpdate?: () => void) => {
  return useRealTimeUpdates({
    onUserUpdate,
    enableNotifications: false,
  })
}
