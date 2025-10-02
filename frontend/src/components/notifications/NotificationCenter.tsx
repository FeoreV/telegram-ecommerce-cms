import React, { useState, useEffect } from 'react'
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Badge,
  Divider,
  Button,
  FormControlLabel,
  Switch,
  Slider,
  Alert,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Fab,
  Zoom,
} from '@mui/material'
import {
  Notifications,
  Close,
  VolumeUp,
  VolumeOff,
  Settings,
  Clear,
  CheckCircle,
  Warning,
  Error,
  Info,
  Receipt,
  Store,
  Person,
  Inventory,
  FilterList,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useSocket } from '../../contexts/SocketContext'
import { toast } from 'react-toastify'

interface Notification {
  id: string
  title: string
  message: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  type: string
  data?: any
  timestamp: string
  read?: boolean
  category?: 'order' | 'payment' | 'inventory' | 'user' | 'system'
  actionButtons?: Array<{
    label: string
    action: () => void
  }>
}

interface NotificationCenterProps {
  open: boolean
  onClose: () => void
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ open, onClose }) => {
  const { soundEnabled, setSoundEnabled, notificationsEnabled, setNotificationsEnabled } = useSocket()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [soundVolume, setSoundVolume] = useState(
    parseFloat(localStorage.getItem('notification_volume') || '0.7')
  )
  const [filter, setFilter] = useState<'all' | 'unread' | 'order' | 'payment' | 'inventory' | 'system'>('all')
  const [showSettings, setShowSettings] = useState(false)

  // Load notifications from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('admin_notifications')
    if (saved) {
      try {
        setNotifications(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to load notifications:', error)
      }
    }
  }, [])

  // Save notifications to localStorage
  useEffect(() => {
    localStorage.setItem('admin_notifications', JSON.stringify(notifications))
  }, [notifications])

  // Save volume setting
  useEffect(() => {
    localStorage.setItem('notification_volume', soundVolume.toString())
  }, [soundVolume])

  // Add new notification
  const addNotification = (notification: Omit<Notification, 'id' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      read: false,
    }

    setNotifications(prev => [newNotification, ...prev.slice(0, 99)]) // Keep last 100 notifications

    // Show toast for high priority notifications
    if (notification.priority === 'HIGH' || notification.priority === 'CRITICAL') {
      toast(notification.message, {
        type: notification.priority === 'CRITICAL' ? 'error' : 'warning',
        position: 'top-right',
        autoClose: notification.priority === 'CRITICAL' ? false : 8000,
      })
    }
  }

  // Listen to socket events
  useEffect(() => {
    const handleNotification = (data: any) => {
      if (data.notification) {
        addNotification({
          ...data.notification,
          category: getCategoryFromType(data.notification.type),
        })
      }
    }

    const handleOrderUpdate = (data: any) => {
      addNotification({
        title: 'Обновление заказа',
        message: `Заказ #${data.orderNumber} обновлен`,
        priority: 'MEDIUM',
        type: 'order_update',
        data,
        timestamp: new Date().toISOString(),
        category: 'order',
      })
    }

    const handlePaymentConfirmed = (data: any) => {
      addNotification({
        title: 'Оплата подтверждена',
        message: `Оплата заказа #${data.orderNumber} подтверждена`,
        priority: 'HIGH',
        type: 'payment_confirmed',
        data,
        timestamp: new Date().toISOString(),
        category: 'payment',
      })
    }

    const handlePaymentProofUploaded = (data: any) => {
      addNotification({
        title: 'Загружен чек оплаты',
        message: `Клиент загрузил чек для заказа #${data.orderNumber}. Требуется верификация.`,
        priority: 'HIGH',
        type: 'payment_proof_uploaded',
        data,
        timestamp: new Date().toISOString(),
        category: 'payment',
        actionButtons: [
          {
            label: 'Проверить',
            action: () => window.location.href = '/payments'
          }
        ]
      })
    }

    const handleOrderShipped = (data: any) => {
      addNotification({
        title: 'Заказ отправлен',
        message: `Заказ #${data.orderNumber} отправлен${data.trackingNumber ? `. Трек: ${data.trackingNumber}` : ''}`,
        priority: 'MEDIUM',
        type: 'order_shipped',
        data,
        timestamp: new Date().toISOString(),
        category: 'order',
      })
    }

    const handleOrderDelivered = (data: any) => {
      addNotification({
        title: 'Заказ доставлен',
        message: `Заказ #${data.orderNumber} успешно доставлен`,
        priority: 'LOW',
        type: 'order_delivered',
        data,
        timestamp: new Date().toISOString(),
        category: 'order',
      })
    }

    const handleOrderCancelled = (data: any) => {
      addNotification({
        title: 'Заказ отменен',
        message: `Заказ #${data.orderNumber} отменен. Причина: ${data.reason}`,
        priority: 'MEDIUM',
        type: 'order_cancelled',
        data,
        timestamp: new Date().toISOString(),
        category: 'order',
      })
    }

    // Global event listeners (these would be set up via socket context)
    window.addEventListener('socket:notification', handleNotification as EventListener)
    window.addEventListener('socket:order_update', handleOrderUpdate as EventListener)
    window.addEventListener('socket:payment_confirmed', handlePaymentConfirmed as EventListener)
    window.addEventListener('socket:payment_proof_uploaded', handlePaymentProofUploaded as EventListener)
    window.addEventListener('socket:order_shipped', handleOrderShipped as EventListener)
    window.addEventListener('socket:order_delivered', handleOrderDelivered as EventListener)
    window.addEventListener('socket:order_cancelled', handleOrderCancelled as EventListener)

    return () => {
      window.removeEventListener('socket:notification', handleNotification as EventListener)
      window.removeEventListener('socket:order_update', handleOrderUpdate as EventListener)
      window.removeEventListener('socket:payment_confirmed', handlePaymentConfirmed as EventListener)
      window.removeEventListener('socket:payment_proof_uploaded', handlePaymentProofUploaded as EventListener)
      window.removeEventListener('socket:order_shipped', handleOrderShipped as EventListener)
      window.removeEventListener('socket:order_delivered', handleOrderDelivered as EventListener)
      window.removeEventListener('socket:order_cancelled', handleOrderCancelled as EventListener)
    }
  }, [])

  const getCategoryFromType = (type: string): Notification['category'] => {
    if (type.includes('order')) return 'order'
    if (type.includes('payment')) return 'payment'
    if (type.includes('inventory') || type.includes('stock')) return 'inventory'
    if (type.includes('user')) return 'user'
    return 'system'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'error'
      case 'HIGH': return 'warning'
      case 'MEDIUM': return 'info'
      case 'LOW': return 'success'
      default: return 'default'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return <Error color="error" />
      case 'HIGH': return <Warning color="warning" />
      case 'MEDIUM': return <Info color="info" />
      case 'LOW': return <CheckCircle color="success" />
      default: return <Info />
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'order': return <Receipt />
      case 'payment': return <CheckCircle />
      case 'inventory': return <Inventory />
      case 'user': return <Person />
      case 'system': return <Settings />
      default: return <Info />
    }
  }

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true
    if (filter === 'unread') return !notification.read
    return notification.category === filter
  })

  const unreadCount = notifications.filter(n => !n.read).length

  const testNotification = () => {
    addNotification({
      title: 'Тестовое уведомление',
      message: 'Это тестовое уведомление для проверки системы',
      priority: 'MEDIUM',
      type: 'test',
      timestamp: new Date().toISOString(),
      category: 'system',
    })
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 420 },
          maxWidth: '100vw',
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Badge badgeContent={unreadCount} color="error" max={99}>
              <Notifications />
            </Badge>
            <Typography variant="h6">
              Уведомления
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Настройки">
              <IconButton onClick={() => setShowSettings(!showSettings)} size="small">
                <Settings />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>

        {/* Settings Panel */}
        {showSettings && (
          <Card sx={{ m: 2, mb: 1 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Настройки уведомлений
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  />
                }
                label="Включить уведомления"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                  />
                }
                label="Звуковые сигналы"
              />

              {soundEnabled && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Громкость: {Math.round(soundVolume * 100)}%
                  </Typography>
                  <Slider
                    value={soundVolume}
                    onChange={(_, value) => setSoundVolume(value as number)}
                    min={0}
                    max={1}
                    step={0.1}
                    size="small"
                  />
                </Box>
              )}

              <Button
                variant="outlined"
                size="small"
                onClick={testNotification}
                sx={{ mt: 1 }}
              >
                Тестовое уведомление
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filter Tabs */}
        <Box sx={{ p: 2, pb: 1 }}>
          <Grid container spacing={1}>
            {['all', 'unread', 'order', 'payment', 'inventory', 'system'].map((filterOption) => (
              <Grid item key={filterOption}>
                <Chip
                  label={
                    filterOption === 'all' ? 'Все' :
                    filterOption === 'unread' ? 'Непрочитанные' :
                    filterOption === 'order' ? 'Заказы' :
                    filterOption === 'payment' ? 'Платежи' :
                    filterOption === 'inventory' ? 'Склад' :
                    'Система'
                  }
                  variant={filter === filterOption ? 'filled' : 'outlined'}
                  color={filter === filterOption ? 'primary' : 'default'}
                  size="small"
                  onClick={() => setFilter(filterOption as any)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Actions */}
        {notifications.length > 0 && (
          <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 1 }}>
            {unreadCount > 0 && (
              <Button size="small" onClick={markAllAsRead} startIcon={<CheckCircle />}>
                Отметить все как прочитанные
              </Button>
            )}
            <Button size="small" onClick={clearAll} startIcon={<Clear />} color="secondary">
              Очистить все
            </Button>
          </Box>
        )}

        {/* Notifications List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Notifications sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {filter === 'unread' ? 'Нет непрочитанных уведомлений' : 'Нет уведомлений'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filter === 'unread' 
                  ? 'Все уведомления прочитаны' 
                  : 'Уведомления будут появляться здесь'
                }
              </Typography>
            </Box>
          ) : (
            <List>
              {filteredNotifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    button
                    onClick={() => markAsRead(notification.id)}
                    sx={{
                      bgcolor: notification.read ? 'transparent' : 'action.hover',
                      opacity: notification.read ? 0.7 : 1,
                    }}
                  >
                    <ListItemIcon>
                      <Box sx={{ position: 'relative' }}>
                        {getCategoryIcon(notification.category || 'system')}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            width: 12,
                            height: 12,
                          }}
                        >
                          {getPriorityIcon(notification.priority)}
                        </Box>
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle2" component="span" sx={{ flex: 1 }}>
                            {notification.title}
                          </Typography>
                          <Chip
                            label={notification.priority}
                            size="small"
                            color={getPriorityColor(notification.priority) as any}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" component="span" sx={{ mb: 0.5 }}>
                            {notification.message}
                          </Typography>
                          {notification.actionButtons && (
                            <Box sx={{ mt: 1, mb: 0.5 }}>
                              {notification.actionButtons.map((button, buttonIndex) => (
                                <Button
                                  key={buttonIndex}
                                  size="small"
                                  variant="outlined"
                                  onClick={button.action}
                                  sx={{ mr: 1 }}
                                >
                                  {button.label}
                                </Button>
                              ))}
                            </Box>
                          )}
                          <Typography variant="caption" component="span" color="text.secondary">
                            {format(new Date(notification.timestamp), 'dd MMM, HH:mm', { locale: ru })}
                          </Typography>
                        </Box>
                      }
                    />
                    {!notification.read && (
                      <ListItemSecondaryAction>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
                            boxShadow: theme => `0 0 0 2px ${theme.palette.background.paper}`,
                          }}
                        />
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                  {index < filteredNotifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </Drawer>
  )
}

export default NotificationCenter