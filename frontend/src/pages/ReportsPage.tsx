import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material'
// DatePicker removed to avoid dependency issues
import {
  FileDownload,
  Print,
  Refresh,
  TrendingUp,
  TrendingDown,
  AttachMoney,
  Receipt,
  Inventory,
  People,
  Store,
  CalendarToday,
  Assessment,
  PieChart,
  BarChart as BarChartIcon,
} from '@mui/icons-material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { dashboardService, DashboardFilters } from '../services/dashboardService'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-toastify'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`reports-tabpanel-${index}`}
      aria-labelledby={`reports-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

const ReportsPage: React.FC = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('month')
  const [selectedStore, setSelectedStore] = useState<string>('all')
  const [customDateRange, setCustomDateRange] = useState<{from: string, to: string}>({ from: '', to: '' })
  
  // Data states
  const [salesData, setSalesData] = useState<any[]>([])
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [topStores, setTopStores] = useState<any[]>([])
  const [customerStats, setCustomerStats] = useState<any>({})
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({})

  const periods = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'quarter', label: 'Квартал' },
    { value: 'year', label: 'Год' },
  ]

  const tabs = [
    { label: 'Обзор продаж', icon: <Assessment /> },
    { label: 'Доходы', icon: <AttachMoney /> },
    { label: 'Товары', icon: <Inventory /> },
    { label: 'Клиенты', icon: <People /> },
    { label: 'Производительность', icon: <TrendingUp /> },
  ]

  useEffect(() => {
    loadReportsData()
  }, [selectedPeriod, selectedStore])

  const loadReportsData = async () => {
    setLoading(true)
    try {
      const filters: DashboardFilters = {
        period: selectedPeriod,
        storeId: selectedStore === 'all' ? undefined : selectedStore,
        ...(customDateRange.from && customDateRange.to && {
          dateFrom: customDateRange.from,
          dateTo: customDateRange.to,
        }),
      }

      const [
        revenueChartData,
        topProductsData,
        topStoresData,
        statsData,
      ] = await Promise.all([
        dashboardService.getRevenueData(filters),
        dashboardService.getTopProducts({ ...filters, limit: 10 }),
        user?.role === 'OWNER' ? dashboardService.getTopStores({ ...filters, limit: 10 }) : Promise.resolve([]),
        dashboardService.getStats(filters),
      ])

      setRevenueData(Array.isArray(revenueChartData) ? revenueChartData : [])
      setTopProducts(Array.isArray(topProductsData) ? topProductsData : [])
      setTopStores(Array.isArray(topStoresData) ? topStoresData : [])
      
      // Mock sales data
      const chartData = Array.isArray(revenueChartData) ? revenueChartData : []
      setSalesData(chartData.map(item => ({
        ...item,
        conversion: Math.random() * 5 + 2,
        visitors: Math.floor(Math.random() * 1000) + 100,
      })))

      // Mock performance metrics
      const totalRevenue = Number(statsData?.totalRevenue) || 0
      const totalOrders = Number(statsData?.totalOrders) || 0
      setPerformanceMetrics({
        totalRevenue,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        conversionRate: Math.random() * 5 + 2,
        customerRetention: Math.random() * 30 + 60,
        customerAcquisitionCost: Math.random() * 50 + 25,
      })

      // Mock customer stats
      setCustomerStats({
        newCustomers: Math.floor(Math.random() * 100) + 20,
        returningCustomers: Math.floor(Math.random() * 80) + 40,
        totalCustomers: Math.floor(Math.random() * 500) + 200,
        averageLifetimeValue: Math.floor(Math.random() * 1000) + 500,
      })

    } catch (error: any) {
      toast.error('Ошибка при загрузке отчетов')
      console.error('Reports loading error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportReport = (format: 'pdf' | 'excel' | 'csv') => {
    toast.info(`Экспорт отчета в формате ${format.toUpperCase()}`)
    // Implement export functionality
  }

  const formatCurrency = (value: number | undefined | null) => {
    if (value == null || isNaN(value)) return '₽0'
    return `₽${value.toLocaleString()}`
  }

  const formatPercentage = (value: number | undefined | null) => {
    if (value == null || isNaN(value)) return '0.0%'
    return `${value.toFixed(1)}%`
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c']

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Отчеты и аналитика
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Подробная аналитика бизнеса за выбранный период
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          <Button
            startIcon={<FileDownload />}
            onClick={() => handleExportReport('pdf')}
            size="small"
          >
            PDF
          </Button>
          <Button
            startIcon={<FileDownload />}
            onClick={() => handleExportReport('excel')}
            size="small"
          >
            Excel
          </Button>
          <Button
            startIcon={<Print />}
            onClick={() => window.print()}
            size="small"
          >
            Печать
          </Button>
          <IconButton onClick={loadReportsData} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
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
          </Grid>

          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Магазин</InputLabel>
              <Select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                label="Магазин"
              >
                <MenuItem value="all">Все магазины</MenuItem>
                {/* Add store options from API */}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="От"
              type="date"
              size="small"
              value={customDateRange.from}
              onChange={(e) => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="До"
              type="date"
              size="small"
              value={customDateRange.to}
              onChange={(e) => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Tabs */}
      <Paper>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
            />
          ))}
        </Tabs>

        {/* Sales Overview */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Динамика продаж
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={salesData || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          name === 'revenue' ? formatCurrency(value) : value,
                          name === 'revenue' ? 'Выручка' : name === 'orders' ? 'Заказы' : 'Конверсия'
                        ]}
                      />
                      <Area type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" />
                      <Area type="monotone" dataKey="orders" stackId="2" stroke="#82ca9d" fill="#82ca9d" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
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
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Общая выручка
                          </Typography>
                          <Typography variant="h5">
                            {formatCurrency(performanceMetrics?.totalRevenue)}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <TrendingUp color="success" fontSize="small" />
                            <Typography variant="body2" color="success.main">
                              +12.3%
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
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
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Заказы
                          </Typography>
                          <Typography variant="h5">
                            {performanceMetrics?.totalOrders || 0}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <TrendingUp color="success" fontSize="small" />
                            <Typography variant="body2" color="success.main">
                              +8.1%
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
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
                          <Assessment />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Средний чек
                          </Typography>
                          <Typography variant="h5">
                            {formatCurrency(performanceMetrics?.averageOrderValue)}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <TrendingDown color="error" fontSize="small" />
                            <Typography variant="body2" color="error.main">
                              -2.1%
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Revenue Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    График доходов
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={revenueData || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={formatCurrency} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Ключевые метрики
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Конверсия
                      </Typography>
                      <Typography variant="h6">
                        {formatPercentage(performanceMetrics?.conversionRate)}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Удержание клиентов
                      </Typography>
                      <Typography variant="h6">
                        {formatPercentage(performanceMetrics?.customerRetention)}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Стоимость привлечения
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(performanceMetrics?.customerAcquisitionCost)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Products Tab */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Топ товары по продажам
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Товар</TableCell>
                          <TableCell align="right">Выручка</TableCell>
                          <TableCell align="right">Количество</TableCell>
                          <TableCell align="right">Средняя цена</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(topProducts || []).map((product, index) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Chip 
                                  label={`#${index + 1}`} 
                                  size="small"
                                  color={index < 3 ? 'primary' : 'default'}
                                />
                                {product.name}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(product.revenue)}
                            </TableCell>
                            <TableCell align="right">
                              {product.quantity || 0}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency((product.quantity && product.quantity > 0) ? product.revenue / product.quantity : 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Распределение по категориям
                  </Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={(topProducts || []).slice(0, 5).map((p, i) => ({ 
                          name: p.name,
                          value: p.revenue || 0,
                          color: COLORS[i % COLORS.length]
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                      >
                        {(topProducts || []).slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Other tabs would be implemented similarly */}
        <TabPanel value={activeTab} index={3}>
          <Alert severity="info">
            Раздел "Клиенты" находится в разработке
          </Alert>
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <Alert severity="info">
            Раздел "Производительность" находится в разработке
          </Alert>
        </TabPanel>
      </Paper>
    </Box>
  )
}

export default ReportsPage
