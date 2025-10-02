import React, { useState, useEffect } from 'react'
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Avatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material'
import {
  Store,
  Inventory,
  Receipt,
  AttachMoney,
  Pending,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Person,
  Refresh,
  DateRange,
  DarkMode,
  LightMode,
} from '@mui/icons-material'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { dashboardService, DashboardFilters } from '../services/dashboardService'
import { orderService } from '../services/orderService'
import { storeService } from '../services/storeService'
import { DashboardStats, Order, Store as StoreType } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { useDashboardRealTime } from '../hooks/useRealTimeUpdates'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import SectionCard from '../components/ui/SectionCard'
import LoadingSkeleton from '../components/ui/LoadingSkeleton'
import { useChartColors, getChartThemeProps } from '../utils/chartTheme'
import { useTheme } from '@mui/material/styles'
import { useThemeMode } from '../contexts/ThemeModeContext'


const DashboardPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()
  const { mode, toggleMode } = useThemeMode()
  const chartColors = useChartColors()
  const chartTheme = getChartThemeProps(theme)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [topStores, setTopStores] = useState<any[]>([])
  const [stores, setStores] = useState<StoreType[]>([])
  const [comparison, setComparison] = useState<any>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'quarter'>('month')
  const [selectedStore, setSelectedStore] = useState<string>('all')

  const periods = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'quarter', label: 'Квартал' },
  ]

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const filters: DashboardFilters = {
        period: selectedPeriod,
        storeId: selectedStore === 'all' ? undefined : selectedStore,
      }

      // Загружаем все данные параллельно
      const [
        statsData,
        ordersData,
        revenueChartData,
        topProductsData,
        topStoresData,
        storesData,
        comparisonData,
      ] = await Promise.allSettled([
        dashboardService.getStats(filters),
        dashboardService.getRecentOrders(10, filters.storeId),
        dashboardService.getRevenueData(filters),
        dashboardService.getTopProducts({ ...filters, limit: 5 }),
        user?.role === 'OWNER' ? dashboardService.getTopStores({ ...filters, limit: 5 }) : Promise.resolve([]),
        user?.role === 'OWNER' ? storeService.getStores({ limit: 100 }) : Promise.resolve({ items: [] }),
        dashboardService.getComparisonData(filters),
      ])

      // Обрабатываем результаты
      if (statsData.status === 'fulfilled') setStats(statsData.value)
      if (ordersData.status === 'fulfilled') setRecentOrders(ordersData.value)
      if (revenueChartData.status === 'fulfilled') setRevenueData(revenueChartData.value)
      if (topProductsData.status === 'fulfilled') setTopProducts(topProductsData.value)
      if (topStoresData.status === 'fulfilled') setTopStores(topStoresData.value)
      if (storesData.status === 'fulfilled') setStores(storesData.value.items || [])
      if (comparisonData.status === 'fulfilled') setComparison(comparisonData.value)

    } catch (error: any) {
      toast.error('Ошибка при загрузке данных дашборда')
      console.error('Dashboard loading error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [selectedPeriod, selectedStore])

  // Real-time updates
  useDashboardRealTime(loadDashboardData)

  const formatCurrency = (amount: number, currency: string = 'RUB') => {
    const currencyMap: Record<string, string> = {
      USD: '$',
      EUR: '€',
      RUB: '₽',
      UAH: '₴',
      KZT: '₸',
    }
    return `${amount.toLocaleString()} ${currencyMap[currency] || currency}`
  }

  const getStatusChip = (status: string) => {
    const statusConfig = {
      PENDING_ADMIN: { label: 'Ожидает', color: 'warning' as const },
      PAID: { label: 'Оплачен', color: 'success' as const },
      REJECTED: { label: 'Отклонен', color: 'error' as const },
      CANCELLED: { label: 'Отменен', color: 'default' as const },
      SHIPPED: { label: 'Отправлен', color: 'info' as const },
      DELIVERED: { label: 'Доставлен', color: 'success' as const },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, color: 'default' as const }
    return <Chip label={config.label} color={config.color} size="small" />
  }


  if (loading && !stats) {
    return (
      <Box>
        <PageHeader title="Панель управления" subtitle="Обзор производительности вашего бизнеса" />
        <LoadingSkeleton variant="stats" count={5} />
        <Box sx={{ mt: 3 }}>
          <LoadingSkeleton variant="chart" />
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Панель управления"
        subtitle="Обзор производительности вашего бизнеса"
        actions={
          <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Период</InputLabel>
            <Select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              label="Период"
            >
              {periods.map((period) => (
                <MenuItem key={period.value} value={period.value}>
                  {period.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {user?.role === 'OWNER' && stores.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Магазин</InputLabel>
              <Select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                label="Магазин"
              >
                <MenuItem value="all">Все магазины</MenuItem>
                {stores.map((store) => (
                  <MenuItem key={store.id} value={store.id}>
                    {store.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Button
            variant="outlined"
            startIcon={mode === 'dark' ? <LightMode /> : <DarkMode />}
            onClick={toggleMode}
            sx={{ mr: 1 }}
          >
            {mode === 'dark' ? 'Светлая' : 'Тёмная'} тема
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadDashboardData}
            disabled={loading}
          >
            Обновить
          </Button>
          </Box>
        }
      />
      
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Всего заказов"
            value={stats?.totalOrders || 0}
            icon={<Receipt />}
            color="primary"
            trend={comparison?.orders && {
              value: comparison.orders.percentChange,
              isPositive: comparison.orders.percentChange > 0,
              label: 'vs прошлый период'
            }}
            loading={!stats}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Ожидают подтверждения"
            value={stats?.pendingOrders || 0}
            icon={<Pending />}
            color="warning"
            loading={!stats}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Оплачено недавно"
            value={stats?.recentPaidOrders || 0}
            icon={<CheckCircle />}
            color="success"
            loading={!stats}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Общая выручка"
            value={formatCurrency(stats?.totalRevenue || 0)}
            icon={<AttachMoney />}
            color="success"
            trend={comparison?.revenue && {
              value: comparison.revenue.percentChange,
              isPositive: comparison.revenue.percentChange > 0,
              label: 'vs прошлый период'
            }}
            loading={!stats}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Активные магазины"
            value={stats?.activeStores || 0}
            icon={<Store />}
            color="info"
            loading={!stats}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Revenue Chart */}
        <Grid item xs={12} lg={8}>
          <SectionCard title="Динамика выручки">
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid {...chartTheme.cartesianGrid} />
                  <XAxis dataKey="date" {...chartTheme.xAxis} />
                  <YAxis {...chartTheme.yAxis} />
                  <Tooltip 
                    {...chartTheme.tooltip}
                    formatter={(value: any) => [formatCurrency(value), 'Выручка']}
                    labelFormatter={(label) => `Дата: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke={chartColors.chartPalette[0]} 
                    strokeWidth={3}
                    name="Выручка"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke={chartColors.chartPalette[1]} 
                    strokeWidth={3}
                    name="Заказы"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                <Typography color="text.secondary">Нет данных для отображения</Typography>
              </Box>
            )}
          </SectionCard>
        </Grid>

        {/* Top Products */}
        <Grid item xs={12} lg={4}>
          <SectionCard title="Популярные товары">
            {topProducts.length > 0 ? (
              <Box>
                {topProducts.map((product, index) => (
                  <Box key={product.id} display="flex" alignItems="center" gap={2} mb={2}>
                    <Typography variant="h6" color="primary" sx={{ minWidth: '20px' }}>
                      {index + 1}
                    </Typography>
                    <Box flex={1}>
                      <Typography variant="subtitle2" noWrap>
                        {product.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {product.store.name} • {product.quantity} продаж
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" color="success.main">
                      {formatCurrency(product.revenue)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary">Нет данных</Typography>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Orders */}
        <Grid item xs={12} md={8}>
          <SectionCard 
            title="Последние заказы"
            action={
              <Button 
                variant="outlined" 
                size="small"
                onClick={() => navigate('/orders')}
              >
                Все заказы
              </Button>
            }
          >
            {recentOrders.length > 0 ? (
              <Box>
                {recentOrders.map((order) => (
                  <Box
                    key={order.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 2,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      mb: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate('/orders')}
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                          color: theme => theme.palette.primary.contrastText,
                          border: theme => `1px solid ${theme.palette.primary.main}`,
                        }}
                      >
                        <Person />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1">
                          Заказ #{order.orderNumber}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {order.customerInfo?.name || 'Неизвестный покупатель'} • {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                        </Typography>
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={2} textAlign="right">
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {formatCurrency(order.totalAmount, order.currency)}
                        </Typography>
                        {getStatusChip(order.status)}
                      </Box>
                      {order.status === 'PENDING_ADMIN' && (
                        <Button 
                          variant="contained" 
                          size="small" 
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('/orders')
                          }}
                        >
                          Подтвердить
                        </Button>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Alert severity="info">
                Пока нет заказов. Они появятся здесь после оформления через Telegram бот.
              </Alert>
            )}
          </SectionCard>
        </Grid>
        
        {/* Quick Actions & Top Stores */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={3}>
            {/* Quick Actions */}
            <Grid item xs={12}>
              <SectionCard title="Быстрые действия">
                <Box display="flex" flexDirection="column" gap={2}>
                  <Button 
                    variant="contained" 
                    startIcon={<Store />} 
                    fullWidth
                    onClick={() => navigate('/stores')}
                  >
                    Управление магазинами
                  </Button>
                  <Button 
                    variant="outlined" 
                    startIcon={<Inventory />} 
                    fullWidth
                    onClick={() => navigate('/products')}
                  >
                    Управление товарами
                  </Button>
                  <Button 
                    variant="outlined" 
                    startIcon={<Receipt />} 
                    fullWidth
                    onClick={() => navigate('/orders')}
                  >
                    Просмотреть заказы
                  </Button>
                </Box>
              </SectionCard>
            </Grid>

            {/* Top Stores (only for owners) */}
            {user?.role === 'OWNER' && topStores.length > 0 && (
              <Grid item xs={12}>
                <SectionCard title="Лучшие магазины">
                  <Box>
                    {topStores.map((store, index) => (
                      <Box key={store.id} display="flex" alignItems="center" gap={2} mb={2}>
                        <Typography variant="h6" color="primary" sx={{ minWidth: '20px' }}>
                          {index + 1}
                        </Typography>
                        <Box flex={1}>
                          <Typography variant="subtitle2" noWrap>
                            {store.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {store.orders} заказов
                          </Typography>
                        </Box>
                        <Typography variant="subtitle2" color="success.main">
                          {formatCurrency(store.revenue)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </SectionCard>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  )
}

export default DashboardPage
