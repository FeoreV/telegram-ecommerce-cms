import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ButtonGroup,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Tooltip,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  AttachMoney,
  LocalShipping,
  CheckCircle,
  Store as StoreIcon,
  Person,
  Timeline,
  Assessment,
} from '@mui/icons-material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { orderService } from '../../services/orderService'
import { storeService } from '../../services/storeService'
import { Store } from '../../types'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  color: 'primary' | 'success' | 'info' | 'warning' | 'error'
  loading?: boolean
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  changeLabel,
  icon,
  color,
  loading = false
}) => {
  const getTrendIcon = () => {
    if (change === undefined) return null
    return change >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />
  }

  const getTrendColor = () => {
    if (change === undefined) return 'text.secondary'
    return change >= 0 ? 'success.main' : 'error.main'
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant="h4" fontWeight="bold">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </Typography>
            )}
            {change !== undefined && (
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                {getTrendIcon()}
                <Typography variant="body2" color={getTrendColor()}>
                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  {changeLabel && ` ${changeLabel}`}
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar
            sx={{
              bgcolor: theme => theme.palette.mode === 'dark' ? `${color}.dark` : `${color}.light`,
              color: theme => theme.palette[color].contrastText,
              border: theme => `1px solid ${theme.palette[color].main}`,
              width: 56,
              height: 56,
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  )
}

interface AnalyticsData {
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  conversionRate: number
  topProducts: any[]
  ordersByStatus: any[]
  dailyOrders: any[]
  dailyRevenue: any[]
  ordersByStore: any[]
  trends: {
    ordersChange: number
    revenueChange: number
    aovChange: number
    conversionChange: number
  }
}

const OrderAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [selectedStore, setSelectedStore] = useState<string>('all')
  const [stores, setStores] = useState<Store[]>([])
  const [data, setData] = useState<AnalyticsData>({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    topProducts: [],
    ordersByStatus: [],
    dailyOrders: [],
    dailyRevenue: [],
    ordersByStore: [],
    trends: {
      ordersChange: 0,
      revenueChange: 0,
      aovChange: 0,
      conversionChange: 0,
    }
  })

  useEffect(() => {
    loadData()
  }, [period, selectedStore])

  useEffect(() => {
    loadStores()
  }, [])

  const loadStores = async () => {
    try {
      const response = await storeService.getStores({ limit: 100 })
      setStores(response.items || [])
    } catch (error) {
      console.error('Error loading stores:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Get period dates
      const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const endDate = new Date()
      const startDate = subDays(endDate, periodDays)

      // Load analytics data
      const stats = await orderService.getOrderStats(
        selectedStore === 'all' ? undefined : selectedStore,
        period
      )

      // Generate mock daily data for demonstration
      const dailyData = generateDailyData(startDate, endDate)
      
      setData({
        totalOrders: Number(stats?.totalOrders) || 0,
        totalRevenue: Number(stats?.totalRevenue) || 0,
        averageOrderValue: Number(stats?.averageOrderValue) || 0,
        conversionRate: Number(stats?.conversionRate) || 0,
        topProducts: Array.isArray(stats?.topProducts) ? stats.topProducts : [],
        ordersByStatus: Object.entries((stats?.statusCounts as Record<string, number>) || {}).map(([status, count]) => ({
          name: getStatusLabel(status),
          value: count,
          fill: getStatusColor(status)
        })),
        dailyOrders: dailyData.orders,
        dailyRevenue: dailyData.revenue,
        ordersByStore: Array.isArray(stats?.storeStats) ? stats.storeStats : [],
        trends: {
          ordersChange: Math.random() * 20 - 10, // Mock data
          revenueChange: Math.random() * 30 - 15,
          aovChange: Math.random() * 10 - 5,
          conversionChange: Math.random() * 5 - 2.5,
        }
      })
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateDailyData = (startDate: Date, endDate: Date) => {
    const days = []
    const orders = []
    const revenue = []
    
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dayLabel = format(currentDate, 'dd.MM')
      const orderCount = Math.floor(Math.random() * 50) + 10
      const dailyRevenue = orderCount * (Math.random() * 100 + 50)
      
      days.push(dayLabel)
      orders.push({
        date: dayLabel,
        orders: orderCount,
        fullDate: format(currentDate, 'dd MMMM yyyy', { locale: ru })
      })
      revenue.push({
        date: dayLabel,
        revenue: dailyRevenue,
        fullDate: format(currentDate, 'dd MMMM yyyy', { locale: ru })
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return { orders, revenue }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING_ADMIN: 'Ожидают',
      PAID: 'Оплачены',
      SHIPPED: 'Отправлены',
      DELIVERED: 'Доставлены',
      REJECTED: 'Отклонены',
      CANCELLED: 'Отменены'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING_ADMIN: '#ff9800',
      PAID: '#4caf50',
      SHIPPED: '#2196f3',
      DELIVERED: '#8bc34a',
      REJECTED: '#f44336',
      CANCELLED: '#9e9e9e'
    }
    return colors[status] || '#9e9e9e'
  }

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString()} ₽`
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Typography key={index} variant="body2" sx={{ color: entry.color }}>
              {entry.dataKey === 'revenue' ? formatCurrency(entry.value) : entry.value}
            </Typography>
          ))}
        </Paper>
      )
    }
    return null
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Аналитика заказов
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Детальная статистика и тренды
          </Typography>
        </Box>
        
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Период</InputLabel>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              label="Период"
            >
              <MenuItem value="7d">7 дней</MenuItem>
              <MenuItem value="30d">30 дней</MenuItem>
              <MenuItem value="90d">90 дней</MenuItem>
            </Select>
          </FormControl>
          
          {stores.length > 0 && (
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
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Всего заказов"
            value={data.totalOrders}
            change={data.trends.ordersChange}
            changeLabel="за период"
            icon={<ShoppingCart />}
            color="primary"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Общая выручка"
            value={formatCurrency(data.totalRevenue)}
            change={data.trends.revenueChange}
            changeLabel="за период"
            icon={<AttachMoney />}
            color="success"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Средний чек"
            value={formatCurrency(data.averageOrderValue)}
            change={data.trends.aovChange}
            icon={<TrendingUp />}
            color="info"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Конверсия"
            value={`${data.conversionRate.toFixed(1)}%`}
            change={data.trends.conversionChange}
            icon={<Assessment />}
            color="warning"
            loading={loading}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Daily Orders Chart */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <Timeline />
              Динамика заказов
            </Typography>
            <Box height={300}>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyOrders}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="orders"
                      stroke="#2196f3"
                      fill="#2196f3"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Order Status Distribution */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <CheckCircle />
              Статусы заказов
            </Typography>
            <Box height={300}>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.ordersByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.ordersByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Daily Revenue Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <AttachMoney />
              Динамика выручки
            </Typography>
            <Box height={400}>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#4caf50"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Store Performance */}
        {stores.length > 1 && selectedStore === 'all' && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <StoreIcon />
                Производительность магазинов
              </Typography>
              <Box height={300}>
                {loading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <CircularProgress />
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.ordersByStore}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="orders" fill="#2196f3" />
                      <Bar dataKey="revenue" fill="#4caf50" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}

export default OrderAnalytics
