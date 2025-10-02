import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Link,
  Divider,
  Chip,
  Paper,
} from '@mui/material'
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab'
import {
  LocalShipping,
  CheckCircle,
  Link as LinkIcon,
  ContentCopy,
  Launch,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Order } from '../../types'
import { orderService } from '../../services/orderService'
import { toast } from 'react-toastify'

interface TrackingDialogProps {
  open: boolean
  onClose: () => void
  order: Order
  onRefresh: () => void
  mode: 'set' | 'view'
}

const TrackingDialog: React.FC<TrackingDialogProps> = ({
  open,
  onClose,
  order,
  onRefresh,
  mode = 'view'
}) => {
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl || '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (mode !== 'set' || !trackingNumber.trim()) return

    setLoading(true)
    try {
      await orderService.markAsShipped(order.id, {
        trackingNumber: trackingNumber.trim(),
        trackingUrl: trackingUrl.trim() || undefined
      })
      
      toast.success('Заказ отмечен как отправленный с номером трека')
      onRefresh()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при добавлении трекинга')
    } finally {
      setLoading(false)
    }
  }

  const copyTrackingNumber = () => {
    navigator.clipboard.writeText(trackingNumber)
    toast.success('Номер трека скопирован в буфер обмена')
  }

  const getTrackingTimeline = () => {
    const events = []
    
    if (order.createdAt) {
      events.push({
        title: 'Заказ создан',
        date: order.createdAt,
        status: 'completed',
        icon: <CheckCircle />
      })
    }
    
    if (order.paidAt) {
      events.push({
        title: 'Оплата подтверждена',
        date: order.paidAt,
        status: 'completed',
        icon: <CheckCircle />
      })
    }
    
    if (order.shippedAt && order.trackingNumber) {
      events.push({
        title: 'Заказ отправлен',
        date: order.shippedAt,
        status: 'completed',
        icon: <LocalShipping />,
        details: `Трек-номер: ${order.trackingNumber}`
      })
    }
    
    if (order.deliveredAt) {
      events.push({
        title: 'Заказ доставлен',
        date: order.deliveredAt,
        status: 'completed',
        icon: <CheckCircle />
      })
    }

    return events
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {mode === 'set' ? 'Добавить информацию о доставке' : 'Отслеживание заказа'}
      </DialogTitle>
      
      <DialogContent>
        {mode === 'set' ? (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Добавьте номер трека для отправки заказа. Клиент получит уведомление с информацией для отслеживания.
            </Alert>
            
            <TextField
              fullWidth
              label="Номер трека *"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Введите номер трека от транспортной компании"
              margin="normal"
              required
            />
            
            <TextField
              fullWidth
              label="Ссылка для отслеживания (необязательно)"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://example.com/track?id=..."
              margin="normal"
              helperText="Прямая ссылка на страницу отслеживания посылки"
            />
          </Box>
        ) : (
          <Box>
            {/* Tracking Information */}
            {order.trackingNumber ? (
              <Paper sx={{ p: 3, mb: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                    <LocalShipping color="primary" />
                    Информация о доставке
                  </Typography>
                  <Chip
                    label={order.status === 'DELIVERED' ? 'Доставлено' : 'В пути'}
                    color={order.status === 'DELIVERED' ? 'success' : 'info'}
                    variant="filled"
                  />
                </Box>

                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Typography variant="body1" fontWeight="medium">
                    Номер трека:
                  </Typography>
                  <Typography variant="body1" fontFamily="monospace">
                    {order.trackingNumber}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<ContentCopy />}
                    onClick={copyTrackingNumber}
                  >
                    Копировать
                  </Button>
                </Box>

                {order.trackingUrl && (
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Typography variant="body1" fontWeight="medium">
                      Отслеживание:
                    </Typography>
                    <Link
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      Открыть в новой вкладке
                      <Launch fontSize="small" />
                    </Link>
                  </Box>
                )}

                {order.shippedAt && (
                  <Typography variant="body2" color="text.secondary">
                    Отправлено: {format(new Date(order.shippedAt), 'dd MMMM yyyy в HH:mm', { locale: ru })}
                  </Typography>
                )}
              </Paper>
            ) : (
              <Alert severity="warning" sx={{ mb: 3 }}>
                Информация о трекинге недоступна для данного заказа
              </Alert>
            )}

            {/* Order Timeline */}
            <Box>
              <Typography variant="h6" gutterBottom>
                История заказа
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Timeline>
                {getTrackingTimeline().map((event, index) => (
                  <TimelineItem key={index}>
                    <TimelineSeparator>
                      <TimelineDot
                        color={event.status === 'completed' ? 'success' : 'grey'}
                        variant={event.status === 'completed' ? 'filled' : 'outlined'}
                      >
                        {event.icon}
                      </TimelineDot>
                      {index < getTrackingTimeline().length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Paper sx={{ p: 2, mb: 1 }}>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {event.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {format(new Date(event.date), 'dd MMMM yyyy в HH:mm', { locale: ru })}
                        </Typography>
                        {event.details && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {event.details}
                          </Typography>
                        )}
                      </Paper>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          {mode === 'set' ? 'Отмена' : 'Закрыть'}
        </Button>
        {mode === 'set' && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !trackingNumber.trim()}
            startIcon={loading ? <CircularProgress size={16} /> : <LocalShipping />}
          >
            {loading ? 'Отправка...' : 'Отправить заказ'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default TrackingDialog
