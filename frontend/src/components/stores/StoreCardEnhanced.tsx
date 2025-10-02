import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Collapse,
  Grid,
  LinearProgress,
} from '@mui/material'
import {
  MoreVert,
  Store as StoreIcon,
  Edit,
  Delete,
  Block,
  CheckCircle,
  AttachMoney,
  Inventory,
  Receipt,
  People,
  ExpandMore,
  ExpandLess,
  Analytics,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material'
import { Store } from '../../types'
import { storeService } from '../../services/storeService'
import { toast } from 'react-toastify'
import StoreAnalytics from './StoreAnalytics'
import StoreAdminManagement from './StoreAdminManagement'

interface StoreCardEnhancedProps {
  store: Store
  onEdit: (store: Store) => void
  onRefresh: () => void
  showAnalytics?: boolean
}

const StoreCardEnhanced: React.FC<StoreCardEnhancedProps> = ({ 
  store, 
  onEdit, 
  onRefresh, 
  showAnalytics = false 
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false)
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleEdit = () => {
    onEdit(store)
    handleMenuClose()
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await storeService.deleteStore(store.id)
      toast.success('Магазин удален')
      onRefresh()
      setDeleteDialogOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при удалении магазина')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    setLoading(true)
    try {
      const newStatus = store.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await storeService.updateStore(store.id, { status: newStatus })
      toast.success(`Магазин ${newStatus === 'ACTIVE' ? 'активирован' : 'деактивирован'}`)
      onRefresh()
      handleMenuClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при изменении статуса')
    } finally {
      setLoading(false)
    }
  }

  const getStatusChip = () => {
    switch (store.status) {
      case 'ACTIVE':
        return <Chip label="Активен" color="success" size="small" />
      case 'INACTIVE':
        return <Chip label="Неактивен" color="default" size="small" />
      case 'SUSPENDED':
        return <Chip label="Заблокирован" color="error" size="small" />
      default:
        return <Chip label={store.status} size="small" />
    }
  }

  const formatCurrency = (currency: string) => {
    const currencyMap: Record<string, string> = {
      USD: '$',
      EUR: '€',
      RUB: '₽',
      UAH: '₴',
      KZT: '₸',
    }
    return currencyMap[currency] || currency
  }

  const getPerformanceIndicator = () => {
    // Простая эвристика производительности на основе данных магазина
    const orderCount = store._count?.orders || 0
    const productCount = store._count?.products || 0
    
    if (orderCount === 0) {
      return { color: 'text.secondary', icon: null, label: 'Нет данных' }
    } else if (orderCount < 5) {
      return { color: 'warning.main', icon: <TrendingDown />, label: 'Низкая' }
    } else if (orderCount < 20) {
      return { color: 'info.main', icon: <TrendingUp />, label: 'Средняя' }
    } else {
      return { color: 'success.main', icon: <TrendingUp />, label: 'Высокая' }
    }
  }

  const performance = getPerformanceIndicator()

  return (
    <>
      <Card 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 3,
          },
        }}
      >
        <CardContent sx={{ flex: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                sx={{
                  bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                  color: theme => theme.palette.primary.contrastText,
                  border: theme => `1px solid ${theme.palette.primary.main}`,
                }}
              >
                {store.logoUrl ? (
                  <img src={store.logoUrl} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <StoreIcon />
                )}
              </Avatar>
              <Box>
                <Typography variant="h6" component="div" gutterBottom>
                  {store.name}
                </Typography>
                <Box display="flex" gap={1} alignItems="center">
                  {getStatusChip()}
                  <Chip 
                    icon={performance.icon}
                    label={`Активность: ${performance.label}`}
                    variant="outlined"
                    size="small"
                    sx={{ color: performance.color }}
                  />
                </Box>
              </Box>
            </Box>
            <IconButton onClick={handleMenuOpen} size="small">
              <MoreVert />
            </IconButton>
          </Box>

          {store.description && (
            <Typography variant="body2" color="text.secondary" mb={2}>
              {store.description.length > 100 
                ? `${store.description.substring(0, 100)}...` 
                : store.description
              }
            </Typography>
          )}

          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            <Chip 
              icon={<AttachMoney />}
              label={formatCurrency(store.currency)}
              variant="outlined"
              size="small"
            />
            <Chip 
              label={`/${store.slug}`}
              variant="outlined"
              size="small"
            />
          </Box>

          {/* Enhanced Metrics */}
          <Grid container spacing={1} mb={2}>
            <Grid item xs={4}>
              <Box textAlign="center" py={1}>
                <Typography variant="h6" color="primary.main" fontWeight="bold">
                  {store._count?.products || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Товары
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center" py={1}>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  {store._count?.orders || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Заказы
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center" py={1}>
                <Typography variant="h6" color="info.main" fontWeight="bold">
                  {store.admins?.length || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Админы
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Box mb={1}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Владелец:</strong> {store.owner.firstName} {store.owner.lastName}
            </Typography>
            
            {store.contactInfo?.phone && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Телефон:</strong> {store.contactInfo.phone}
              </Typography>
            )}

            {store.contactInfo?.email && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Email:</strong> {store.contactInfo.email}
              </Typography>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary">
            Создан: {new Date(store.createdAt).toLocaleDateString('ru-RU')}
          </Typography>
        </CardContent>

        <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
          <Box>
            <Button size="small" onClick={handleEdit} startIcon={<Edit />}>
              Редактировать
            </Button>
          </Box>
          <Box>
            {showAnalytics && (
              <Button 
                size="small" 
                startIcon={<Analytics />}
                endIcon={analyticsExpanded ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setAnalyticsExpanded(!analyticsExpanded)}
                sx={{ mr: 1 }}
              >
                Аналитика
              </Button>
            )}
            <Button 
              size="small" 
              color={store.status === 'ACTIVE' ? 'warning' : 'success'}
              onClick={handleToggleStatus}
              startIcon={store.status === 'ACTIVE' ? <Block /> : <CheckCircle />}
              disabled={loading}
            >
              {store.status === 'ACTIVE' ? 'Деактивировать' : 'Активировать'}
            </Button>
          </Box>
        </CardActions>

        {/* Analytics Expansion */}
        {showAnalytics && (
          <Collapse in={analyticsExpanded}>
            <CardContent sx={{ pt: 0, borderTop: '1px solid', borderColor: 'divider' }}>
              <StoreAnalytics store={store} period="month" />
            </CardContent>
          </Collapse>
        )}
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Редактировать
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setAdminDialogOpen(true)
            handleMenuClose()
          }}
        >
          <People fontSize="small" sx={{ mr: 1 }} />
          Администраторы
        </MenuItem>
        <MenuItem onClick={handleToggleStatus} disabled={loading}>
          {store.status === 'ACTIVE' ? (
            <>
              <Block fontSize="small" sx={{ mr: 1 }} />
              Деактивировать
            </>
          ) : (
            <>
              <CheckCircle fontSize="small" sx={{ mr: 1 }} />
              Активировать
            </>
          )}
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setDeleteDialogOpen(true)
            handleMenuClose()
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Удалить
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Подтвердите удаление</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить магазин "<strong>{store.name}</strong>"?
          </Typography>
          <Typography color="error" sx={{ mt: 1 }}>
            Это действие необратимо. Все данные магазина будут удалены.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Management Dialog */}
      <StoreAdminManagement
        store={store}
        open={adminDialogOpen}
        onClose={() => setAdminDialogOpen(false)}
        onRefresh={onRefresh}
      />
    </>
  )
}

export default StoreCardEnhanced
