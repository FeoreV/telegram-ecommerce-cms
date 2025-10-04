import {
    Assessment,
    Dashboard,
    Download,
    Refresh,
    Search,
    ShoppingCart,
    ViewList,
    ViewModule
} from '@mui/icons-material'
import {
    Badge,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    Grid,
    InputAdornment,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Tab,
    Tabs,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from '@mui/material'
import { format } from 'date-fns'
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import OrderAnalytics from '../components/orders/OrderAnalytics'
import OrderCard from '../components/orders/OrderCard'
import OrderKPIDashboard from '../components/orders/OrderKPIDashboard'
import PaymentVerificationScreen from '../components/orders/PaymentVerificationScreen'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { useOrdersRealTime } from '../hooks/useRealTimeUpdates'
import { OrderFilters, orderService } from '../services/orderService'
import { storeService } from '../services/storeService'
import { Order, Store } from '../types'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const OrdersPage: React.FC = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mainTab, setMainTab] = useState(0) // 0: Orders, 1: Analytics, 2: KPI
  const [activeTab, setActiveTab] = useState(0) // For order status tabs
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards')
  const [filters, setFilters] = useState<OrderFilters>({
    page: 1,
    limit: 20,
    search: '',
    status: undefined,
    storeId: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [dateRange, setDateRange] = useState<{
    from: Date | null
    to: Date | null
  }>({
    from: null,
    to: null,
  })

  const statusTabs = [
    { key: 'verification', label: 'Верификация', status: 'PENDING_ADMIN', isVerification: true },
    { key: 'all', label: 'Все', status: undefined },
    { key: 'pending', label: 'Ожидают', status: 'PENDING_ADMIN' },
    { key: 'paid', label: 'Оплачены', status: 'PAID' },
    { key: 'rejected_cancelled', label: 'Отклонены/Отменены', statuses: ['REJECTED', 'CANCELLED'] },
  ]

  const loadStatusCounts = useCallback(async () => {
    try {
      const stats = await orderService.getOrderStats(filters.storeId)
      setStatusCounts(stats.statusCounts ? (stats.statusCounts as Record<string, number>) : {})
    } catch (error) {
      console.error('Error loading status counts:', error)
    }
  }, [filters.storeId])

  const loadInitialData = useCallback(async () => {
    try {
      // Загрузка магазинов для фильтра
      if (user?.role === 'OWNER' || user?.role === 'ADMIN') {
        const storesResponse = await storeService.getStores({ limit: 100 })
        if (storesResponse && storesResponse.items && Array.isArray(storesResponse.items)) {
          setStores(storesResponse.items)
        } else {
          setStores([])
        }
      }

      // Загрузка статистики по статусам
      loadStatusCounts()
    } catch (error: any) {
      console.error('Error loading initial data:', error)
    }
  }, [user?.role, loadStatusCounts])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const currentTab = statusTabs[activeTab]
      const currentFilters = {
        ...filters,
        status: currentTab.status as any,
        statuses: currentTab.statuses as any,
        dateFrom: dateRange.from?.toISOString().split('T')[0],
        dateTo: dateRange.to?.toISOString().split('T')[0],
      }

      const response = await orderService.getOrders(currentFilters)

      // Check if response and items exist
      if (!response || !response.items || !Array.isArray(response.items)) {
        console.warn('Invalid response format for orders:', response)
        setOrders([])
        setTotalPages(0)
        setTotalCount(0)
        return
      }

      setOrders(response.items)
      setTotalPages(response.pagination?.totalPages || 0)
      setTotalCount(response.pagination?.total || 0)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при загрузке заказов')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [filters, activeTab, dateRange])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  useEffect(() => {
    if (mainTab === 0) { // Only load orders data when on orders tab
      loadOrders()
    }
  }, [filters, activeTab, mainTab, loadOrders])

  // Real-time updates
  useOrdersRealTime(() => {
    if (mainTab === 0) { // Only update when on orders tab
      loadOrders()
      loadStatusCounts()
    }
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadOrders()
    await loadStatusCounts()
    setRefreshing(false)
    toast.success('Данные обновлены')
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
    setFilters(prev => ({ ...prev, page: 1 }))
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({
      ...prev,
      search: event.target.value,
      page: 1,
    }))
  }

  const handleStoreChange = (storeId: string) => {
    setFilters(prev => ({
      ...prev,
      storeId: storeId === 'all' ? undefined : storeId,
      page: 1,
    }))
    loadStatusCounts()
  }

  const handleDateRangeChange = (field: 'from' | 'to', date: Date | null) => {
    setDateRange(prev => ({
      ...prev,
      [field]: date,
    }))

    // Обновляем фильтры с задержкой
    setTimeout(() => {
      setFilters(prev => ({ ...prev, page: 1 }))
    }, 100)
  }

  const handleExport = async () => {
    try {
      const currentTab = statusTabs[activeTab]
      const blob = await orderService.exportOrders({
        ...filters,
        status: currentTab.status as any,
        statuses: currentTab.statuses as any,
        dateFrom: dateRange.from?.toISOString().split('T')[0],
        dateTo: dateRange.to?.toISOString().split('T')[0],
      })

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Экспорт завершен')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при экспорте')
    }
  }

  const handleLoadMore = () => {
    setFilters(prev => ({
      ...prev,
      page: (prev.page || 1) + 1,
    }))
  }

  const getTabLabel = (tab: any, index: number) => {
    let count = 0
    if (index === 0) {
      count = totalCount
    } else if (tab.statuses) {
      // For merged tabs, sum up counts for all statuses
      count = tab.statuses.reduce((sum: number, status: string) => {
        return sum + (statusCounts[status] || 0)
      }, 0)
    } else {
      count = statusCounts[tab.status] || 0
    }

    return (
      <Badge badgeContent={count} color="primary" showZero={false}>
        {tab.label}
      </Badge>
    )
  }

  if (loading && (orders || []).length === 0 && mainTab === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
        <PageHeader
          title="Заказы"
          subtitle="Управление заказами и подтверждение платежей"
          actions={
            <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExport}
              disabled={(orders || []).length === 0}
            >
              Экспорт
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Обновление...' : 'Обновить'}
            </Button>
            </Box>
          }
        />

        {/* Main Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={mainTab}
            onChange={(e, newValue) => setMainTab(newValue)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              label="Заказы"
              icon={<ShoppingCart />}
              iconPosition="start"
            />
            <Tab
              label="Аналитика"
              icon={<Assessment />}
              iconPosition="start"
            />
            <Tab
              label="KPI Dashboard"
              icon={<Dashboard />}
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {mainTab === 0 && (
          <>
            {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Поиск по номеру заказа, клиенту..."
                value={filters.search}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Grid>

            {(stores && stores.length > 0) && (
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Магазин</InputLabel>
                  <Select
                    value={filters.storeId || 'all'}
                    onChange={(e) => handleStoreChange(e.target.value)}
                    label="Магазин"
                  >
                    <MenuItem value="all">Все магазины</MenuItem>
                    {(stores || []).map((store) => (
                      <MenuItem key={store.id} value={store.id}>
                        {store.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12} md={2}>
              <TextField
                label="От даты"
                type="date"
                value={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null
                  handleDateRangeChange('from', date)
                }}
                InputLabelProps={{
                  shrink: true,
                }}
                size="small"
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                label="До даты"
                type="date"
                value={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null
                  handleDateRangeChange('to', date)
                }}
                InputLabelProps={{
                  shrink: true,
                }}
                size="small"
                fullWidth
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, newMode) => newMode && setViewMode(newMode)}
                size="small"
                fullWidth
              >
                <ToggleButton value="cards">
                  <ViewModule />
                </ToggleButton>
                <ToggleButton value="list">
                  <ViewList />
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>
          </Grid>

          {/* Active Filters */}
          <Box display="flex" gap={1} mt={2} flexWrap="wrap">
            {filters.search && (
              <Chip
                label={`Поиск: ${filters.search}`}
                onDelete={() => setFilters(prev => ({ ...prev, search: '', page: 1 }))}
                size="small"
              />
            )}
            {filters.storeId && (
              <Chip
                label={`Магазин: ${(stores || []).find(s => s.id === filters.storeId)?.name}`}
                onDelete={() => handleStoreChange('all')}
                size="small"
              />
            )}
            {dateRange.from && (
              <Chip
                label={`От: ${dateRange.from.toLocaleDateString('ru-RU')}`}
                onDelete={() => handleDateRangeChange('from', null)}
                size="small"
              />
            )}
            {dateRange.to && (
              <Chip
                label={`До: ${dateRange.to.toLocaleDateString('ru-RU')}`}
                onDelete={() => handleDateRangeChange('to', null)}
                size="small"
              />
            )}
          </Box>
        </Paper>

        {/* Status Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            {statusTabs.map((tab, index) => (
              <Tab
                key={tab.key}
                label={getTabLabel(tab, index)}
                id={`orders-tab-${index}`}
                aria-controls={`orders-tabpanel-${index}`}
              />
            ))}
          </Tabs>
        </Paper>

        {/* Payment Verification or Orders List */}
        {statusTabs[activeTab]?.isVerification ? (
          <PaymentVerificationScreen
            orders={orders || []}
            onRefresh={loadOrders}
            loading={loading}
          />
        ) : (
          <>
            {/* Orders List */}
            {(orders || []).length === 0 ? (
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <EmptyState
                  title="Заказы не найдены"
                  description={statusTabs[activeTab].label === 'Все' ? 'Пока нет заказов. Они появятся здесь после оформления через Telegram бот.' : `Нет заказов со статусом "${statusTabs[activeTab].label}"`}
                />
              </Paper>
            ) : (
              <Box>
                {(orders || []).map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onRefresh={loadOrders}
                    compact={viewMode === 'list'}
                  />
                ))}

                {/* Load More Button */}
                {filters.page && filters.page < totalPages && (
                  <Box display="flex" justifyContent="center" mt={4}>
                    <Button
                      variant="outlined"
                      onClick={handleLoadMore}
                      disabled={loading}
                    >
                      {loading ? 'Загрузка...' : 'Загрузить еще'}
                    </Button>
                  </Box>
                )}

                {/* Results Summary */}
                <Box display="flex" justifyContent="center" mt={2}>
                  <Typography variant="body2" color="text.secondary">
                    Показано {(orders || []).length} из {totalCount} заказов
                  </Typography>
                </Box>
              </Box>
            )}
          </>
        )}
          </>
        )}

        {/* Analytics Tab */}
        {mainTab === 1 && (
          <OrderAnalytics />
        )}

        {/* KPI Dashboard Tab */}
        {mainTab === 2 && (
          <OrderKPIDashboard />
        )}
      </Box>
  )
}

export default OrdersPage
