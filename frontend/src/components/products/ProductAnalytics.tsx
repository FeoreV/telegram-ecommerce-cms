import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  LinearProgress,
  Divider,
  Button,
  Alert,
  Paper,
  CircularProgress,
  IconButton,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Badge,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Inventory,
  ShoppingCart,
  LocalOffer,
  Warning,
  ExpandLess,
  ExpandMore,
  Star,
  Visibility,
  Category,
  Store,
  AttachMoney,
} from '@mui/icons-material'
import { Product, Store as StoreType } from '../../types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface ProductAnalyticsProps {
  products: Product[]
  stores: StoreType[]
  loading?: boolean
}

interface TopProduct {
  product: Product
  salesCount: number
  revenue: number
  trend: 'up' | 'down' | 'stable'
}

interface StockAlert {
  product: Product
  status: 'out_of_stock' | 'low_stock' | 'critical'
  daysUntilEmpty?: number
}

const ProductAnalytics: React.FC<ProductAnalyticsProps> = ({
  products,
  stores,
  loading = false,
}) => {
  const [expanded, setExpanded] = useState(true)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const [analytics, setAnalytics] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalValue: 0,
    avgPrice: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    topCategory: '',
    topStore: '',
  })

  useEffect(() => {
    if (products.length > 0) {
      calculateAnalytics()
      generateTopProducts()
      generateStockAlerts()
    }
  }, [products, stores])

  const calculateAnalytics = () => {
    const totalProducts = products.length
    const activeProducts = products.filter(p => p.isActive).length
    const totalValue = products.reduce((sum, p) => sum + (Number(p.price) * p.stock), 0)
    const avgPrice = products.length > 0 ? products.reduce((sum, p) => sum + Number(p.price), 0) / products.length : 0
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 10).length
    const outOfStockCount = products.filter(p => p.stock === 0).length

    // Топ категория
    const categoryStats: Record<string, number> = {}
    products.forEach(p => {
      if (p.category) {
        categoryStats[p.category.name] = (categoryStats[p.category.name] || 0) + 1
      }
    })
    const topCategory = Object.entries(categoryStats).reduce((top, [name, count]) => 
      count > top.count ? { name, count } : top, { name: '', count: 0 }
    ).name

    // Топ магазин
    const storeStats: Record<string, number> = {}
    products.forEach(p => {
      storeStats[p.store.name] = (storeStats[p.store.name] || 0) + 1
    })
    const topStore = Object.entries(storeStats).reduce((top, [name, count]) => 
      count > top.count ? { name, count } : top, { name: '', count: 0 }
    ).name

    setAnalytics({
      totalProducts,
      activeProducts,
      totalValue,
      avgPrice,
      lowStockCount,
      outOfStockCount,
      topCategory,
      topStore,
    })
  }

  const generateTopProducts = () => {
    // Имитируем данные о продажах (в реальном проекте это будет из API)
    const topProductsData: TopProduct[] = products
      .filter(p => p._count.orderItems > 0)
      .sort((a, b) => b._count.orderItems - a._count.orderItems)
      .slice(0, 5)
      .map((product, index) => ({
        product,
        salesCount: product._count.orderItems,
        revenue: product._count.orderItems * Number(product.price),
        trend: index % 3 === 0 ? 'up' : index % 3 === 1 ? 'down' : 'stable',
      }))

    setTopProducts(topProductsData)
  }

  const generateStockAlerts = () => {
    const alerts: StockAlert[] = []

    products.forEach(product => {
      if (product.stock === 0) {
        alerts.push({
          product,
          status: 'out_of_stock',
        })
      } else if (product.stock <= 5) {
        alerts.push({
          product,
          status: 'critical',
          daysUntilEmpty: Math.ceil(product.stock / Math.max(1, product._count.orderItems / 30)),
        })
      } else if (product.stock <= 10) {
        alerts.push({
          product,
          status: 'low_stock',
          daysUntilEmpty: Math.ceil(product.stock / Math.max(1, product._count.orderItems / 30)),
        })
      }
    })

    setStockAlerts(alerts.slice(0, 10)) // Показываем топ 10 критичных
  }

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ₽`
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp color="success" />
      case 'down':
        return <TrendingDown color="error" />
      default:
        return <LinearProgress variant="determinate" value={50} sx={{ width: 24 }} />
    }
  }

  const getAlertSeverity = (status: StockAlert['status']) => {
    switch (status) {
      case 'out_of_stock':
        return { color: 'error' as const, label: 'Нет в наличии' }
      case 'critical':
        return { color: 'error' as const, label: 'Критично мало' }
      case 'low_stock':
        return { color: 'warning' as const, label: 'Мало товара' }
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    )
  }

  if (products.length === 0) {
    return (
      <Alert severity="info">
        <Typography variant="h6">Нет данных для аналитики</Typography>
        <Typography variant="body2">
          Создайте товары, чтобы увидеть аналитику и статистику.
        </Typography>
      </Alert>
    )
  }

  return (
    <Paper sx={{ mb: 3 }}>
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant="h6" color="primary">
          📊 Аналитика товаров
        </Typography>
        <IconButton size="small">
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 2, pt: 0 }}>
          {/* Общая статистика */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ textAlign: 'center', p: 2 }}>
                <Box component="div">
                  <Typography component="span" variant="h4" color="primary" fontWeight="bold">
                    {analytics.totalProducts}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Всего товаров
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Card sx={{ textAlign: 'center', p: 2 }}>
                <Box component="div">
                  <Typography component="span" variant="h4" color="success.main" fontWeight="bold">
                    {analytics.activeProducts}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Активных
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Card sx={{ textAlign: 'center', p: 2 }}>
                <Box component="div">
                  <Typography component="span" variant="h4" color="warning.main" fontWeight="bold">
                    {analytics.lowStockCount + analytics.outOfStockCount}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Требуют внимания
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Card sx={{ textAlign: 'center', p: 2 }}>
                <Box component="div">
                  <Typography component="span" variant="h4" color="info.main" fontWeight="bold">
                    {formatCurrency(analytics.totalValue)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Стоимость склада
                </Typography>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* Топ товары */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <Star color="primary" />
                    <Typography variant="h6" color="primary">
                      Популярные товары
                    </Typography>
                  </Box>
                  
                  {topProducts.length === 0 ? (
                    <Alert severity="info">
                      Пока нет данных о продажах
                    </Alert>
                  ) : (
                    <List>
                      {topProducts.map((item, index) => (
                        <ListItem key={item.product.id} divider={index < topProducts.length - 1}>
                          <ListItemAvatar>
                            <Avatar
                              sx={{
                                bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                                color: theme => theme.palette.primary.contrastText,
                                border: theme => `1px solid ${theme.palette.primary.main}`,
                              }}
                            >
                              {index + 1}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                {item.product.name}
                                {getTrendIcon(item.trend)}
                              </Box>
                            }
                            secondary={
                              <Box component="div">
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {item.salesCount} продаж • {formatCurrency(item.revenue)}
                                </Typography>
                              </Box>
                            }
                          />
                          <Badge badgeContent={item.salesCount} color="primary" />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Предупреждения о складе */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <Warning color="warning" />
                    <Typography variant="h6" color="primary">
                      Складские предупреждения
                    </Typography>
                  </Box>
                  
                  {stockAlerts.length === 0 ? (
                    <Alert severity="success">
                      Все товары в достаточном количестве 🎉
                    </Alert>
                  ) : (
                    <List>
                      {stockAlerts.map((alert, index) => {
                        const severity = getAlertSeverity(alert.status)
                        return (
                          <ListItem key={alert.product.id} divider={index < stockAlerts.length - 1}>
                            <ListItemAvatar>
                              <Avatar
                                sx={{
                                  bgcolor: theme => theme.palette.mode === 'dark' ? `${severity.color}.dark` : `${severity.color}.light`,
                                  color: theme => theme.palette[severity.color].contrastText,
                                  border: theme => `1px solid ${theme.palette[severity.color].main}`,
                                }}
                              >
                                <Inventory />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={alert.product.name}
                              secondary={
                                <Box component="div">
                                  <Chip
                                    label={severity.label}
                                    color={severity.color}
                                    size="small"
                                    sx={{ mr: 1 }}
                                  />
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    {alert.product.stock} шт осталось
                                    {alert.daysUntilEmpty && ` • ~${alert.daysUntilEmpty} дней`}
                                  </Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        )
                      })}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Дополнительная статистика */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Общая статистика
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box textAlign="center">
                        <Typography component="span" variant="h5" color="info.main">
                          {formatCurrency(analytics.avgPrice)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Средняя цена товара
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box textAlign="center">
                        <Typography component="span" variant="h5" color="primary.main">
                          {analytics.topCategory || 'Не указана'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Популярная категория
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box textAlign="center">
                        <Typography component="span" variant="h5" color="success.main">
                          {analytics.topStore || 'Не указан'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Ведущий магазин
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box textAlign="center">
                        <Typography component="span" variant="h5" color="text.primary">
                          {Math.round((analytics.activeProducts / analytics.totalProducts) * 100)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Активных товаров
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Collapse>
    </Paper>
  )
}

export default ProductAnalytics
