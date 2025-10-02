import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Divider,
  Avatar,
  IconButton,
  Tooltip,
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Fab,
  Zoom,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemButton,
  Skeleton,
  ImageList,
  ImageListItem,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Visibility,
  Close,
  Person,
  Store,
  AttachMoney,
  CalendarToday,
  Receipt,
  Warning,
  FilterList,
  Refresh,
  Download,
  BatchPrediction,
  FullscreenExit,
  Fullscreen,
  ZoomIn,
  ZoomOut,
  RotateLeft,
  RotateRight,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Order } from '../../types'
import { orderService, OrderFilters } from '../../services/orderService'
import { toast } from 'react-toastify'
import { useAuth } from '../../contexts/AuthContext'

interface PaymentVerificationScreenProps {
  orders: Order[]
  onRefresh: () => void
  loading?: boolean
}

interface ImageViewerProps {
  open: boolean
  onClose: () => void
  imageUrl: string
  orderNumber: string
}

const ImageViewer: React.FC<ImageViewerProps> = ({ open, onClose, imageUrl, orderNumber }) => {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    if (open) {
      setZoom(1)
      setRotation(0)
    }
  }, [open])

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleRotateLeft = () => setRotation(prev => prev - 90)
  const handleRotateRight = () => setRotation(prev => prev + 90)

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth={false}
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          width: '90vw',
          height: '90vh',
          maxWidth: 'none',
          maxHeight: 'none',
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Чек к заказу #{orderNumber}
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Увеличить">
            <IconButton onClick={handleZoomIn} disabled={zoom >= 3}>
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Уменьшить">
            <IconButton onClick={handleZoomOut} disabled={zoom <= 0.5}>
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="Повернуть влево">
            <IconButton onClick={handleRotateLeft}>
              <RotateLeft />
            </IconButton>
          </Tooltip>
          <Tooltip title="Повернуть вправо">
            <IconButton onClick={handleRotateRight}>
              <RotateRight />
            </IconButton>
          </Tooltip>
          <Tooltip title="Закрыть">
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 0 }}>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'auto',
            background: 'rgba(0,0,0,0.9)',
          }}
        >
          <img
            src={imageUrl}
            alt={`Чек заказа ${orderNumber}`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-in-out',
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              toast.error('Не удалось загрузить изображение чека')
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  )
}

interface VerificationCardProps {
  order: Order
  onConfirm: (orderId: string, notes?: string) => void
  onReject: (orderId: string, reason: string) => void
  onViewDetails: (order: Order) => void
  loading?: boolean
  selected?: boolean
  onSelect?: (orderId: string, selected: boolean) => void
}

