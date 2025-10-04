import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Avatar,
  Chip,
  Divider,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ImageList,
  ImageListItem,
  TextField,
  Tabs,
  Tab,
  Badge,
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
  Person,
  Store,
  Phone,
  Email,
  LocationOn,
  AttachMoney,
  CalendarToday,
  CheckCircle,
  Cancel,
  LocalShipping,
  Visibility,
  Close,
  ExpandMore,
  History,
  Receipt,
  Inventory,
  Notes,
  AdminPanelSettings,
  TrendingUp,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Order, AdminLog } from '../../types'
import { orderService } from '../../services/orderService'
import { toast } from 'react-toastify'
import { SecureImage } from '../common/SecureImage'
import { apiClient } from '../../services/apiClient'
import OrderNotesManager from './OrderNotesManager'

interface OrderDetailsDialogProps {
  open: boolean
  onClose: () => void
  order: Order
  onRefresh: () => void
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`order-details-tabpanel-${index}`}
      aria-labelledby={`order-details-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  )
}

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  open,
  onClose,
  order,
  onRefresh,
}) => {
  const [currentTab, setCurrentTab] = useState(0)
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && order.id) {
      loadAdminLogs()
    }
  }, [open, order.id])

  const loadAdminLogs = async () => {
    setLoading(true)
    try {
      const logs = await orderService.getOrderLogs(order.id)
      setAdminLogs(logs)
    } catch (error: any) {
      console.error('Error loading admin logs:', error)
      toast.error('Ошибка при загрузке логов администратора')
    } finally {
      setLoading(false)
    }
  }


  const getStatusColor = (status: string) => {
    const statusColors = {
      PENDING_ADMIN: 'warning',
      PAID: 'success',
      REJECTED: 'error',
      CANCELLED: 'default',
      SHIPPED: 'info',
      DELIVERED: 'success',
    }
    return statusColors[status as keyof typeof statusColors] || 'default'
  }

  const getStatusIcon = (status: string) => {
    const icons = {
      PENDING_ADMIN: <Notes />,
      PAID: <CheckCircle />,
      REJECTED: <Cancel />,
      CANCELLED: <Cancel />,
      SHIPPED: <LocalShipping />,
      DELIVERED: <CheckCircle />,
    }
    return icons[status as keyof typeof icons] || <Notes />
  }

  const getActionIcon = (action: string) => {
    const icons = {
      create_order: <Receipt />,
      confirm_payment: <CheckCircle />,
      reject_order: <Cancel />,
      cancel_order: <Cancel />,
      mark_shipped: <LocalShipping />,
      mark_delivered: <CheckCircle />,
      add_note: <Notes />,
    }
    return icons[action as keyof typeof icons] || <AdminPanelSettings />
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

  const tabs = [
    { label: 'Общая информация', icon: <Receipt /> },
    { label: 'Товары', icon: <Inventory />, badge: order.items.length },
    { label: 'История', icon: <History />, badge: adminLogs.length },
    { label: 'Заметки', icon: <Notes /> },
  ]

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" component="div">
              Заказ #{order.orderNumber}
            </Typography>
            <Box display="flex" alignItems="center" gap={2} mt={1}>
              <Chip
                label={order.status === 'PENDING_ADMIN' ? 'Ожидает подтверждения' : 
                      order.status === 'PAID' ? 'Оплачен' :
                      order.status === 'SHIPPED' ? 'Отправлен' :
                      order.status === 'DELIVERED' ? 'Доставлен' :
                      order.status === 'REJECTED' ? 'Отклонен' : order.status}
                color={getStatusColor(order.status) as any}
                icon={getStatusIcon(order.status)}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                {format(new Date(order.createdAt), 'dd MMMM yyyy, HH:mm', { locale: ru })}
              </Typography>
            </Box>
          </Box>
          <Typography variant="h4" color="primary" fontWeight="bold">
            {formatCurrency(order.totalAmount, order.currency)}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                label={
                  tab.badge ? (
                    <Badge badgeContent={tab.badge} color="primary">
                      <Box display="flex" alignItems="center" gap={1}>
                        {tab.icon}
                        {tab.label}
                      </Box>
                    </Badge>
                  ) : (
                    <Box display="flex" alignItems="center" gap={1}>
                      {tab.icon}
                      {tab.label}
                    </Box>
                  )
                }
              />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ px: 3 }}>
          {/* Общая информация */}
          <TabPanel value={currentTab} index={0}>
            <Grid container spacing={3}>
              {/* Информация о клиенте */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                      <Person /> Клиент
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
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
                          {customerData.name || `${order.customer.firstName} ${order.customer.lastName}`.trim() || 'Неизвестный клиент'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          @{order.customer.username || 'no_username'}
                        </Typography>
                      </Box>
                    </Box>

                    {customerData.phone && (
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Phone fontSize="small" color="action" />
                        <Typography variant="body2">{customerData.phone}</Typography>
                      </Box>
                    )}

                    {customerData.email && (
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Email fontSize="small" color="action" />
                        <Typography variant="body2">{customerData.email}</Typography>
                      </Box>
                    )}

                    {customerData.address && (
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <LocationOn fontSize="small" color="action" />
                        <Typography variant="body2">{customerData.address}</Typography>
                      </Box>
                    )}

                    <Box display="flex" alignItems="center" gap={1}>
                      <CalendarToday fontSize="small" color="action" />
                      <Typography variant="body2">
                        Telegram ID: {order.customer.telegramId}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Информация о магазине */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                      <Store /> Магазин
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
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
                        <Typography variant="subtitle1" fontWeight="medium">
                          {order.store.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          /{order.store.slug}
                        </Typography>
                      </Box>
                    </Box>

                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <AttachMoney fontSize="small" color="action" />
                      <Typography variant="body2">
                        Валюта: {order.currency}
                      </Typography>
                    </Box>

                    {order.store.contactInfo && (
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          Контактная информация:
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {JSON.stringify(order.store.contactInfo, null, 2)}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Детали заказа */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Детали заказа
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="h6" color="primary">
                            {order.items.length}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Товаров
                          </Typography>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="h6" color="primary">
                            {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Единиц
                          </Typography>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="h6" color="success.main">
                            {formatCurrency(order.totalAmount, order.currency)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Сумма
                          </Typography>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                          <Typography variant="h6" color="info.main">
                            {format(new Date(order.createdAt), 'dd.MM.yyyy')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Дата создания
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    {order.paymentProof && (
                      <Box mt={3}>
                        <Typography variant="subtitle2" gutterBottom>
                          Чек об оплате:
                        </Typography>
                        <Card sx={{ maxWidth: 400 }}>
                          <SecureImage
                            src={order.paymentProof}
                            alt="Чек об оплате"
                            sx={{
                              width: '100%',
                              height: 'auto',
                              maxHeight: 300,
                              objectFit: 'contain',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              // Download and open in new tab
                              apiClient.get(order.paymentProof!, { responseType: 'blob' })
                                .then(response => {
                                  const url = URL.createObjectURL(response.data);
                                  window.open(url, '_blank');
                                  setTimeout(() => URL.revokeObjectURL(url), 100);
                                })
                                .catch(() => toast.error('Не удалось открыть изображение'));
                            }}
                            onError={(e) => {
                              console.error('Error loading payment proof image');
                              toast.error('Не удалось загрузить изображение чека');
                            }}
                          />
                          <Box p={1} display="flex" justifyContent="center">
                            <Button
                              size="small"
                              startIcon={<Visibility />}
                              onClick={() => {
                                apiClient.get(order.paymentProof!, { responseType: 'blob' })
                                  .then(response => {
                                    const url = URL.createObjectURL(response.data);
                                    window.open(url, '_blank');
                                    setTimeout(() => URL.revokeObjectURL(url), 100);
                                  })
                                  .catch(() => toast.error('Не удалось открыть изображение'));
                              }}
                            >
                              Открыть в полном размере
                            </Button>
                          </Box>
                        </Card>
                      </Box>
                    )}

                    {order.notes && (
                      <Box mt={3}>
                        <Typography variant="subtitle2" gutterBottom>
                          Комментарий клиента:
                        </Typography>
                        <Alert severity="info">
                          <Typography variant="body2">{order.notes}</Typography>
                        </Alert>
                      </Box>
                    )}

                    {order.rejectionReason && (
                      <Box mt={2}>
                        <Alert severity="error">
                          <Typography variant="subtitle2" gutterBottom>
                            Причина отклонения:
                          </Typography>
                          <Typography variant="body2">{order.rejectionReason}</Typography>
                        </Alert>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Товары */}
          <TabPanel value={currentTab} index={1}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Товары в заказе ({order.items.length})
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Товар</TableCell>
                        <TableCell>Вариант</TableCell>
                        <TableCell align="center">Количество</TableCell>
                        <TableCell align="right">Цена за единицу</TableCell>
                        <TableCell align="right">Сумма</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {order.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={2}>
                              {item.product.images && item.product.images.length > 0 && (
                                <Avatar
                                  src={item.product.images[0]}
                                  variant="square"
                                  sx={{ width: 40, height: 40 }}
                                />
                              )}
                              <Box>
                                <Typography variant="subtitle2" fontWeight="medium">
                                  {item.product.name}
                                </Typography>
                                {item.product.sku && (
                                  <Typography variant="caption" color="text.secondary">
                                    SKU: {item.product.sku}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {item.variant ? (
                              <Chip
                                label={`${item.variant.name}: ${item.variant.value}`}
                                size="small"
                                variant="outlined"
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                Нет вариантов
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight="medium">
                              {item.quantity}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {formatCurrency(item.price, order.currency)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(item.price * item.quantity, order.currency)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="h6">
                            Итого:
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="h6" color="primary">
                            {formatCurrency(order.totalAmount, order.currency)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </TabPanel>

          {/* История действий */}
          <TabPanel value={currentTab} index={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  История действий администратора
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {loading ? (
                  <Box display="flex" justifyContent="center" p={3}>
                    <CircularProgress />
                  </Box>
                ) : adminLogs.length === 0 ? (
                  <Alert severity="info">
                    История действий пуста
                  </Alert>
                ) : (
                  <Timeline>
                    {adminLogs.map((log, index) => (
                      <TimelineItem key={log.id}>
                        <TimelineSeparator>
                          <TimelineDot color={
                            log.action.includes('confirm') ? 'success' :
                            log.action.includes('reject') || log.action.includes('cancel') ? 'error' :
                            'primary'
                          }>
                            {getActionIcon(log.action)}
                          </TimelineDot>
                          {index < adminLogs.length - 1 && <TimelineConnector />}
                        </TimelineSeparator>
                        <TimelineContent>
                          <Paper sx={{ p: 2, mb: 1 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                              <Box>
                                <Typography variant="subtitle2" fontWeight="medium">
                                  {log.action === 'create_order' ? 'Заказ создан' :
                                   log.action === 'confirm_payment' ? 'Оплата подтверждена' :
                                   log.action === 'reject_order' ? 'Заказ отклонен' :
                                   log.action === 'cancel_order' ? 'Заказ отменен' :
                                   log.action === 'mark_shipped' ? 'Заказ отправлен' :
                                   log.action === 'mark_delivered' ? 'Заказ доставлен' :
                                   log.action === 'add_note' ? 'Добавлена заметка' :
                                   log.action}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {log.admin.firstName} {log.admin.lastName} (@{log.admin.username})
                                </Typography>
                                {log.details && (
                                  <Typography variant="body2" sx={{ mt: 1 }}>
                                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                  </Typography>
                                )}
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm')}
                              </Typography>
                            </Box>
                          </Paper>
                        </TimelineContent>
                      </TimelineItem>
                    ))}
                  </Timeline>
                )}
              </CardContent>
            </Card>
          </TabPanel>

          {/* Заметки */}
          <TabPanel value={currentTab} index={3}>
            <OrderNotesManager
              order={order}
              onRefresh={onRefresh}
            />
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} startIcon={<Close />}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default OrderDetailsDialog
