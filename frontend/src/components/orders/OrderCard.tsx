import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  Divider,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Checkbox,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Visibility,
  Person,
  Store,
  AttachMoney,
  LocalShipping,
  ExpandMore,
  Phone,
  Email,
  LocationOn,
  Notes,
  TrackChanges,
  Link as LinkIcon,
} from '@mui/icons-material'
import { Order } from '../../types'
import { orderService } from '../../services/orderService'
import { toast } from 'react-toastify'
import OrderDetailsDialog from './OrderDetailsDialog'
import TrackingDialog from './TrackingDialog'

interface OrderCardProps {
  order: Order
  onRefresh: () => void
  compact?: boolean
  selected?: boolean
  onSelectionChange?: (orderId: string, selected: boolean) => void
  showCheckbox?: boolean
}

const OrderCard: React.FC<OrderCardProps> = ({ 
  order, 
  onRefresh, 
  compact = false, 
  selected = false,
  onSelectionChange,
  showCheckbox = false
}) => {
  const [confirmDialog, setConfirmDialog] = useState(false)
  const [rejectDialog, setRejectDialog] = useState(false)
  const [detailsDialog, setDetailsDialog] = useState(false)
  const [trackingDialog, setTrackingDialog] = useState(false)
  const [trackingMode, setTrackingMode] = useState<'set' | 'view'>('view')
  const [loading, setLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [confirmNotes, setConfirmNotes] = useState('')

  const getStatusChip = () => {
    const statusConfig = {
      PENDING_ADMIN: { label: 'Ожидает подтверждения', color: 'warning' as const, icon: <Notes /> },
      PAID: { label: 'Оплачен', color: 'success' as const, icon: <CheckCircle /> },
      REJECTED: { label: 'Отклонен', color: 'error' as const, icon: <Cancel /> },
      CANCELLED: { label: 'Отменен', color: 'default' as const, icon: <Cancel /> },
      SHIPPED: { label: 'Отправлен', color: 'info' as const, icon: <LocalShipping /> },
      DELIVERED: { label: 'Доставлен', color: 'success' as const, icon: <CheckCircle /> },
    }

    const config = statusConfig[order.status] || { label: order.status, color: 'default' as const, icon: null }
    
    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        icon={config.icon}
        variant={order.status === 'PENDING_ADMIN' ? 'filled' : 'outlined'}
      />
    )
  }

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

  const handleConfirmPayment = async () => {
    setLoading(true)
    try {
      await orderService.confirmPayment(order.id, { notes: confirmNotes })
      toast.success('Оплата подтверждена!')
      onRefresh()
      setConfirmDialog(false)
      setConfirmNotes('')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при подтверждении оплаты')
    } finally {
      setLoading(false)
    }
  }

  const handleRejectOrder = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Укажите причину отклонения')
      return
    }

    setLoading(true)
    try {
      await orderService.rejectOrder(order.id, { reason: rejectionReason })
      toast.success('Заказ отклонен')
      onRefresh()
      setRejectDialog(false)
      setRejectionReason('')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при отклонении заказа')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsShipped = () => {
    setTrackingMode('set')
    setTrackingDialog(true)
  }

  const handleViewTracking = () => {
    setTrackingMode('view')
    setTrackingDialog(true)
  }

  const handleMarkAsDelivered = async () => {
    setLoading(true)
    try {
      await orderService.markAsDelivered(order.id)
      toast.success('Заказ отмечен как доставленный')
      onRefresh()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при обновлении статуса')
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={showCheckbox ? 2 : 0}>
              {showCheckbox && onSelectionChange && (
                <Checkbox
                  checked={selected}
                  onChange={(e) => onSelectionChange(order.id, e.target.checked)}
                />
              )}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  Заказ #{order.orderNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {order.customerInfo?.name || 'Неизвестный покупатель'} • {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="h6" fontWeight="bold">
                {formatCurrency(order.totalAmount, order.currency)}
              </Typography>
              {getStatusChip()}
              <Tooltip title="Подробности">
                <IconButton onClick={() => setDetailsDialog(true)} size="small">
                  <Visibility />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="flex-start" gap={showCheckbox ? 2 : 0}>
              {showCheckbox && onSelectionChange && (
                <Checkbox
                  checked={selected}
                  onChange={(e) => onSelectionChange(order.id, e.target.checked)}
                  sx={{ mt: -0.5 }}
                />
              )}
              <Box>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Заказ #{order.orderNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {new Date(order.createdAt).toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
                {getStatusChip()}
              </Box>
            </Box>
            <Typography variant="h5" fontWeight="bold" color="primary">
              {formatCurrency(order.totalAmount, order.currency)}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar
              sx={{
                bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                color: theme => theme.palette.primary.contrastText,
                border: theme => `1px solid ${theme.palette.primary.main}`,
              }}
            >
              <Person />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight="medium">
                {order.customerInfo?.name || 'Неизвестный покупатель'}
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                {order.customerInfo?.phone && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {order.customerInfo.phone}
                    </Typography>
                  </Box>
                )}
                {order.customerInfo?.email && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Email fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {order.customerInfo.email}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          {order.customerInfo?.address && (
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <LocationOn fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {order.customerInfo.address}
              </Typography>
            </Box>
          )}

          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar
              sx={{
                bgcolor: theme => theme.palette.mode === 'dark' ? 'secondary.dark' : 'secondary.light',
                color: theme => theme.palette.secondary.contrastText,
                border: theme => `1px solid ${theme.palette.secondary.main}`,
              }}
            >
              <Store />
            </Avatar>
            <Box>
              <Typography variant="subtitle2">
                {order.store.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Валюта: {order.currency}
              </Typography>
            </Box>
          </Box>

          {/* Tracking Information */}
          {order.trackingNumber && (
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Avatar
                sx={{
                  bgcolor: theme => theme.palette.mode === 'dark' ? 'info.dark' : 'info.light',
                  color: theme => theme.palette.info.contrastText,
                  border: theme => `1px solid ${theme.palette.info.main}`,
                }}
              >
                <LocalShipping />
              </Avatar>
              <Box flex={1}>
                <Typography variant="subtitle2">
                  Номер трека: {order.trackingNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {order.shippedAt && `Отправлено: ${new Date(order.shippedAt).toLocaleDateString('ru-RU')}`}
                </Typography>
              </Box>
              <Tooltip title="Просмотреть трекинг">
                <IconButton onClick={handleViewTracking} size="small">
                  <TrackChanges />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Order Items */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle2">
                Товары ({order.items.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {order.items.map((item, index) => (
                <Box key={index} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {item.product.name}
                      {item.variant && ` (${item.variant.name}: ${item.variant.value})`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Количество: {item.quantity}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight="medium">
                    {formatCurrency(item.price * item.quantity, order.currency)}
                  </Typography>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>

          {order.notes && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Комментарий покупателя:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {order.notes}
              </Typography>
            </Box>
          )}

          {order.rejectionReason && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Причина отклонения:
              </Typography>
              <Typography variant="body2">
                {order.rejectionReason}
              </Typography>
            </Alert>
          )}

          <Box display="flex" gap={2} mt={3} justifyContent="flex-end">
            <Button
              variant="outlined"
              startIcon={<Visibility />}
              onClick={() => setDetailsDialog(true)}
              size="small"
            >
              Подробности
            </Button>
            
            {order.status === 'PENDING_ADMIN' && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircle />}
                  onClick={() => setConfirmDialog(true)}
                  disabled={loading}
                  size="small"
                >
                  Подтвердить
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Cancel />}
                  onClick={() => setRejectDialog(true)}
                  disabled={loading}
                  size="small"
                >
                  Отклонить
                </Button>
              </>
            )}
            
            {order.status === 'PAID' && (
              <Button
                variant="contained"
                color="info"
                startIcon={<LocalShipping />}
                onClick={handleMarkAsShipped}
                disabled={loading}
                size="small"
              >
                Отправить
              </Button>
            )}
            
            {order.status === 'SHIPPED' && (
              <>
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<TrackChanges />}
                  onClick={handleViewTracking}
                  size="small"
                >
                  Трекинг
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircle />}
                  onClick={handleMarkAsDelivered}
                  disabled={loading}
                  size="small"
                >
                  Доставлен
                </Button>
              </>
            )}

            {order.status === 'DELIVERED' && order.trackingNumber && (
              <Button
                variant="outlined"
                color="info"
                startIcon={<TrackChanges />}
                onClick={handleViewTracking}
                size="small"
              >
                Просмотреть трекинг
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Confirm Payment Dialog */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Подтвердить оплату</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Вы подтверждаете получение оплаты за заказ #{order.orderNumber}?
          </Typography>
          <TextField
            label="Комментарий (необязательно)"
            fullWidth
            multiline
            rows={3}
            value={confirmNotes}
            onChange={(e) => setConfirmNotes(e.target.value)}
            margin="normal"
            placeholder="Дополнительная информация о платеже..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={handleConfirmPayment}
            variant="contained"
            color="success"
            disabled={loading}
          >
            {loading ? 'Подтверждение...' : 'Подтвердить оплату'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Order Dialog */}
      <Dialog open={rejectDialog} onClose={() => setRejectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Отклонить заказ</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Заказ будет отклонен, и покупатель получит уведомление.
          </Alert>
          <TextField
            label="Причина отклонения *"
            fullWidth
            multiline
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            margin="normal"
            required
            placeholder="Укажите причину отклонения заказа..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={handleRejectOrder}
            variant="contained"
            color="error"
            disabled={loading || !rejectionReason.trim()}
          >
            {loading ? 'Отклонение...' : 'Отклонить заказ'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        open={detailsDialog}
        onClose={() => setDetailsDialog(false)}
        order={order}
        onRefresh={onRefresh}
      />

      {/* Tracking Dialog */}
      <TrackingDialog
        open={trackingDialog}
        onClose={() => setTrackingDialog(false)}
        order={order}
        onRefresh={onRefresh}
        mode={trackingMode}
      />
    </>
  )
}

export default OrderCard
