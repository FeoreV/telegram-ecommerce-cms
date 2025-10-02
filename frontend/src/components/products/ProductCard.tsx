import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  Checkbox,
  Fade,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Badge,
  Tooltip,
  Avatar,
} from '@mui/material'
import {
  MoreVert,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
  Inventory,
  Store,
  Category,
  LocalOffer,
  Warning,
  ContentCopy,
} from '@mui/icons-material'
import { Product } from '../../types'
import { productService } from '../../services/productService'
import { toast } from 'react-toastify'

interface ProductCardProps {
  product: Product
  onEdit: (product: Product) => void
  onPreview?: (product: Product) => void
  onDuplicate?: (product: Product) => void
  onRefresh: () => void
  compact?: boolean
  selected?: boolean
  onSelect?: (selected: boolean) => void
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onEdit,
  onPreview,
  onDuplicate,
  onRefresh,
  compact = false,
  selected = false,
  onSelect,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newStock, setNewStock] = useState(product.stock)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleEdit = () => {
    onEdit(product)
    handleMenuClose()
  }

  const handlePreview = () => {
    if (onPreview) {
      onPreview(product)
    }
    handleMenuClose()
  }

  const handleDuplicate = () => {
    if (onDuplicate) {
      onDuplicate(product)
    }
    handleMenuClose()
  }

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation()
    if (onSelect) {
      onSelect(event.target.checked)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await productService.deleteProduct(product.id)
      toast.success('Товар удален')
      onRefresh()
      setDeleteDialogOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при удалении товара')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async () => {
    setLoading(true)
    try {
      await productService.toggleActive(product.id)
      toast.success(`Товар ${product.isActive ? 'деактивирован' : 'активирован'}`)
      onRefresh()
      handleMenuClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при изменении статуса')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStock = async () => {
    setLoading(true)
    try {
      await productService.updateStock(product.id, newStock)
      toast.success('Количество на складе обновлено')
      onRefresh()
      setStockDialogOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при обновлении количества')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency?: string) => {
    const currencyMap: Record<string, string> = {
      USD: '$',
      EUR: '€',
      RUB: '₽',
      UAH: '₴',
      KZT: '₸',
    }
    const currencySymbol = currency ? currencyMap[currency] || currency : '₽'
    return `${amount.toLocaleString()} ${currencySymbol}`
  }

  const getStockStatus = () => {
    if (product.stock === 0) {
      return { color: 'error' as const, label: 'Нет в наличии' }
    } else if (product.stock <= 10) {
      return { color: 'warning' as const, label: 'Мало товара' }
    } else {
      return { color: 'success' as const, label: 'В наличии' }
    }
  }

  const stockStatus = getStockStatus()
  const mainImage = Array.isArray(product.images) && product.images.length > 0 
    ? product.images[0] 
    : null

  if (compact) {
    return (
      <Card 
        sx={{ 
          display: 'flex', 
          mb: 1, 
          minHeight: 120,
          border: selected ? 2 : 0,
          borderColor: 'primary.main',
          bgcolor: selected ? 'action.selected' : 'background.paper',
          position: 'relative',
          '&:hover .product__checkbox': {
            opacity: 1,
          },
        }}
      >
        {onSelect && (
          <Box
            className="product__checkbox"
            position="absolute"
            top={8}
            left={8}
            sx={{
              opacity: selected ? 1 : 0,
              transition: 'opacity 0.2s',
              bgcolor: 'background.paper',
              borderRadius: 1,
              zIndex: 1,
            }}
          >
            <Checkbox
              checked={selected}
              onChange={handleSelect}
              size="small"
              sx={{ p: 0.5 }}
            />
          </Box>
        )}
        <CardMedia
          component="div"
          sx={{
            width: 120,
            minWidth: 120,
            backgroundImage: mainImage ? `url(${mainImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            bgcolor: mainImage ? 'transparent' : 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!mainImage && <Inventory sx={{ fontSize: 40, color: 'text.secondary' }} />}
        </CardMedia>
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <CardContent sx={{ flex: 1, p: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box flex={1}>
                <Typography variant="h6" component="div" noWrap>
                  {product.name}
                  {!product.isActive && (
                    <Chip label="Неактивен" color="default" size="small" sx={{ ml: 1 }} />
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {product.store.name}
                  {product.category && ` • ${product.category.name}`}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(Number(product.price))}
                  </Typography>
                  <Chip
                    label={`${product.stock} шт`}
                    color={stockStatus.color}
                    size="small"
                  />
                  {product.variants && product.variants.length > 0 && (
                    <Chip
                      label={`${product.variants.length} вариантов`}
                      variant="outlined"
                      size="small"
                    />
                  )}
                </Box>
              </Box>
              <IconButton onClick={handleMenuOpen} size="small">
                <MoreVert />
              </IconButton>
            </Box>
          </CardContent>
        </Box>
      </Card>
    )
  }

  return (
    <>
      <Card 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'transform 0.2s, box-shadow 0.2s',
          border: selected ? 2 : 0,
          borderColor: 'primary.main',
          bgcolor: selected ? 'action.selected' : 'background.paper',
          position: 'relative',
          cursor: onPreview ? 'pointer' : 'default',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 3,
          },
          '&:hover .product__checkbox': {
            opacity: 1,
          },
          opacity: product.isActive ? 1 : 0.7,
        }}
        onClick={onPreview ? () => onPreview(product) : undefined}
      >
        {onSelect && (
          <Box
            className="product__checkbox"
            position="absolute"
            top={8}
            left={8}
            sx={{
              opacity: selected ? 1 : 0,
              transition: 'opacity 0.2s',
              bgcolor: 'background.paper',
              borderRadius: 1,
              zIndex: 1,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onChange={handleSelect}
              size="small"
              sx={{ p: 0.5 }}
            />
          </Box>
        )}
        <Box position="relative">
          <CardMedia
            component="div"
            sx={{
              height: 200,
              backgroundImage: mainImage ? `url(${mainImage})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              bgcolor: mainImage ? 'transparent' : 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!mainImage && <Inventory sx={{ fontSize: 60, color: 'text.secondary' }} />}
          </CardMedia>

          <Box position="absolute" top={8} right={8}>
            <IconButton 
              size="small" 
              onClick={handleMenuOpen}
              sx={{ 
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 1)' }
              }}
            >
              <MoreVert />
            </IconButton>
          </Box>

          <Box position="absolute" top={8} left={8}>
            {!product.isActive && (
              <Chip 
                label="Неактивен" 
                color="default" 
                size="small"
                sx={{ bgcolor: 'rgba(255, 255, 255, 0.9)' }}
              />
            )}
          </Box>

          {product.stock === 0 && (
            <Box 
              position="absolute" 
              bottom={0} 
              left={0} 
              right={0} 
              bgcolor="rgba(255, 0, 0, 0.8)" 
              color="white" 
              p={0.5}
              textAlign="center"
            >
              <Typography variant="caption" fontWeight="bold">
                НЕТ В НАЛИЧИИ
              </Typography>
            </Box>
          )}
        </Box>

        <CardContent sx={{ flex: 1, p: 2 }}>
          <Box mb={1}>
            <Typography variant="h6" component="div" gutterBottom noWrap>
              {product.name}
            </Typography>
            
            {product.description && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {product.description.length > 100 
                  ? `${product.description.substring(0, 100)}...` 
                  : product.description
                }
              </Typography>
            )}
          </Box>

          <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
            <Chip 
              icon={<Store />}
              label={product.store.name}
              variant="outlined"
              size="small"
            />
            {product.category && (
              <Chip 
                icon={<Category />}
                label={product.category.name}
                variant="outlined"
                size="small"
              />
            )}
            {product.sku && (
              <Chip 
                icon={<LocalOffer />}
                label={product.sku}
                variant="outlined"
                size="small"
              />
            )}
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" fontWeight="bold" color="primary">
              {formatCurrency(Number(product.price))}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={`${product.stock} шт`}
                color={stockStatus.color}
                size="small"
                onClick={() => setStockDialogOpen(true)}
                sx={{ cursor: 'pointer' }}
              />
              {product.stock <= 10 && product.stock > 0 && (
                <Tooltip title="Мало товара на складе">
                  <Warning color="warning" fontSize="small" />
                </Tooltip>
              )}
            </Box>
          </Box>

          {product.variants && product.variants.length > 0 && (
            <Box mb={2}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Варианты товара:
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {product.variants.slice(0, 3).map((variant, index) => (
                  <Chip
                    key={index}
                    label={`${variant.name}: ${variant.value}`}
                    size="small"
                    variant="outlined"
                  />
                ))}
                {product.variants.length > 3 && (
                  <Chip
                    label={`+${product.variants.length - 3} еще`}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                )}
              </Box>
            </Box>
          )}

          <Box display="flex" gap={1} mt="auto">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Edit />}
              onClick={handleEdit}
              fullWidth
            >
              Редактировать
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={product.isActive ? <VisibilityOff /> : <Visibility />}
              onClick={handleToggleActive}
              disabled={loading}
              color={product.isActive ? "warning" : "success"}
            >
              {product.isActive ? 'Скрыть' : 'Показать'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {onPreview && (
          <MenuItem onClick={handlePreview}>
            <Visibility fontSize="small" sx={{ mr: 1 }} />
            Предварительный просмотр
          </MenuItem>
        )}
        <MenuItem onClick={handleEdit}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Редактировать
        </MenuItem>
        {onDuplicate && (
          <MenuItem onClick={handleDuplicate}>
            <ContentCopy fontSize="small" sx={{ mr: 1 }} />
            Дублировать
          </MenuItem>
        )}
        <MenuItem onClick={() => setStockDialogOpen(true)}>
          <Inventory fontSize="small" sx={{ mr: 1 }} />
          Изменить количество
        </MenuItem>
        <MenuItem onClick={handleToggleActive} disabled={loading}>
          {product.isActive ? (
            <>
              <VisibilityOff fontSize="small" sx={{ mr: 1 }} />
              Деактивировать
            </>
          ) : (
            <>
              <Visibility fontSize="small" sx={{ mr: 1 }} />
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
            Вы уверены, что хотите удалить товар "<strong>{product.name}</strong>"?
          </Typography>
          <Typography color="error" sx={{ mt: 1 }}>
            Это действие необратимо. Все данные о товаре будут удалены.
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

      {/* Stock Update Dialog */}
      <Dialog open={stockDialogOpen} onClose={() => setStockDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Изменить количество на складе</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Товар: <strong>{product.name}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Текущее количество: {product.stock} шт
          </Typography>
          <TextField
            label="Новое количество"
            type="number"
            fullWidth
            value={newStock}
            onChange={(e) => setNewStock(Number(e.target.value))}
            margin="normal"
            inputProps={{ min: 0 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockDialogOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={handleUpdateStock}
            variant="contained"
            disabled={loading || newStock === product.stock}
          >
            {loading ? 'Сохранение...' : 'Обновить'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ProductCard
