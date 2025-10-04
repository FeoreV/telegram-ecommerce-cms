import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Grid,
  IconButton,
  Alert,
  Stack,
  Avatar,
  Divider,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Visibility,
  Download,
  FilterList,
  Search,
  Person,
  Store,
  AttachMoney,
  AccessTime,
  Receipt,
  Close,
} from '@mui/icons-material';
import { green, red, orange, blue } from '@mui/material/colors';
import { orderService } from '../../services/orderService';
import { storeService } from '../../services/storeService';
import { toast } from 'react-toastify';

interface Order {
  id: string;
  orderNumber: string;
  customer: {
    firstName?: string;
    lastName?: string;
    username?: string;
    telegramId: string;
  };
  store: {
    name: string;
    id: string;
  };
  totalAmount: number;
  currency: string;
  status: string;
  paymentProof?: string;
  createdAt: string;
  items: Array<{
    product: {
      name: string;
      images?: string;
    };
    quantity: number;
    price: number;
  }>;
}

interface PaymentVerificationProps {
  onOrderUpdate?: (orderId: string, action: 'approve' | 'reject', reason?: string) => void;
}

const statusColors = {
  PENDING_ADMIN: orange[500],
  PAID: green[500],
  REJECTED: red[500],
  SHIPPED: blue[500],
  DELIVERED: green[700],
  CANCELLED: red[700],
};

const statusLabels = {
  PENDING_ADMIN: 'Ожидает подтверждения',
  PAID: 'Оплачен',
  REJECTED: 'Отклонен',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменен',
};

