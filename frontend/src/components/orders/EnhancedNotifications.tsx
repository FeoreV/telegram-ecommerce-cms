import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  Snackbar,
  Alert,
  Box,
  Typography,
  IconButton,
  Chip,
  Avatar,
  Button,
  Badge,
  Fade,
  Slide,
} from '@mui/material'
import {
  Close,
  ShoppingCart,
  AttachMoney,
  LocalShipping,
  CheckCircle,
  Cancel,
  Warning,
  PriorityHigh,
  Notifications,
  NotificationImportant,
} from '@mui/icons-material'
import { TransitionProps } from '@mui/material/transitions'

interface NotificationData {
  id: string
  type: 'new_order' | 'payment_confirmed' | 'order_rejected' | 'order_shipped' | 'order_delivered' | 'high_value_order' | 'urgent_order'
  title: string
  message: string
  order?: {
    id: string
    orderNumber: string
    totalAmount: number
    currency: string
    customerName?: string
  }
  priority: 'low' | 'medium' | 'high' | 'urgent'
  timestamp: Date
  autoHideDuration?: number
  actions?: Array<{
    label: string
    action: () => void
  }>
}

interface NotificationContextType {
  notifications: NotificationData[]
  addNotification: (notification: Omit<NotificationData, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearAll: () => void
  unreadCount: number
}

const NotificationContext = createContext<NotificationContextType | null>(null)

interface EnhancedNotificationsProviderProps {
  children: React.ReactNode
}

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="left" ref={ref} {...props} />
})

