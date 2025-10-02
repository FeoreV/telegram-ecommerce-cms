import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import { toast } from 'react-toastify'

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  createdAt: string
  data?: any
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: React.ReactNode
}

type NotificationAction =
  | { type: 'ADD'; payload: Notification }
  | { type: 'MARK_READ'; payload: { id: string } }
  | { type: 'MARK_ALL_READ' }
  | { type: 'REMOVE'; payload: { id: string } }
  | { type: 'CLEAR' }

const notificationsReducer = (state: Notification[], action: NotificationAction): Notification[] => {
  switch (action.type) {
    case 'ADD':
      return [action.payload, ...state]
    case 'MARK_READ':
      return state.map((notification) =>
        notification.id === action.payload.id ? { ...notification, read: true } : notification
      )
    case 'MARK_ALL_READ':
      return state.map((notification) => ({ ...notification, read: true }))
    case 'REMOVE':
      return state.filter((notification) => notification.id !== action.payload.id)
    case 'CLEAR':
      return []
    default:
      return state
  }
}

let notificationCounter = 0
const generateNotificationId = () => {
  notificationCounter += 1
  return `notification-${Date.now()}-${notificationCounter}`
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, dispatch] = useReducer(notificationsReducer, [])

  const showToast = useCallback((type: Notification['type'], message: string) => {
    switch (type) {
      case 'success':
        toast.success(message)
        break
      case 'error':
        toast.error(message)
        break
      case 'warning':
        toast.warning(message)
        break
      default:
        toast.info(message)
    }
  }, [])

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
      const newNotification: Notification = {
        ...notification,
        id: generateNotificationId(),
        read: false,
        createdAt: new Date().toISOString(),
      }

      dispatch({ type: 'ADD', payload: newNotification })
      showToast(notification.type, notification.message)
    },
    [showToast]
  )

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_READ', payload: { id } })
  }, [])

  const markAllAsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_READ' })
  }, [])

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', payload: { id } })
  }, [])

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR' })
  }, [])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const value = useMemo<NotificationContextType>(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll,
    }),
    [addNotification, clearAll, markAllAsRead, markAsRead, notifications, removeNotification, unreadCount]
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export default NotificationContext