export default function PaymentVerification({ onOrderUpdate }: PaymentVerificationProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject';
    orderId: string;
  }>({ open: false, action: 'approve', orderId: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [filters, setFilters] = useState({
    status: 'PENDING_ADMIN',
    search: '',
    storeId: '',
  });
  const [stores, setStores] = useState<any[]>([]);

  // Load orders from API
  useEffect(() => {
    loadOrders();
    loadStores();
  }, [filters]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await orderService.getOrders({
        status: filters.status as any,
        search: filters.search,
        storeId: filters.storeId || undefined,
        limit: 100,
      });
      setOrders(response.items || []);
    } catch (error: any) {
      console.error('Error loading orders:', error);
      toast.error('Ошибка при загрузке заказов');
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const response = await storeService.getStores({ limit: 100 });
      setStores(response.items || []);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = !filters.status || order.status === filters.status;
    const matchesSearch = !filters.search || 
      order.orderNumber.toLowerCase().includes(filters.search.toLowerCase()) ||
      `${order.customer.firstName} ${order.customer.lastName}`.toLowerCase().includes(filters.search.toLowerCase()) ||
      order.customer.username?.toLowerCase().includes(filters.search.toLowerCase());
    const matchesStore = !filters.storeId || order.store.id === filters.storeId;

    return matchesStatus && matchesSearch && matchesStore;
  });

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleApproveOrder = (orderId: string) => {
    setActionDialog({ open: true, action: 'approve', orderId });
  };

  const handleRejectOrder = (orderId: string) => {
    setActionDialog({ open: true, action: 'reject', orderId });
    setRejectReason('');
  };

  const handleConfirmAction = async () => {
    const { action, orderId } = actionDialog;
    
    if (action === 'reject' && !rejectReason.trim()) {
      return;
    }

    try {
      if (action === 'approve') {
        await orderService.confirmPayment(orderId);
        toast.success('Оплата подтверждена');
      } else {
        await orderService.rejectOrder(orderId, { reason: rejectReason });
        toast.success('Заказ отклонен');
      }

      // Reload orders after action
      await loadOrders();

      // Call parent callback
      onOrderUpdate?.(orderId, action, action === 'reject' ? rejectReason : undefined);
    } catch (error: any) {
      console.error('Error processing order:', error);
      toast.error(error.response?.data?.error || 'Ошибка при обработке заказа');
    } finally {
      setActionDialog({ open: false, action: 'approve', orderId: '' });
      setRejectReason('');
      setDialogOpen(false);
    }
  };

  const getCustomerName = (customer: Order['customer']) => {
    const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    return fullName || customer.username || `User ${customer.telegramId}`;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const tabLabels = [
    'Ожидают подтверждения',
    'Все заказы',
    'Оплаченные',
    'Отклоненные',
  ];

  const tabStatuses = [
    'PENDING_ADMIN',
    '',
    'PAID',
    'REJECTED',
  ];

  return (
    <Box>
      {/* Header with tabs and filters */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Верификация оплат
        </Typography>
        
        <Tabs 
          value={currentTab} 
          onChange={(_, newValue) => {
            setCurrentTab(newValue);
            setFilters(prev => ({ ...prev, status: tabStatuses[newValue] }));
          }}
          sx={{ mb: 2 }}
        >
          {tabLabels.map((label, index) => (
            <Tab key={index} label={label} />
          ))}
        </Tabs>

        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Поиск по номеру заказа или клиенту"
            variant="outlined"
            size="small"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flexGrow: 1, maxWidth: 400 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Магазин</InputLabel>
            <Select
              value={filters.storeId}
              onChange={(e) => setFilters(prev => ({ ...prev, storeId: e.target.value }))}
              label="Магазин"
            >
              <MenuItem value="">Все магазины</MenuItem>
              {stores.map((store) => (
                <MenuItem key={store.id} value={store.id}>
                  {store.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <IconButton>
            <FilterList />
          </IconButton>
        </Stack>
      </Box>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Orders Grid */}
      {!loading && (
        <Grid container spacing={3}>
          {filteredOrders.map((order) => (
          <Grid item xs={12} md={6} lg={4} key={order.id}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                {/* Order Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" component="h3">
                    {order.orderNumber}
                  </Typography>
                  <Chip 
                    label={statusLabels[order.status as keyof typeof statusLabels]}
                    color={order.status === 'PENDING_ADMIN' ? 'warning' : 
                           order.status === 'PAID' ? 'success' : 'error'}
                    size="small"
                  />
                </Box>

                {/* Customer Info */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2, bgcolor: blue[500] }}>
                    <Person />
                  </Avatar>
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {getCustomerName(order.customer)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      @{order.customer.username || order.customer.telegramId}
                    </Typography>
                  </Box>
                </Box>

                {/* Store and Amount */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Store sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} />
                    <Typography variant="body2">
                      {order.store.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AttachMoney sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} />
                    <Typography variant="body1" fontWeight="medium">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AccessTime sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} />
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(order.createdAt)}
                    </Typography>
                  </Box>
                </Box>

                {/* Payment Proof */}
                {order.paymentProof && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Receipt sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} />
                      <Typography variant="body2">
                        Чек загружен
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>

              {/* Actions */}
              <Box sx={{ p: 2, pt: 0 }}>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Visibility />}
                    onClick={() => handleViewOrder(order)}
                    fullWidth
                  >
                    Просмотр
                  </Button>
                  
                  {order.status === 'PENDING_ADMIN' && (
                    <>
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        startIcon={<CheckCircle />}
                        onClick={() => handleApproveOrder(order.id)}
                      >
                        Одобрить
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        color="error"
                        startIcon={<Cancel />}
                        onClick={() => handleRejectOrder(order.id)}
                      >
                        Отклонить
                      </Button>
                    </>
                  )}
                </Stack>
              </Box>
            </Card>
          </Grid>
          ))}
        </Grid>
      )}

      {!loading && filteredOrders.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            Заказы не найдены
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Попробуйте изменить фильтры поиска
          </Typography>
        </Box>
      )}

      {/* Order Details Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedOrder && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Заказ {selectedOrder.orderNumber}
              </Typography>
              <IconButton onClick={() => setDialogOpen(false)}>
                <Close />
              </IconButton>
            </DialogTitle>
            
            <DialogContent>
              <Grid container spacing={3}>
                {/* Order Info */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Информация о заказе
                  </Typography>
                  
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Номер заказа"
                        secondary={selectedOrder.orderNumber}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Статус"
                        secondary={
                          <Chip 
                            label={statusLabels[selectedOrder.status as keyof typeof statusLabels]}
                            color={selectedOrder.status === 'PENDING_ADMIN' ? 'warning' : 
                                   selectedOrder.status === 'PAID' ? 'success' : 'error'}
                            size="small"
                          />
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Сумма"
                        secondary={formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Дата создания"
                        secondary={formatDate(selectedOrder.createdAt)}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Магазин"
                        secondary={selectedOrder.store.name}
                      />
                    </ListItem>
                  </List>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Клиент
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ mr: 2, bgcolor: blue[500] }}>
                      <Person />
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {getCustomerName(selectedOrder.customer)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        @{selectedOrder.customer.username || selectedOrder.customer.telegramId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Telegram ID: {selectedOrder.customer.telegramId}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                {/* Payment Proof */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Чек об оплате
                  </Typography>
                  
                  {selectedOrder.paymentProof ? (
                    <Box>
                      <CardMedia
                        component="img"
                        src={selectedOrder.paymentProof}
                        alt="Чек об оплате"
                        sx={{
                          maxHeight: 400,
                          objectFit: 'contain',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 2,
                        }}
                      />
                      <Button
                        variant="outlined"
                        startIcon={<Download />}
                        onClick={() => window.open(selectedOrder.paymentProof, '_blank')}
                        fullWidth
                      >
                        Скачать чек
                      </Button>
                    </Box>
                  ) : (
                    <Alert severity="warning">
                      Чек об оплате не загружен
                    </Alert>
                  )}
                </Grid>

                {/* Order Items */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Товары в заказе
                  </Typography>
                  
                  <List>
                    {selectedOrder.items.map((item, index) => (
                      <ListItem key={index} divider>
                        <ListItemText
                          primary={item.product.name}
                          secondary={`Количество: ${item.quantity}`}
                        />
                        <ListItemSecondaryAction>
                          <Typography variant="body1" fontWeight="medium">
                            {formatCurrency(item.price * item.quantity, selectedOrder.currency)}
                          </Typography>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions>
              {selectedOrder.status === 'PENDING_ADMIN' && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => handleApproveOrder(selectedOrder.id)}
                  >
                    Одобрить оплату
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => handleRejectOrder(selectedOrder.id)}
                  >
                    Отклонить
                  </Button>
                </>
              )}
              <Button onClick={() => setDialogOpen(false)}>
                Закрыть
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={actionDialog.open}
        onClose={() => setActionDialog({ open: false, action: 'approve', orderId: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {actionDialog.action === 'approve' ? 'Подтвердить оплату' : 'Отклонить заказ'}
        </DialogTitle>
        
        <DialogContent>
          {actionDialog.action === 'approve' ? (
            <Typography>
              Вы уверены, что хотите подтвердить оплату этого заказа?
            </Typography>
          ) : (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Укажите причину отклонения заказа:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Например: Неверная сумма, подозрительный документ..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                error={!rejectReason.trim()}
                helperText={!rejectReason.trim() ? 'Причина обязательна для заполнения' : ''}
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setActionDialog({ open: false, action: 'approve', orderId: '' })}>
            Отмена
          </Button>
          <Button
            variant="contained"
            color={actionDialog.action === 'approve' ? 'success' : 'error'}
            onClick={handleConfirmAction}
            disabled={actionDialog.action === 'reject' && !rejectReason.trim()}
          >
            {actionDialog.action === 'approve' ? 'Подтвердить' : 'Отклонить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