export const EnhancedNotificationsProvider: React.FC<EnhancedNotificationsProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null)
  const [settings, setSettings] = useState({
    globalEnabled: true,
    masterVolume: 70,
    doNotDisturbEnabled: false,
    doNotDisturbStart: '22:00',
    doNotDisturbEnd: '08:00',
    browserNotificationsEnabled: false,
  })

  const [rules, setRules] = useState<any[]>([])

  useEffect(() => {
    // Загрузка настроек из localStorage
    const savedSettings = localStorage.getItem('notificationSettings')
    const savedRules = localStorage.getItem('notificationRules')
    
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
    
    if (savedRules) {
      setRules(JSON.parse(savedRules))
    }
  }, [])

  const isInDoNotDisturbTime = useCallback(() => {
    if (!settings.doNotDisturbEnabled) return false
    
    const now = new Date()
    const currentTime = now.getHours() * 100 + now.getMinutes()
    const startTime = parseInt(settings.doNotDisturbStart.replace(':', ''))
    const endTime = parseInt(settings.doNotDisturbEnd.replace(':', ''))
    
    if (startTime > endTime) {
      // Через полночь (например, 22:00 - 08:00)
      return currentTime >= startTime || currentTime <= endTime
    } else {
      // В пределах дня
      return currentTime >= startTime && currentTime <= endTime
    }
  }, [settings])

  const playNotificationSound = useCallback((soundFile: string, priority: string) => {
    if (!settings.globalEnabled || isInDoNotDisturbTime()) return

    try {
      // В реальном проекте здесь будет загрузка и воспроизведение аудио файла
      // const audio = new Audio(`/sounds/${soundFile}`)
      // audio.volume = settings.masterVolume / 100
      // audio.play().catch(console.error)

      // Временная замена - speech synthesis для демонстрации
      if ('speechSynthesis' in window && priority === 'urgent') {
        const utterance = new SpeechSynthesisUtterance('Срочное уведомление')
        utterance.rate = 2
        utterance.pitch = 1.5
        utterance.volume = settings.masterVolume / 100
        speechSynthesis.speak(utterance)
      }
    } catch (error) {
      console.error('Error playing notification sound:', error)
    }
  }, [settings, isInDoNotDisturbTime])

  const showBrowserNotification = useCallback((notification: NotificationData) => {
    if (!settings.browserNotificationsEnabled || !('Notification' in window)) return

    if (Notification.permission === 'granted') {
      const browserNotif = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent',
      })

      browserNotif.onclick = () => {
        window.focus()
        browserNotif.close()
      }

      // Закрыть через определенное время
      const duration = notification.priority === 'urgent' ? 10000 : 5000
      setTimeout(() => browserNotif.close(), duration)
    }
  }, [settings])

  const addNotification = useCallback((notificationData: Omit<NotificationData, 'id' | 'timestamp'>) => {
    if (!settings.globalEnabled) return

    const notification: NotificationData = {
      ...notificationData,
      id: `notification-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    }

    // Найти соответствующее правило
    const rule = rules.find(r => r.eventType === notification.type && r.enabled)
    if (!rule) return

    // Применить действия из правила
    if (rule.actions.playSound) {
      playNotificationSound(rule.soundFile, notification.priority)
    }

    if (rule.actions.showToast) {
      setNotifications(prev => [...prev, notification])
      setCurrentNotification(notification)
    }

    if (rule.actions.browserNotification) {
      showBrowserNotification(notification)
    }
  }, [settings, rules, playNotificationSound, showBrowserNotification])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (currentNotification?.id === id) {
      setCurrentNotification(null)
    }
  }, [currentNotification])

  const clearAll = useCallback(() => {
    setNotifications([])
    setCurrentNotification(null)
  }, [])

  const unreadCount = notifications.length

  const getNotificationIcon = (type: string) => {
    const icons = {
      new_order: <ShoppingCart />,
      payment_confirmed: <CheckCircle />,
      order_rejected: <Cancel />,
      order_shipped: <LocalShipping />,
      order_delivered: <CheckCircle />,
      high_value_order: <AttachMoney />,
      urgent_order: <Warning />,
    }
    return icons[type as keyof typeof icons] || <Notifications />
  }

  const getSeverity = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error'
      case 'high': return 'warning'
      case 'medium': return 'info'
      default: return 'success'
    }
  }

  const getAutoHideDuration = (priority: string) => {
    switch (priority) {
      case 'urgent': return null // Не скрывать автоматически
      case 'high': return 8000
      case 'medium': return 6000
      default: return 4000
    }
  }

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll,
      unreadCount,
    }}>
      {children}
      
      {/* Enhanced Toast Notification */}
      {currentNotification && (
        <Snackbar
          open={Boolean(currentNotification)}
          autoHideDuration={getAutoHideDuration(currentNotification.priority)}
          onClose={() => setCurrentNotification(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          TransitionComponent={SlideTransition}
        >
          <Alert
            severity={getSeverity(currentNotification.priority) as any}
            variant="filled"
            sx={{
              minWidth: 400,
              '& .MuiAlert-icon': {
                fontSize: '1.5rem',
              },
            }}
            icon={getNotificationIcon(currentNotification.type)}
            action={
              <Box display="flex" alignItems="center" gap={1}>
                {currentNotification.priority === 'urgent' && (
                  <Chip
                    label="СРОЧНО"
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ color: 'white', borderColor: 'white' }}
                  />
                )}
                <IconButton
                  size="small"
                  aria-label="close"
                  color="inherit"
                  onClick={() => setCurrentNotification(null)}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            }
          >
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {currentNotification.title}
              </Typography>
              <Typography variant="body2">
                {currentNotification.message}
              </Typography>
              
              {currentNotification.order && (
                <Box display="flex" alignItems="center" gap={2} mt={1}>
                  <Typography variant="caption">
                    #{currentNotification.order.orderNumber}
                  </Typography>
                  <Typography variant="caption">
                    {currentNotification.order.totalAmount.toLocaleString()} {currentNotification.order.currency}
                  </Typography>
                  {currentNotification.order.customerName && (
                    <Typography variant="caption">
                      {currentNotification.order.customerName}
                    </Typography>
                  )}
                </Box>
              )}
              
              {currentNotification.actions && (
                <Box display="flex" gap={1} mt={1}>
                  {currentNotification.actions.map((action, index) => (
                    <Button
                      key={index}
                      size="small"
                      color="inherit"
                      onClick={() => {
                        action.action()
                        setCurrentNotification(null)
                      }}
                      sx={{ color: 'white', borderColor: 'white' }}
                      variant="outlined"
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          </Alert>
        </Snackbar>
      )}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within EnhancedNotificationsProvider')
  }
  return context
}
