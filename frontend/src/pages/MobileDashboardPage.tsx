import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Chip,
  Avatar,
  LinearProgress,
  Skeleton,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Store,
  Receipt,
  People,
  Add,
  Refresh,
  Notifications,
  Assessment,
  Warning,
  CheckCircle,
} from '@mui/icons-material'
import { useQuery } from 'react-query'
import useMobileOptimizations, { useLazyLoading } from '../hooks/useMobileOptimizations'
import MobileCard from '../components/mobile/MobileCard'
import SwipeableCard from '../components/mobile/SwipeableCard'
import { useAuth } from '../contexts/AuthContext'
import { dashboardService } from '../services/dashboardService'

interface DashboardStatsExtended {
  totalRevenue: number
  totalOrders: number
  totalProducts?: number
  totalStores?: number
  revenueChange?: number
  ordersChange?: number
  pendingOrders: number
  lowStockProducts?: number
  activeStores?: number
  recentPaidOrders?: number
}

const MobileDashboardPage: React.FC = () => {
  const { user } = useAuth()
  const { 
    isMobile, 
    shouldReduceAnimations, 
    touchFriendlySize, 
    optimalSpacing,
    maxItemsPerPage 
  } = useMobileOptimizations()
  
  const [refreshing, setRefreshing] = useState(false)
  const { isVisible: statsVisible, elementRef: statsRef } = useLazyLoading()
  const { isVisible: chartsVisible, elementRef: chartsRef } = useLazyLoading()

  const { data: dashboardData, isLoading, refetch } = useQuery(
    'mobile-dashboard',
    () => dashboardService.getStats(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 10000, // Consider data stale after 10 seconds
    }
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setTimeout(() => setRefreshing(false), 1000) // Visual feedback
  }

  const stats: DashboardStatsExtended = dashboardData ? {
    totalRevenue: dashboardData.totalRevenue || 0,
    totalOrders: dashboardData.totalOrders || 0,
    totalProducts: 0, // Not available in backend API
    totalStores: dashboardData.activeStores || 0,
    revenueChange: 0, // Calculate from comparison if needed
    ordersChange: 0, // Calculate from comparison if needed
    pendingOrders: dashboardData.pendingOrders || 0,
    lowStockProducts: 0, // Not available in backend API
    activeStores: dashboardData.activeStores || 0,
    recentPaidOrders: dashboardData.recentPaidOrders || 0,
  } : {
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalStores: 0,
    revenueChange: 0,
    ordersChange: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
    activeStores: 0,
    recentPaidOrders: 0,
  }

  const quickActions = [
    {
      icon: <Add />,
      name: 'Добавить товар',
      onClick: () => {},
    },
    {
      icon: <Receipt />,
      name: 'Новый заказ',
      onClick: () => {},
    },
    {
      icon: <Assessment />,
      name: 'Отчеты',
      onClick: () => {},
    },
  ]

  const StatCard: React.FC<{
    title: string
    value: string | number
    change?: number
    icon: React.ReactNode
    color: string
    loading?: boolean
  }> = ({ title, value, change, icon, color, loading }) => {
    if (loading) {
      return (
        <Card sx={{ height: 120 }}>
          <CardContent>
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="80%" height={32} />
            <Skeleton variant="circular" width={40} height={40} sx={{ float: 'right', mt: -5 }} />
          </CardContent>
        </Card>
      )
    }

    return (
      <MobileCard
        title={title}
        interactive={false}
        dense
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" fontWeight={700} color={color}>
              {value}
            </Typography>
            {change !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                {change >= 0 ? (
                  <TrendingUp fontSize="small" color="success" />
                ) : (
                  <TrendingDown fontSize="small" color="error" />
                )}
                <Typography
                  variant="caption"
                  color={change >= 0 ? 'success.main' : 'error.main'}
                  fontWeight={600}
                >
                  {change >= 0 ? '+' : ''}{change}%
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>
            {icon}
          </Avatar>
        </Box>
      </MobileCard>
    )
  }

  const AlertCard: React.FC<{
    title: string
    count: number
    severity: 'warning' | 'error' | 'info'
    icon: React.ReactNode
    onTap: () => void
  }> = ({ title, count, severity, icon, onTap }) => {
    const colors = {
      warning: { bg: 'warning.light', text: 'warning.dark' },
      error: { bg: 'error.light', text: 'error.dark' },
      info: { bg: 'info.light', text: 'info.dark' },
    }

    return (
      <SwipeableCard
        rightActions={[
          {
            icon: <CheckCircle />,
            label: 'Просмотрено',
            color: '#fff',
            backgroundColor: '#2e7d32', // success.main default
            onAction: () => {},
          }
        ]}
      >
        <Card
          sx={{
            bgcolor: colors[severity].bg,
            cursor: 'pointer',
            minHeight: touchFriendlySize * 1.5,
          }}
          onClick={onTap}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: colors[severity].text, color: 'white' }}>
                {icon}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {title}
                </Typography>
                <Typography variant="h6" color={colors[severity].text}>
                  {count} {count === 1 ? 'элемент' : 'элементов'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </SwipeableCard>
    )
  }

  return (
    <Box sx={{ pb: 2 }}>
      {/* Welcome Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Добро пожаловать, {user?.firstName || user?.username}!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Вот краткий обзор вашего бизнеса
        </Typography>
      </Box>

      {/* Pull to Refresh Indicator */}
      {refreshing && (
        <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
      )}

      {/* Main Stats */}
      <Box ref={statsRef}>
        {statsVisible && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6}>
              <StatCard
                title="Выручка"
                value={`₽${stats.totalRevenue.toLocaleString()}`}
                change={stats.revenueChange}
                icon={<TrendingUp />}
                color="primary.main"
                loading={isLoading}
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                title="Заказы"
                value={stats.totalOrders}
                change={stats.ordersChange}
                icon={<Receipt />}
                color="secondary.main"
                loading={isLoading}
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                title="Товары"
                value={stats.totalProducts}
                icon={<ShoppingCart />}
                color="success.main"
                loading={isLoading}
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                title="Магазины"
                value={stats.totalStores}
                icon={<Store />}
                color="info.main"
                loading={isLoading}
              />
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Alerts Section */}
      {(stats.pendingOrders > 0 || stats.lowStockProducts > 0) && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Требует внимания
          </Typography>
          
          {stats.pendingOrders > 0 && (
            <Box sx={{ mb: 2 }}>
              <AlertCard
                title="Ожидающие заказы"
                count={stats.pendingOrders}
                severity="warning"
                icon={<Receipt />}
                onTap={() => {}}
              />
            </Box>
          )}
          
          {stats.lowStockProducts > 0 && (
            <Box sx={{ mb: 2 }}>
              <AlertCard
                title="Товары заканчиваются"
                count={stats.lowStockProducts}
                severity="error"
                icon={<Warning />}
                onTap={() => {}}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Recent Activity */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Последняя активность
        </Typography>
        
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} sx={{ mb: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Skeleton variant="circular" width={40} height={40} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="70%" />
                    <Skeleton variant="text" width="50%" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))
        ) : (
          <MobileCard
            title="Новый заказ #12345"
            subtitle="2 минуты назад"
            description="Заказ на сумму ₽2,500 от @username"
            avatar={<Receipt />}
            status={{ label: 'Новый', color: 'info' }}
            actions={[
              {
                icon: <CheckCircle />,
                label: 'Обработать',
                onClick: () => {},
                color: 'success',
              }
            ]}
            dense
          />
        )}
      </Box>

      {/* Quick Actions Speed Dial */}
      <SpeedDial
        ariaLabel="Быстрые действия"
        sx={{ position: 'fixed', bottom: 80, right: 16 }}
        icon={<SpeedDialIcon />}
        direction="up"
      >
        {quickActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
          />
        ))}
      </SpeedDial>

      {/* Refresh FAB */}
      <Fab
        color="primary"
        size="medium"
        onClick={handleRefresh}
        disabled={refreshing}
        sx={{
          position: 'fixed',
          bottom: 160,
          right: 16,
          zIndex: 1000,
        }}
      >
        <Refresh sx={{ 
          animation: refreshing ? 'spin 1s linear infinite' : 'none',
          '@keyframes spin': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' },
          }
        }} />
      </Fab>
    </Box>
  )
}

export default MobileDashboardPage
