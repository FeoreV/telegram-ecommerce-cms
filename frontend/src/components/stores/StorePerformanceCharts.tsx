import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Chip,
  Avatar,
  Divider,
} from '@mui/material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Receipt,
  Timeline,
  Analytics,
} from '@mui/icons-material'
import { Store } from '../../types'
import { dashboardService, DashboardFilters, RevenueData } from '../../services/dashboardService'
import { toast } from 'react-toastify'

interface StorePerformanceChartsProps {
  store: Store
}

interface PerformanceData {
  revenue: RevenueData[]
  orderStatusDistribution: Array<{
    name: string
    value: number
    color: string
  }>
  monthlyComparison: Array<{
    month: string
    current: number
    previous: number
  }>
  trendData: {
    revenueGrowth: number
    orderGrowth: number
    avgOrderValueGrowth: number
  }
}

const StorePerformanceCharts: React.FC<StorePerformanceChartsProps> = ({ store }) => {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PerformanceData | null>(null)

  const statusColors: Record<string, string> = {
    PENDING_ADMIN: '#ff9800',
    PAID: '#4caf50',
    REJECTED: '#f44336',
    CANCELLED: '#9e9e9e',
    SHIPPED: '#2196f3',
    DELIVERED: '#8bc34a',
  }

  useEffect(() => {
    loadPerformanceData()
  }, [store.id, period])

  const loadPerformanceData = async () => {
    setLoading(true)
    try {
      const filters: DashboardFilters = {
        storeId: store.id,
        period,
      }

      const [
        revenueData,
        orderStatusStats,
        comparisonData,
      ] = await Promise.all([
        dashboardService.getRevenueData(filters),
        dashboardService.getOrderStatusStats(filters),
        dashboardService.getComparisonData(filters),
      ])

      // Transform order status stats for pie chart
      const orderStatusDistribution = Object.entries(orderStatusStats).map(([status, count]) => ({
        name: getStatusLabel(status),
        value: count,
        color: statusColors[status] || '#9e9e9e',
      }))

      const monthlyComparison = revenueData.slice(-6).map((item) => ({
        month: new Date(item.date).toLocaleDateString('ru-RU', { month: 'short' }),
        current: item.revenue,
        previous: item.orders ? item.revenue - (item.orders * 0.1) : item.revenue,
      }))

      setData({
        revenue: revenueData,
        orderStatusDistribution,
        monthlyComparison,
        trendData: {
          revenueGrowth: comparisonData?.revenueChange || 0,
          orderGrowth: comparisonData?.ordersChange || 0,
          avgOrderValueGrowth: comparisonData?.avgOrderValueChange || 0,
        },
      })
    } catch (error) {
      toast.error('Не удалось загрузить данные производительности магазина')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      PENDING_ADMIN: 'Ожидает',
      PAID: 'Оплачено',
      REJECTED: 'Отклонено',
      CANCELLED: 'Отменено',
      SHIPPED: 'Отправлено',
      DELIVERED: 'Доставлено',
    }
    return labels[status] || status
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

  const formatTrend = (change: number) => {
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

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent>
          <Typography color="error" align="center">
            Ошибка загрузки данных производительности
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box>
      {/* Header with period selector */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar
            sx={{
              bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
              color: theme => theme.palette.primary.contrastText,
              border: theme => `1px solid ${theme.palette.primary.main}`,
            }}
          >
            <Analytics />
          </Avatar>
          <Box>
            <Typography variant="h6">
              Метрики производительности
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {store.name}
            </Typography>
          </Box>
        </Box>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Период</InputLabel>
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            label="Период"
          >
            <MenuItem value="week">Неделя</MenuItem>
            <MenuItem value="month">Месяц</MenuItem>
            <MenuItem value="quarter">Квартал</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={4}>
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
                  <AttachMoney />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="body2" color="text.secondary">
                    Рост выручки
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {formatCurrency(data.revenue.reduce((sum, item) => sum + item.revenue, 0))}
                  </Typography>
                  {formatTrend(data.trendData.revenueGrowth)}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
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
                  <Receipt />
                </Avatar>
                <Box flex={1}>
                  <Typography variant="body2" color="text.secondary">
                    Рост заказов
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {data.revenue.reduce((sum, item) => sum + item.orders, 0)}
                  </Typography>
                  {formatTrend(data.trendData.orderGrowth)}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
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
                    Средний чек
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {formatCurrency(data.trendData.avgOrderValueGrowth > 0 ? 
                      data.revenue.reduce((sum, item) => sum + item.revenue, 0) / 
                      Math.max(data.revenue.reduce((sum, item) => sum + item.orders, 0), 1) : 0)}
                  </Typography>
                  {formatTrend(data.trendData.avgOrderValueGrowth)}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Revenue Trend Chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Динамика выручки
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                  />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString('ru-RU')}
                    formatter={(value: number) => [formatCurrency(value), 'Выручка']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#1976d2" 
                    fill="#1976d2" 
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Status Distribution */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Статусы заказов
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.orderStatusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.orderStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
              <Box mt={2}>
                {data.orderStatusDistribution.map((item, index) => (
                  <Box key={index} display="flex" justifyContent="space-between" alignItems="center" py={0.5}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box 
                        width={12} 
                        height={12} 
                        borderRadius="50%" 
                        bgcolor={item.color}
                      />
                      <Typography variant="body2">
                        {item.name}
                      </Typography>
                    </Box>
                    <Chip label={item.value} size="small" />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Comparison */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Сравнение с предыдущим периодом
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.monthlyComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="previous" fill="#e0e0e0" name="Предыдущий период" />
                  <Bar dataKey="current" fill="#1976d2" name="Текущий период" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default StorePerformanceCharts
