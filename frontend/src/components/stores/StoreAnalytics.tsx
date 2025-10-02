import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  CircularProgress,
  Chip,
  Avatar,
  LinearProgress,
  Divider,
  Button,
  Tabs,
  Tab,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Receipt,
  Inventory,
  People,
  ShoppingCart,
  Timeline,
  BarChart,
  TableChart,
} from '@mui/icons-material'
import { Store } from '../../types'
import { storeService } from '../../services/storeService'
import { dashboardService, DashboardFilters } from '../../services/dashboardService'
import StorePerformanceCharts from './StorePerformanceCharts'

interface StoreAnalyticsProps {
  store: Store
  period?: 'today' | 'week' | 'month' | 'quarter'
}

interface StoreStats {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  activeProducts: number
  avgOrderValue: number
  conversionRate: number
  recentRevenueChange: number
  recentOrdersChange: number
  topProducts: Array<{
    id: string
    name: string
    revenue: number
    quantity: number
  }>
  orderStatusStats: Record<string, number>
}

const StoreAnalytics: React.FC<StoreAnalyticsProps> = ({ store, period = 'month' }) => {
  const [stats, setStats] = useState<StoreStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    loadAnalytics()
  }, [store.id, period])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const filters: DashboardFilters = {
        storeId: store.id,
        period,
      }

      const [
        storeStats,
        topProducts,
        orderStatusStats,
        comparisonData,
      ] = await Promise.all([
        storeService.getStoreStats(store.id),
        dashboardService.getTopProducts({ ...filters, limit: 5 }),
        dashboardService.getOrderStatusStats(filters),
        dashboardService.getComparisonData(filters),
      ])

      setStats({
        totalRevenue: storeStats?.totalRevenue || 0,
        totalOrders: storeStats?.totalOrders || 0,
        totalProducts: store._count?.products || 0,
        activeProducts: storeStats?.activeProducts || 0,
        avgOrderValue: storeStats?.avgOrderValue || 0,
        conversionRate: storeStats?.conversionRate || 0,
        recentRevenueChange: comparisonData?.revenueChange || 0,
        recentOrdersChange: comparisonData?.ordersChange || 0,
        topProducts: topProducts.map(p => ({
          id: p.id,
          name: p.name,
          revenue: p.revenue,
          quantity: p.quantity,
        })),
        orderStatusStats,
      })
    } catch (error) {
      console.error('Error loading analytics:', error)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      RUB: '₽',
      UAH: '₴',
      KZT: '₸',
    }
    return `${symbols[store.currency] || store.currency} ${amount.toLocaleString()}`
  }

  const formatPercentChange = (change: number) => {
    const isPositive = change >= 0
    return (
      <Box display="flex" alignItems="center" gap={0.5}>
        {isPositive ? (
          <TrendingUp color="success" fontSize="small" />
        ) : (
          <TrendingDown color="error" fontSize="small" />
        )}
        <Typography
          variant="body2"
          color={isPositive ? 'success.main' : 'error.main'}
          fontWeight="medium"
        >
          {isPositive ? '+' : ''}{change.toFixed(1)}%
        </Typography>
      </Box>
    )
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary'> = {
      PENDING_ADMIN: 'warning',
      PAID: 'success',
      REJECTED: 'error',
      CANCELLED: 'primary',
      SHIPPED: 'info',
      DELIVERED: 'success',
    }
    return colors[status] || 'primary'
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent>
          <Typography color="error" align="center">
            Ошибка загрузки аналитики
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box>
      {/* Tabs for different views */}
      <Box mb={3}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab icon={<TableChart />} label="Сводка" />
          <Tab icon={<BarChart />} label="Графики" />
        </Tabs>
      </Box>

      {activeTab === 0 ? (
        <Box>
          {/* Key Metrics */}
          <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar
                  sx={{
                    bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                    color: theme => theme.palette.primary.contrastText,
                    border: theme => `1px solid ${theme.palette.primary.main}`,
                  }}
                >
                  <AttachMoney />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="body2" color="text.secondary">
                    Общая выручка
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {formatCurrency(stats.totalRevenue)}
                  </Typography>
                  {formatPercentChange(stats.recentRevenueChange)}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar
                  sx={{
                    bgcolor: theme => theme.palette.mode === 'dark' ? 'success.dark' : 'success.light',
                    color: theme => theme.palette.success.contrastText,
                    border: theme => `1px solid ${theme.palette.success.main}`,
                  }}
                >
                  <Receipt />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="body2" color="text.secondary">
                    Всего заказов
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {stats.totalOrders}
                  </Typography>
                  {formatPercentChange(stats.recentOrdersChange)}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar
                  sx={{
                    bgcolor: theme => theme.palette.mode === 'dark' ? 'info.dark' : 'info.light',
                    color: theme => theme.palette.info.contrastText,
                    border: theme => `1px solid ${theme.palette.info.main}`,
                  }}
                >
                  <ShoppingCart />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="body2" color="text.secondary">
                    Средний чек
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {formatCurrency(stats.avgOrderValue)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar
                  sx={{
                    bgcolor: theme => theme.palette.mode === 'dark' ? 'warning.dark' : 'warning.light',
                    color: theme => theme.palette.warning.contrastText,
                    border: theme => `1px solid ${theme.palette.warning.main}`,
                  }}
                >
                  <Timeline />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="body2" color="text.secondary">
                    Конверсия
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {stats.conversionRate.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Product Stats */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <Inventory />
                Товары
              </Typography>
              
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Всего товаров</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {stats.totalProducts}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={2}>
                  <Typography variant="body2">Активных</Typography>
                  <Typography variant="body2" fontWeight="medium" color="success.main">
                    {stats.activeProducts}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats.totalProducts > 0 ? (stats.activeProducts / stats.totalProducts) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Топ товары
              </Typography>
              {stats.topProducts.length > 0 ? (
                stats.topProducts.map((product, index) => (
                  <Box key={product.id} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {index + 1}. {product.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Продано: {product.quantity} шт.
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="medium" color="primary.main">
                      {formatCurrency(product.revenue)}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" py={2}>
                  Нет данных о продажах
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Order Status Stats */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <Receipt />
                Статусы заказов
              </Typography>

              {Object.entries(stats.orderStatusStats).length > 0 ? (
                Object.entries(stats.orderStatusStats).map(([status, count]) => {
                  const statusLabels: Record<string, string> = {
                    PENDING_ADMIN: 'Ожидает подтверждения',
                    PAID: 'Оплачено',
                    REJECTED: 'Отклонено',
                    CANCELLED: 'Отменено',
                    SHIPPED: 'Отправлено',
                    DELIVERED: 'Доставлено',
                  }
                  
                  const percentage = stats.totalOrders > 0 ? (count / stats.totalOrders) * 100 : 0
                  
                  return (
                    <Box key={status} mb={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Chip 
                          label={statusLabels[status] || status}
                          color={getStatusColor(status)}
                          size="small"
                        />
                        <Typography variant="body2" fontWeight="medium">
                          {count} ({percentage.toFixed(1)}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        color={getStatusColor(status)}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  )
                })
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" py={4}>
                  Нет данных о заказах
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
          </Grid>
        </Box>
      ) : (
        <StorePerformanceCharts store={store} />
      )}
    </Box>
  )
}

export default StoreAnalytics
