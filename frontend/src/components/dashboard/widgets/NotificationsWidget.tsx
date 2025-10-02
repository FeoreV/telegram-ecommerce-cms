import React, { useState, useEffect } from 'react'
import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  IconButton,
  Badge,
  Chip,
  Button,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
} from '@mui/material'
import {
  Notifications,
  NotificationsActive,
  NotificationsOff,
  Circle,
  CheckCircle,
  Warning,
  Error,
  Info,
  Clear,
  MarkEmailRead,
  Settings,
  ShoppingCart,
  Inventory,
  TrendingUp,
  Person,
} from '@mui/icons-material'
import DashboardWidget from '../DashboardWidget'
import { useAuth } from '../../../contexts/AuthContext'

interface Notification {
  id: string
  type: 'order' | 'inventory' | 'user' | 'system' | 'revenue'
  title: string
  message: string
  timestamp: Date
  read: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  action?: {
    label: string
    callback: () => void
  }
}

interface NotificationsWidgetProps {
  onRefresh?: () => void
  onSettings?: () => void
}

const NotificationsWidget: React.FC<NotificationsWidgetProps> = ({
  onRefresh,
  onSettings,
}) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showOnlyUnread, setShowOnlyUnread] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Mock notifications data - in real app would come from API
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'order',
        title: 'Новый заказ',
        message: 'Получен заказ #12345 на сумму 5,500₽',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        read: false,
        priority: 'high',
        action: {
          label: 'Просмотреть',
          callback: () => console.log('View order')
        }
      },
      {
        id: '2',
        type: 'inventory',
        title: 'Заканчивается товар',
        message: 'iPhone 15 Pro: осталось 3 шт.',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        read: false,
        priority: 'medium',
        action: {
          label: 'Пополнить',
          callback: () => console.log('Restock item')
        }
      },
      {
        id: '3',
        type: 'revenue',
        title: 'Рост продаж',
        message: 'Выручка за сегодня превысила план на 25%',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        read: true,
        priority: 'low'
      },
      {
        id: '4',
        type: 'user',
        title: 'Новый пользователь',
        message: 'Зарегистрирован новый администратор: Иван Иванов',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        read: true,
        priority: 'low'
      },
      {
        id: '5',
        type: 'system',
        title: 'Системное обновление',
        message: 'Доступна новая версия платформы 2.1.0',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        read: false,
        priority: 'critical'
      }
    ]
    setNotifications(mockNotifications)
  }, [])

  const getNotificationIcon = (type: string) => {
    const iconMap = {
      order: <ShoppingCart />,
      inventory: <Inventory />,
      revenue: <TrendingUp />,
      user: <Person />,
      system: <Settings />
    }
    return iconMap[type as keyof typeof iconMap] || <Info />
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'error'
      case 'high': return 'warning'
      case 'medium': return 'info'
      case 'low': return 'success'
      default: return 'default'
    }
  }

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }

  const handleMarkAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    )
  }

  const handleRemoveNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  const filteredNotifications = showOnlyUnread 
    ? notifications.filter(n => !n.read)
    : notifications

  const unreadCount = notifications.filter(n => !n.read).length

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'только что'
    if (diffMins < 60) return `${diffMins} мин назад`
    if (diffHours < 24) return `${diffHours} ч назад`
    return `${diffDays} дн назад`
  }

  const headerAction = (
    <Box display="flex" alignItems="center" gap={1}>
      <Badge badgeContent={unreadCount} color="error">
        <NotificationsActive />
      </Badge>
      
      <IconButton size="small" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
        <MarkEmailRead />
      </IconButton>
    </Box>
  )

  return (
    <DashboardWidget
      id="notifications"
      title="Уведомления"
      subtitle={`${unreadCount} непрочитанных`}
      icon={<Notifications />}
      onRefresh={onRefresh}
      onSettings={onSettings}
      showRefresh
      showSettings
      showFullscreen
      size="medium"
      status={unreadCount > 0 ? 'warning' : undefined}
      headerAction={headerAction}
    >
      <Box>
        {/* Controls */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showOnlyUnread}
                onChange={(e) => setShowOnlyUnread(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption">
                Только непрочитанные
              </Typography>
            }
          />

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption">
                Звук
              </Typography>
            }
          />
        </Box>

        <Divider sx={{ mb: 1 }} />

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="center" 
            height={150}
            color="text.secondary"
          >
            <Typography variant="body2">
              {showOnlyUnread ? 'Нет непрочитанных уведомлений' : 'Нет уведомлений'}
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ maxHeight: 280, overflow: 'auto' }}>
            {filteredNotifications.slice(0, 10).map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{ 
                    px: 0,
                    py: 1,
                    bgcolor: !notification.read ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                    mb: 0.5
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      variant="dot"
                      invisible={notification.read}
                      color={getPriorityColor(notification.priority) as any}
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                      <Avatar 
                        sx={{ 
                          width: 36, 
                          height: 36,
                          bgcolor: `${getPriorityColor(notification.priority)}.main`
                        }}
                      >
                        {getNotificationIcon(notification.type)}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography 
                          variant="body2" 
                          fontWeight={!notification.read ? 'medium' : 'normal'}
                          noWrap
                        >
                          {notification.title}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Chip
                            label={notification.priority}
                            size="small"
                            color={getPriorityColor(notification.priority) as any}
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveNotification(notification.id)}
                          >
                            <Clear fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {notification.message}
                        </Typography>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            {formatTimeAgo(notification.timestamp)}
                          </Typography>
                          <Box display="flex" gap={1}>
                            {!notification.read && (
                              <Button
                                size="small"
                                onClick={() => handleMarkAsRead(notification.id)}
                              >
                                Отметить прочитанным
                              </Button>
                            )}
                            {notification.action && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={notification.action.callback}
                              >
                                {notification.action.label}
                              </Button>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                
                {index < filteredNotifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}

        {filteredNotifications.length > 10 && (
          <Box mt={2}>
            <Button fullWidth variant="text" size="small">
              Показать все ({filteredNotifications.length - 10} еще)
            </Button>
          </Box>
        )}
      </Box>
    </DashboardWidget>
  )
}

export default NotificationsWidget