const VerificationCard: React.FC<VerificationCardProps> = ({
  order,
  onConfirm,
  onReject,
  onViewDetails,
  loading,
  selected,
  onSelect,
}) => {
  const [imageViewer, setImageViewer] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(false)
  const [rejectDialog, setRejectDialog] = useState(false)
  const [confirmNotes, setConfirmNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const formatCurrency = (amount: number, currency: string) => {
    const currencyMap: Record<string, string> = {
      USD: '$',
      EUR: '€',
      RUB: '₽',
      UAH: '₴',
      KZT: '₸',
    }
    return `${amount.toLocaleString()} ${currencyMap[currency] || currency}`
  }

  const parseCustomerInfo = (customerInfo: any) => {
    if (typeof customerInfo === 'string') {
      try {
        return JSON.parse(customerInfo)
      } catch {
        return { name: customerInfo }
      }
    }
    return customerInfo || {}
  }

  const customerData = parseCustomerInfo(order.customerInfo)

  const handleConfirm = () => {
    onConfirm(order.id, confirmNotes || undefined)
    setConfirmDialog(false)
    setConfirmNotes('')
  }

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Укажите причину отклонения')
      return
    }
    onReject(order.id, rejectReason)
    setRejectDialog(false)
    setRejectReason('')
  }

  return (
    <>
      <Card 
        sx={{ 
          mb: 2, 
          border: selected ? 2 : 1, 
          borderColor: selected ? 'primary.main' : 'divider',
          opacity: loading ? 0.7 : 1 
        }}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              {onSelect && (
                <Checkbox
                  checked={selected || false}
                  onChange={(e) => onSelect(order.id, e.target.checked)}
                />
              )}
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  Заказ #{order.orderNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {format(new Date(order.createdAt), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6" color="primary" fontWeight="bold">
                {formatCurrency(order.totalAmount, order.currency)}
              </Typography>
              <Chip
                label="Ожидает подтверждения"
                color="warning"
                size="small"
                icon={<Warning />}
              />
            </Box>
          </Box>

          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Person fontSize="small" color="action" />
                <Typography variant="body2" fontWeight="medium">
                  {customerData.name || `${order.customer.firstName} ${order.customer.lastName}`.trim() || 'Неизвестный клиент'}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Store fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {order.store.name}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">
                Товаров: {order.items.length} ({order.items.reduce((sum, item) => sum + item.quantity, 0)} шт.)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Telegram ID: {order.customer.telegramId}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              {order.paymentProof ? (
                <Box>
                  <Typography variant="body2" color="success.main" fontWeight="medium" mb={1}>
                    ✓ Чек прикреплен
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Visibility />}
                    onClick={() => setImageViewer(true)}
                    sx={{ mr: 1 }}
                  >
                    Просмотреть чек
                  </Button>
                </Box>
              ) : (
                <Typography variant="body2" color="error.main">
                  ⚠ Чек не прикреплен
                </Typography>
              )}
            </Grid>
          </Grid>

          {order.notes && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Комментарий:</strong> {order.notes}
              </Typography>
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Button
              variant="outlined"
              size="small"
              onClick={() => onViewDetails(order)}
              startIcon={<Receipt />}
            >
              Подробнее
            </Button>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                color="success"
                size="small"
                onClick={() => setConfirmDialog(true)}
                disabled={loading}
                startIcon={<CheckCircle />}
              >
                Подтвердить
              </Button>
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={() => setRejectDialog(true)}
                disabled={loading}
                startIcon={<Cancel />}
              >
                Отклонить
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Image Viewer */}
      {order.paymentProof && (
        <ImageViewer
          open={imageViewer}
          onClose={() => setImageViewer(false)}
          imageUrl={order.paymentProof}
          orderNumber={order.orderNumber}
        />
      )}

      {/* Confirm Payment Dialog */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Подтвердить оплату заказа #{order.orderNumber}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Вы подтверждаете получение оплаты на сумму {formatCurrency(order.totalAmount, order.currency)}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Комментарий (необязательно)"
            value={confirmNotes}
            onChange={(e) => setConfirmNotes(e.target.value)}
            placeholder="Дополнительная информация об оплате..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)}>Отмена</Button>
          <Button 
            onClick={handleConfirm}
            variant="contained" 
            color="success"
            startIcon={<CheckCircle />}
          >
            Подтвердить оплату
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Order Dialog */}
      <Dialog open={rejectDialog} onClose={() => setRejectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Отклонить заказ #{order.orderNumber}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Укажите причину отклонения заказа. Клиент получит уведомление с указанной причиной.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Причина отклонения *"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Например: Недостаточная сумма оплаты, неверные реквизиты..."
            error={!rejectReason.trim()}
            helperText={!rejectReason.trim() ? 'Обязательное поле' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(false)}>Отмена</Button>
          <Button 
            onClick={handleReject}
            variant="contained" 
            color="error"
            startIcon={<Cancel />}
            disabled={!rejectReason.trim()}
          >
            Отклонить заказ
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

const PaymentVerificationScreen: React.FC<PaymentVerificationScreenProps> = ({
  orders,
  onRefresh,
  loading = false,
}) => {
  const { user } = useAuth()
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [processingOrder, setProcessingOrder] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({
    hasPaymentProof: 'all', // 'all' | 'with' | 'without'
    sortBy: 'createdAt', // 'createdAt' | 'totalAmount'
    sortOrder: 'desc', // 'asc' | 'desc'
  })

  // Фильтрация заказов, ожидающих подтверждения
  const pendingOrders = orders.filter(order => order.status === 'PENDING_ADMIN')
  
  // Применение дополнительных фильтров
  const filteredOrders = pendingOrders.filter(order => {
    if (filters.hasPaymentProof === 'with' && !order.paymentProof) return false
    if (filters.hasPaymentProof === 'without' && order.paymentProof) return false
    return true
  }).sort((a, b) => {
    let comparison = 0
    if (filters.sortBy === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    } else if (filters.sortBy === 'totalAmount') {
      comparison = a.totalAmount - b.totalAmount
    }
    return filters.sortOrder === 'desc' ? -comparison : comparison
  })

  const handleConfirmPayment = async (orderId: string, notes?: string) => {
    setProcessingOrder(orderId)
    try {
      await orderService.confirmPayment(orderId, { notes })
      toast.success('Оплата подтверждена')
      onRefresh()
      setSelectedOrders(prev => prev.filter(id => id !== orderId))
    } catch (error: any) {
      toast.error(`Ошибка при подтверждении оплаты: ${error.response?.data?.message || error.message}`)
    } finally {
      setProcessingOrder(null)
    }
  }

  const handleRejectOrder = async (orderId: string, reason: string) => {
    setProcessingOrder(orderId)
    try {
      await orderService.rejectOrder(orderId, { reason })
      toast.success('Заказ отклонен')
      onRefresh()
      setSelectedOrders(prev => prev.filter(id => id !== orderId))
    } catch (error: any) {
      toast.error(`Ошибка при отклонении заказа: ${error.response?.data?.message || error.message}`)
    } finally {
      setProcessingOrder(null)
    }
  }

  const handleBulkConfirm = async () => {
    if (selectedOrders.length === 0) return
    
    setBulkLoading(true)
    const errors: string[] = []
    
    for (const orderId of selectedOrders) {
      try {
        await orderService.confirmPayment(orderId)
      } catch (error: any) {
        errors.push(`Заказ ${orderId}: ${error.response?.data?.message || error.message}`)
      }
    }
    
    setBulkLoading(false)
    
    if (errors.length === 0) {
      toast.success(`Подтверждено ${selectedOrders.length} заказов`)
    } else {
      toast.error(`Ошибки при обработке: ${errors.join(', ')}`)
    }
    
    setSelectedOrders([])
    onRefresh()
  }

  const handleSelectOrder = (orderId: string, selected: boolean) => {
    setSelectedOrders(prev => 
      selected 
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    )
  }

  const handleSelectAll = () => {
    setSelectedOrders(
      selectedOrders.length === filteredOrders.length 
        ? [] 
        : filteredOrders.map(order => order.id)
    )
  }

  if (loading) {
    return (
      <Box p={3}>
        {[...Array(3)].map((_, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" mb={2}>
                <Skeleton variant="text" width="30%" height={32} />
                <Skeleton variant="text" width="20%" height={32} />
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="60%" />
                </Grid>
                <Grid item xs={4}>
                  <Skeleton variant="text" width="70%" />
                  <Skeleton variant="text" width="50%" />
                </Grid>
                <Grid item xs={4}>
                  <Skeleton variant="rectangular" width="80%" height={36} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Верификация оплат
          {filteredOrders.length > 0 && (
            <Chip 
              label={`${filteredOrders.length} заказов`} 
              color="warning" 
              size="small" 
              sx={{ ml: 2 }} 
            />
          )}
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={() => setFiltersOpen(true)}
          >
            Фильтры
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={onRefresh}
            disabled={loading}
          >
            Обновить
          </Button>
        </Box>
      </Box>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50', border: 1, borderColor: 'primary.200' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body1" fontWeight="medium">
              Выбрано заказов: {selectedOrders.length}
            </Typography>
            <Box display="flex" gap={1}>
              <Button
                size="small"
                onClick={() => setSelectedOrders([])}
              >
                Отменить выбор
              </Button>
              <Button
                variant="contained"
                color="success"
                size="small"
                onClick={handleBulkConfirm}
                disabled={bulkLoading}
                startIcon={<BatchPrediction />}
              >
                {bulkLoading ? 'Обработка...' : 'Подтвердить все'}
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Select All */}
      {filteredOrders.length > 0 && (
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Checkbox
            checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
            indeterminate={selectedOrders.length > 0 && selectedOrders.length < filteredOrders.length}
            onChange={handleSelectAll}
          />
          <Typography variant="body2" color="text.secondary">
            Выбрать все на странице
          </Typography>
        </Box>
      )}

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {pendingOrders.length === 0 
            ? '🎉 Нет заказов, ожидающих подтверждения оплаты'
            : 'Нет заказов, соответствующих выбранным фильтрам'
          }
        </Alert>
      ) : (
        filteredOrders.map((order) => (
          <VerificationCard
            key={order.id}
            order={order}
            onConfirm={handleConfirmPayment}
            onReject={handleRejectOrder}
            onViewDetails={() => {
              // This will be handled by parent component
              console.log('View details for order:', order.id)
            }}
            loading={processingOrder === order.id}
            selected={selectedOrders.includes(order.id)}
            onSelect={handleSelectOrder}
          />
        ))
      )}

      {/* Filters Drawer */}
      <Drawer
        anchor="right"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      >
        <Box sx={{ width: 300, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Фильтры и сортировка
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Наличие чека</InputLabel>
            <Select
              value={filters.hasPaymentProof}
              onChange={(e) => setFilters(prev => ({ ...prev, hasPaymentProof: e.target.value }))}
              label="Наличие чека"
            >
              <MenuItem value="all">Все заказы</MenuItem>
              <MenuItem value="with">С прикрепленным чеком</MenuItem>
              <MenuItem value="without">Без чека</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Сортировать по</InputLabel>
            <Select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              label="Сортировать по"
            >
              <MenuItem value="createdAt">Дате создания</MenuItem>
              <MenuItem value="totalAmount">Сумме заказа</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Порядок</InputLabel>
            <Select
              value={filters.sortOrder}
              onChange={(e) => setFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
              label="Порядок"
            >
              <MenuItem value="desc">По убыванию</MenuItem>
              <MenuItem value="asc">По возрастанию</MenuItem>
            </Select>
          </FormControl>

          <Box display="flex" gap={1} mt={3}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setFilters({
                  hasPaymentProof: 'all',
                  sortBy: 'createdAt',
                  sortOrder: 'desc',
                })
              }}
            >
              Сбросить
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={() => setFiltersOpen(false)}
            >
              Применить
            </Button>
          </Box>
        </Box>
      </Drawer>
    </Box>
  )
}

export default PaymentVerificationScreen
