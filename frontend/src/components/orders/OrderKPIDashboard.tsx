import React, { useState, useEffect } from 'react'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Badge,
} from '@mui/material'
import {
  ShoppingCart,
  AttachMoney,
  TrendingUp,
  TrendingDown,
  Star,
  Store,
  Person,
  LocalShipping,
  Schedule,
  CheckCircle,
  Warning,
  InfoOutlined,
} from '@mui/icons-material'
import { format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { orderService } from '../../services/orderService'
import { storeService } from '../../services/storeService'
import { productService } from '../../services/productService'
import { toast } from 'react-toastify'

interface MetricCard {
  title: string
  value: number
  target?: number
  unit: string
  color: 'success' | 'warning' | 'error' | 'info'
  trend: number
  description: string
}

interface TopPerformer {
  id: string
  name: string
  value: number
  unit: string
  change: number
  avatar?: string
  subtitle?: string
}

interface AlertItem {
  type: 'warning' | 'error' | 'info'
  message: string
  time: string
}

const getPercentage = (part: number, total: number) => {
  if (!total) return 0
  return Number(((part / total) * 100).toFixed(1))
}

const humanizeCurrency = (value: number, currency = 'RUB') =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(value)

const humanizeNumber = (value: number) => new Intl.NumberFormat('ru-RU').format(value)

const OrderKPIDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpiData, setKpiData] = useState<{
    metrics: MetricCard[]
    topProducts: TopPerformer[]
    topCustomers: TopPerformer[]
    topStores: TopPerformer[]
    recentAlerts: AlertItem[]
    orderFunnel: { stage: string; value: number; conversion: number }[]
    timeToProcess: number
    avgDeliveryTime: number
  }>({
    metrics: [],
    topProducts: [],
    topCustomers: [],
    topStores: [],
    recentAlerts: [],
    orderFunnel: [],
    timeToProcess: 0,
    avgDeliveryTime: 0,
  })

  useEffect(() => {
    loadKPIData()
  }, [])

  const loadKPIData = async () => {
    setLoading(true)
    try {
      setError(null)

      const [orderStats, ordersResponse, productsResponse, storeStatsResponse] = await Promise.all([
        orderService.getOrderStats(undefined, '30d'),
        orderService.getOrders({ limit: 50, sortBy: 'totalAmount', sortOrder: 'desc' }),
        productService.getProducts({ limit: 5, sortBy: 'stock', sortOrder: 'desc', isActive: true }),
        storeService.getStores({ limit: 5 })
      ])

      const totalOrders = Number(orderStats?.totalOrders ?? ordersResponse.items?.length ?? 0)
      const totalRevenue = Number(orderStats?.totalRevenue ?? ordersResponse.items?.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0) ?? 0)
      const statusCounts = (orderStats?.statusCounts ?? {}) as Record<string, number>
      const pending = statusCounts.PENDING_ADMIN ?? 0
      const delivered = statusCounts.DELIVERED ?? 0
      const cancelled = (statusCounts.CANCELLED ?? 0) + (statusCounts.REJECTED ?? 0)

      const metrics: MetricCard[] = [
        {
          title: 'Всего заказов',
          value: totalOrders,
          unit: 'шт.',
          color: 'info',
          trend: 0,
          description: 'Количество заказов за выбранный период'
        },
        {
          title: 'Выручка',
          value: totalRevenue,
          unit: '₽',
          color: 'success',
          trend: 0,
          description: 'Суммарный доход за период'
        },
        {
          title: 'Ожидают подтверждения',
          value: pending,
          unit: 'шт.',
          color: pending > 5 ? 'warning' : 'info',
          trend: 0,
          description: 'Заказы в статусе подтверждения'
        },
        {
          title: 'Доставлено',
          value: delivered,
          unit: 'шт.',
          color: 'success',
          trend: 0,
          description: 'Количество успешно доставленных заказов'
        },
        {
          title: 'Отмены',
          value: cancelled,
          unit: 'шт.',
          color: cancelled > 0 ? 'error' : 'success',
          trend: 0,
          description: 'Количество отмененных и отклоненных заказов'
        }
      ]

      const products = productsResponse.items ?? []
      const topProducts: TopPerformer[] = products.map((product) => ({
        id: product.id,
        name: product.name,
        value: product.stock,
        unit: 'шт. на складе',
        change: 0,
        subtitle: humanizeCurrency(product.price ?? 0)
      }))

      const orders = ordersResponse.items ?? []
      const topCustomersMap = orders.reduce<Record<string, { name: string; value: number; count: number }>>((acc, order) => {
        const customerName = order.customer?.firstName || order.customer?.username || order.customer?.telegramId || 'Неизвестный'
        const key = order.customer?.id || customerName
        if (!acc[key]) {
          acc[key] = { name: customerName, value: 0, count: 0 }
        }
        acc[key].value += order.totalAmount ?? 0
        acc[key].count += 1
        return acc
      }, {})

      const topCustomers: TopPerformer[] = Object.entries(topCustomersMap)
        .sort(([, a], [, b]) => b.value - a.value)
        .slice(0, 5)
        .map(([id, data]) => ({
          id,
          name: data.name,
          value: data.value,
          unit: '₽',
          change: 0,
          subtitle: `${data.count} заказ(ов)`
        }))

      const stores = storeStatsResponse.items ?? []
      const topStores: TopPerformer[] = stores.map((store) => ({
        id: store.id,
        name: store.name,
        value: store._count?.orders ?? 0,
        unit: 'заказов',
        change: 0,
        subtitle: store.currency ?? ''
      }))

      const recentAlerts: AlertItem[] = []
      if (pending > 10) {
        recentAlerts.push({
          type: 'warning',
          message: 'Много заказов ожидают подтверждения',
          time: format(new Date(), 'HH:mm')
        })
      }
      if (cancelled > 5) {
        recentAlerts.push({
          type: 'error',
          message: 'Высокое количество отмененных заказов за период',
          time: format(new Date(), 'HH:mm')
        })
      }
      if (recentAlerts.length === 0) {
        recentAlerts.push({
          type: 'info',
          message: 'Система работает штатно',
          time: format(new Date(), 'HH:mm')
        })
      }

      const funnelStages: Array<{ stage: string; value: number }> = [
        { stage: 'Создано', value: totalOrders },
        { stage: 'Подтверждено', value: totalOrders - pending },
        { stage: 'Отправлено', value: statusCounts.SHIPPED ?? 0 },
        { stage: 'Доставлено', value: delivered }
      ]

      const orderFunnel = funnelStages.map((stage, index) => ({
        ...stage,
        conversion: index === 0 ? 100 : getPercentage(stage.value, funnelStages[index - 1].value || 1)
      }))

      setKpiData({
        metrics,
        topProducts,
        topCustomers,
        topStores,
        recentAlerts,
        orderFunnel,
        timeToProcess: 0,
        avgDeliveryTime: 0,
      })
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Не удалось загрузить KPI данные'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const getMetricIcon = (color: string) => {
    switch (color) {
      case 'success': return <CheckCircle color="success" />
      case 'warning': return <Warning color="warning" />
      case 'error': return <Warning color="error" />
      default: return <InfoOutlined color="info" />
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <Warning color="error" />
      case 'warning': return <Warning color="warning" />
      default: return <InfoOutlined color="info" />
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        KPI Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Ключевые показатели эффективности
      </Typography>

      <Grid container spacing={3}>
        {/* KPI Metrics */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            {kpiData.metrics.map((metric, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        {metric.title}
                      </Typography>
                      {getMetricIcon(metric.color)}
                    </Box>
                    
                    <Typography variant="h4" fontWeight="bold" mb={1}>
                      {metric.value} {metric.unit}
                    </Typography>
                    
                    {metric.target && (
                      <Box mb={2}>
                        <Typography variant="body2" color="text.secondary" mb={0.5}>
                          Цель: {metric.target} {metric.unit}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min((metric.value / metric.target) * 100, 100)}
                          color={metric.color}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    )}
                    
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {metric.description}
                      </Typography>
                      <Chip
                        label={`${metric.trend > 0 ? '+' : ''}${metric.trend.toFixed(1)}%`}
                        color={metric.trend >= 0 ? 'success' : 'error'}
                        size="small"
                        icon={metric.trend >= 0 ? <TrendingUp /> : <TrendingDown />}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Top Performers */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <Star color="primary" />
              Топ товары
            </Typography>
            <List>
              {kpiData.topProducts.map((product, index) => (
                <ListItem key={product.id} sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Badge badgeContent={index + 1} color="primary">
                      <Avatar
                        sx={{
                          bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                          color: theme => theme.palette.primary.contrastText,
                          border: theme => `1px solid ${theme.palette.primary.main}`,
                        }}
                      >
                        <ShoppingCart />
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={product.name}
                    secondary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2">
                          {product.value} {product.unit}
                        </Typography>
                        <Chip
                          label={`${product.change > 0 ? '+' : ''}${product.change.toFixed(1)}%`}
                          size="small"
                          color={product.change >= 0 ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <Person color="primary" />
              VIP клиенты
            </Typography>
            <List>
              {kpiData.topCustomers.map((customer, index) => (
                <ListItem key={customer.id} sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Badge badgeContent={index + 1} color="secondary">
                      <Avatar
                        sx={{
                          bgcolor: theme => theme.palette.mode === 'dark' ? 'secondary.dark' : 'secondary.light',
                          color: theme => theme.palette.secondary.contrastText,
                          border: theme => `1px solid ${theme.palette.secondary.main}`,
                        }}
                      >
                        <Person />
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={customer.name}
                    secondary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2">
                          {customer.value.toLocaleString()} {customer.unit}
                        </Typography>
                        <Chip
                          label={`${customer.change > 0 ? '+' : ''}${customer.change.toFixed(1)}%`}
                          size="small"
                          color={customer.change >= 0 ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Recent Alerts */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <Warning color="warning" />
              Уведомления
            </Typography>
            <List>
              {kpiData.recentAlerts.map((alert, index) => (
                <ListItem key={index} sx={{ px: 0, alignItems: 'flex-start' }}>
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: theme => theme.palette.mode === 'dark' ? 'background.paper' : 'grey.100',
                        color: theme => theme.palette.text.primary,
                        border: theme => `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      {getAlertIcon(alert.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={alert.message}
                    secondary={alert.time}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Order Funnel */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <TrendingDown />
              Воронка конверсии
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Этап</TableCell>
                    <TableCell align="right">Количество</TableCell>
                    <TableCell align="right">Конверсия</TableCell>
                    <TableCell align="center">Визуализация</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {kpiData.orderFunnel.map((stage, index) => (
                    <TableRow key={index}>
                      <TableCell>{stage.stage}</TableCell>
                      <TableCell align="right">
                        {stage.value.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${stage.conversion.toFixed(1)}%`}
                          color={stage.conversion >= 10 ? 'success' : stage.conversion >= 5 ? 'warning' : 'error'}
                          variant="outlined"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box width="100%" maxWidth={200}>
                          <LinearProgress
                            variant="determinate"
                            value={stage.conversion}
                            color={stage.conversion >= 10 ? 'success' : stage.conversion >= 5 ? 'warning' : 'error'}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

export default OrderKPIDashboard
