import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  Button,
  Chip,
  Avatar,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Grid,
  ImageList,
  ImageListItem,
  Zoom,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Visibility,
  Download,
  Person,
  Payment,
  Store,
  Schedule,
  AttachMoney,
  Image,
  ZoomIn,
} from '@mui/icons-material'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import StatusChip from '../ui/StatusChip'
import AnimatedButton from '../ui/AnimatedButton'

interface PaymentProof {
  id: string
  type: 'image' | 'document'
  url: string
  filename: string
  uploadedAt: string
}

interface PaymentVerificationOrder {
  id: string
  orderNumber: string
  amount: number
  currency: string
  customerName: string
  customerTelegram: string
  storeName: string
  createdAt: string
  paymentProofs: PaymentProof[]
  notes?: string
}

interface PaymentVerificationCardProps {
  order: PaymentVerificationOrder
  onApprove: (orderId: string, notes?: string) => void
  onReject: (orderId: string, reason: string) => void
  loading?: boolean
}

const PaymentVerificationCard: React.FC<PaymentVerificationCardProps> = ({
  order,
  onApprove,
  onReject,
  loading = false,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')

  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency
    return `${amount.toLocaleString()} ${symbol}`
  }

  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString)
      return format(date, 'dd MMM yyyy, HH:mm', { locale: ru })
    } catch {
      return dateString
    }
  }

  const handleApprove = () => {
    setAction('approve')
    setDialogOpen(true)
  }

  const handleReject = () => {
    setAction('reject')
    setDialogOpen(true)
  }

  const handleConfirm = () => {
    if (action === 'approve') {
      onApprove(order.id, notes)
    } else if (action === 'reject') {
      onReject(order.id, reason)
    }
    setDialogOpen(false)
    setNotes('')
    setReason('')
    setAction(null)
  }

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl)
    setImageDialogOpen(true)
  }

  const downloadProof = (proof: PaymentProof) => {
    const link = document.createElement('a')
    link.href = proof.url
    link.download = proof.filename
    link.click()
  }

  return (
    <>
      <Card 
        sx={{ 
          mb: 2,
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 4,
          }
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Заказ #{order.orderNumber}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AttachMoney color="success" />
                <Typography variant="h5" color="success.main" fontWeight={600}>
                  {formatCurrency(order.amount, order.currency)}
                </Typography>
              </Box>
            </Box>
            <StatusChip label="Ожидает проверки" variant="warning" />
          </Box>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Person fontSize="small" color="action" />
                <Typography variant="body2">
                  <strong>Клиент:</strong> {order.customerName}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Telegram: @{order.customerTelegram}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Store fontSize="small" color="action" />
                <Typography variant="body2">
                  <strong>Магазин:</strong> {order.storeName}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {formatDate(order.createdAt)}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {order.notes && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Комментарий клиента:</strong> {order.notes}
              </Typography>
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Payment />
            Подтверждения оплаты ({order.paymentProofs.length})
          </Typography>

          {order.paymentProofs.length > 0 ? (
            <ImageList cols={4} gap={8} sx={{ mb: 2 }}>
              {order.paymentProofs.map((proof) => (
                <ImageListItem key={proof.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': { transform: 'scale(1.05)' }
                    }}
                    onClick={() => proof.type === 'image' && handleImageClick(proof.url)}
                  >
                    <Box
                      sx={{
                        height: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'grey.100',
                        position: 'relative',
                      }}
                    >
                      {proof.type === 'image' ? (
                        <>
                          <img
                            src={proof.url}
                            alt={proof.filename}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                          <IconButton
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              bgcolor: 'rgba(0,0,0,0.7)',
                              color: 'white',
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' }
                            }}
                            size="small"
                          >
                            <ZoomIn fontSize="small" />
                          </IconButton>
                        </>
                      ) : (
                        <Image sx={{ fontSize: 40, color: 'grey.500' }} />
                      )}
                    </Box>
                    <Box sx={{ p: 1, textAlign: 'center' }}>
                      <Typography variant="caption" noWrap>
                        {proof.filename}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadProof(proof)
                        }}
                      >
                        <Download fontSize="small" />
                      </IconButton>
                    </Box>
                  </Card>
                </ImageListItem>
              ))}
            </ImageList>
          ) : (
            <Alert severity="warning">
              Клиент не загрузил подтверждения оплаты
            </Alert>
          )}
        </CardContent>

        <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <AnimatedButton
            variant="contained"
            color="success"
            startIcon={<CheckCircle />}
            onClick={handleApprove}
            loading={loading}
            disabled={order.paymentProofs.length === 0}
          >
            Подтвердить
          </AnimatedButton>
          
          <AnimatedButton
            variant="outlined"
            color="error"
            startIcon={<Cancel />}
            onClick={handleReject}
            loading={loading}
          >
            Отклонить
          </AnimatedButton>
          
          <Button
            variant="text"
            startIcon={<Visibility />}
            size="small"
          >
            Подробнее
          </Button>
        </CardActions>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {action === 'approve' ? 'Подтвердить оплату' : 'Отклонить оплату'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Заказ #{order.orderNumber} на сумму {formatCurrency(order.amount, order.currency)}
          </Typography>
          
          {action === 'approve' ? (
            <TextField
              label="Комментарий (необязательно)"
              multiline
              rows={3}
              fullWidth
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Добавьте комментарий о подтверждении..."
            />
          ) : (
            <TextField
              label="Причина отклонения"
              multiline
              rows={3}
              fullWidth
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Укажите причину отклонения оплаты..."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            color={action === 'approve' ? 'success' : 'error'}
            disabled={action === 'reject' && !reason.trim()}
          >
            {action === 'approve' ? 'Подтвердить' : 'Отклонить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          {selectedImage && (
            <Zoom in={imageDialogOpen}>
              <img
                src={selectedImage}
                alt="Payment proof"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                }}
              />
            </Zoom>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialogOpen(false)}>
            Закрыть
          </Button>
          {selectedImage && (
            <Button
              startIcon={<Download />}
              onClick={() => {
                const link = document.createElement('a')
                link.href = selectedImage
                link.download = 'payment-proof.jpg'
                link.click()
              }}
            >
              Скачать
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}

export default PaymentVerificationCard
