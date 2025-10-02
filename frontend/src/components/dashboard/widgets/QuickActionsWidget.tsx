import React from 'react'
import {
  Box,
  Button,
  Grid,
  Typography,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material'
import {
  Add,
  Receipt,
  Inventory,
  Person,
  Store,
  Analytics,
  Notifications,
  Settings,
  TrendingUp,
  ShoppingCart,
} from '@mui/icons-material'
import { useAuth } from '../../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import DashboardWidget from '../DashboardWidget'

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  action: () => void
  permissions?: string[]
  shortcut?: string
}

interface QuickActionsWidgetProps {
  onRefresh?: () => void
  onSettings?: () => void
}

const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({
  onRefresh,
  onSettings,
}) => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const quickActions: QuickAction[] = [
    {
      id: 'create-store',
      label: 'Создать магазин',
      icon: <Store />,
      color: 'primary',
      action: () => navigate('/stores?create=true'),
      permissions: ['OWNER', 'ADMIN'],
      shortcut: 'Ctrl+S'
    },
    {
      id: 'add-product',
      label: 'Добавить товар',
      icon: <Inventory />,
      color: 'success',
      action: () => navigate('/products?create=true'),
      shortcut: 'Ctrl+P'
    },
    {
      id: 'view-orders',
      label: 'Заказы',
      icon: <Receipt />,
      color: 'info',
      action: () => navigate('/orders'),
      shortcut: 'Ctrl+O'
    },
    {
      id: 'add-user',
      label: 'Пригласить пользователя',
      icon: <Person />,
      color: 'secondary',
      action: () => navigate('/users?create=true'),
      permissions: ['OWNER'],
      shortcut: 'Ctrl+U'
    },
    {
      id: 'analytics',
      label: 'Аналитика',
      icon: <Analytics />,
      color: 'warning',
      action: () => navigate('/reports'),
    },
    {
      id: 'settings',
      label: 'Настройки',
      icon: <Settings />,
      color: 'info',
      action: () => navigate('/settings'),
    }
  ]

  const recentActivity = [
    {
      id: '1',
      type: 'order',
      message: 'Новый заказ #12345',
      time: '5 мин назад',
      icon: <ShoppingCart color="primary" />,
      action: () => navigate('/orders/12345')
    },
    {
      id: '2', 
      type: 'product',
      message: 'Товар "iPhone 15" заканчивается',
      time: '15 мин назад',
      icon: <Inventory color="warning" />,
      action: () => navigate('/products/iphone-15')
    },
    {
      id: '3',
      type: 'revenue',
      message: 'Выручка за день: +15%',
      time: '1 час назад',
      icon: <TrendingUp color="success" />,
      action: () => navigate('/reports')
    }
  ]

  const filteredActions = quickActions.filter(action => 
    !action.permissions || 
    action.permissions.includes(user?.role || 'CUSTOMER')
  )

  return (
    <DashboardWidget
      id="quick-actions"
      title="Быстрые действия"
      subtitle="Часто используемые функции"
      icon={<TrendingUp />}
      onRefresh={onRefresh}
      onSettings={onSettings}
      showRefresh
      showSettings
      showFullscreen
      size="medium"
    >
      <Box>
        {/* Quick Action Buttons */}
        <Grid container spacing={2} mb={3}>
          {filteredActions.slice(0, 4).map((action) => (
            <Grid item xs={6} key={action.id}>
              <Button
                fullWidth
                variant="outlined"
                color={action.color}
                startIcon={action.icon}
                onClick={action.action}
                sx={{ 
                  py: 1.5,
                  flexDirection: 'column',
                  height: '80px',
                  '& .MuiButton-startIcon': {
                    mb: 0.5,
                    mr: 0
                  }
                }}
              >
                <Typography variant="caption" noWrap>
                  {action.label}
                </Typography>
                {action.shortcut && (
                  <Chip 
                    label={action.shortcut} 
                    size="small" 
                    variant="outlined"
                    sx={{ mt: 0.5, fontSize: '0.65rem', height: 20 }}
                  />
                )}
              </Button>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Recent Activity */}
        <Typography variant="subtitle2" gutterBottom>
          Последняя активность
        </Typography>
        
        <List dense>
          {recentActivity.map((activity) => (
            <ListItem 
              key={activity.id}
              button
              onClick={activity.action}
              sx={{ px: 0, py: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {activity.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" noWrap>
                    {activity.message}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {activity.time}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>

        {/* Additional Quick Actions */}
        {filteredActions.length > 4 && (
          <Box mt={2}>
            <Button
              fullWidth
              variant="text"
              size="small"
              onClick={() => navigate('/quick-actions')}
            >
              Показать все действия ({filteredActions.length - 4})
            </Button>
          </Box>
        )}
      </Box>
    </DashboardWidget>
  )
}

export default QuickActionsWidget
