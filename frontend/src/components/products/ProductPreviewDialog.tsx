import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Tooltip,
  Alert,
} from '@mui/material'
import {
  Close,
  Edit,
  Store,
  Category,
  Inventory,
  LocalOffer,
  Visibility,
  VisibilityOff,
  Warning,
  TrendingUp,
  Schedule,
  PhotoLibrary,
  ExpandMore,
  ShoppingCart,
  Star,
  Image as ImageIcon,
} from '@mui/icons-material'
import { Product } from '../../types'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface ProductPreviewDialogProps {
  open: boolean
  onClose: () => void
  product: Product | null
  onEdit?: (product: Product) => void
}

const ProductPreviewDialog: React.FC<ProductPreviewDialogProps> = ({
  open,
  onClose,
  product,
  onEdit,
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  if (!product) return null

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
      return { color: 'error' as const, label: 'Нет в наличии', icon: <Warning /> }
    } else if (product.stock <= 10) {
      return { color: 'warning' as const, label: 'Мало товара', icon: <Warning /> }
    } else {
      return { color: 'success' as const, label: 'В наличии', icon: <Inventory /> }
    }
  }

  const stockStatus = getStockStatus()
  const mainImages = Array.isArray(product.images) ? product.images : []
  const hasImages = mainImages.length > 0

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{ 
        sx: { 
          height: '90vh',
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1,
        }}
      >
        <Box>
          <Typography variant="h5" component="div" gutterBottom>
            {product.name}
            {!product.isActive && (
              <Chip 
                label="Неактивен" 
                color="default" 
                size="small" 
                sx={{ ml: 2 }} 
              />
            )}
          </Typography>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Chip 
              icon={<Store />}
              label={product.store.name}
              size="small"
              color="primary"
              variant="outlined"
            />
            {product.category && (
              <Chip 
                icon={<Category />}
                label={product.category.name}
                size="small"
                variant="outlined"
              />
            )}
            {product.sku && (
              <Chip 
                icon={<LocalOffer />}
                label={`SKU: ${product.sku}`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          {onEdit && (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => onEdit(product)}
              size="small"
            >
              Редактировать
            </Button>
          )}
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Grid container spacing={0} sx={{ height: '100%' }}>
          {/* Левая панель - изображения */}
          <Grid item xs={12} md={5} sx={{ borderRight: { md: 1 }, borderColor: 'divider' }}>
            <Box sx={{ p: 3, height: '100%' }}>
              {hasImages ? (
                <>
                  {/* Основное изображение */}
                  <Card sx={{ mb: 2, aspectRatio: '1:1' }}>
                    <CardMedia
                      component="img"
                      image={mainImages[selectedImageIndex]}
                      alt={product.name}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </Card>

                  {/* Миниатюры */}
                  {mainImages.length > 1 && (
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {mainImages.map((image, index) => (
                        <Card
                          key={index}
                          sx={{
                            width: 60,
                            height: 60,
                            cursor: 'pointer',
                            border: selectedImageIndex === index ? 2 : 0,
                            borderColor: 'primary.main',
                            '&:hover': { opacity: 0.8 },
                          }}
                          onClick={() => setSelectedImageIndex(index)}
                        >
                          <CardMedia
                            component="img"
                            image={image}
                            alt={`${product.name} ${index + 1}`}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </Card>
                      ))}
                    </Box>
                  )}

                  <Box mt={2}>
                    <Chip
                      icon={<PhotoLibrary />}
                      label={`${mainImages.length} фото`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </>
              ) : (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  sx={{
                    height: 400,
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}
                >
                  <ImageIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    Нет изображений
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Изображения товара не загружены
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>

          {/* Правая панель - информация */}
          <Grid item xs={12} md={7}>
            <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
              {/* Цена и статус */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <Grid container alignItems="center" spacing={2}>
                  <Grid item xs>
                    <Typography variant="h4" fontWeight="bold">
                      {formatCurrency(Number(product.price))}
                    </Typography>
                  </Grid>
                  <Grid item>
                    <Badge
                      badgeContent={product.stock}
                      color={stockStatus.color}
                      showZero
                    >
                      <Box display="flex" alignItems="center" gap={1}>
                        {stockStatus.icon}
                        <Typography variant="body2">
                          {stockStatus.label}
                        </Typography>
                      </Box>
                    </Badge>
                  </Grid>
                </Grid>
              </Paper>

              {/* Описание */}
              {product.description && (
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom color="primary">
                    Описание товара
                  </Typography>
                  <Typography variant="body1" paragraph>
                    {product.description}
                  </Typography>
                </Box>
              )}

              {/* Варианты товара */}
              {product.variants && product.variants.length > 0 && (
                <Accordion sx={{ mb: 3 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6" color="primary">
                      Варианты товара ({product.variants.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Название</TableCell>
                            <TableCell>Значение</TableCell>
                            <TableCell>Цена</TableCell>
                            <TableCell>Остаток</TableCell>
                            <TableCell>SKU</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {product.variants.map((variant, index) => (
                            <TableRow key={index}>
                              <TableCell>{variant.name}</TableCell>
                              <TableCell>{variant.value}</TableCell>
                              <TableCell>
                                {variant.price ? formatCurrency(Number(variant.price)) : '—'}
                              </TableCell>
                              <TableCell>
                                {variant.stock !== undefined ? `${variant.stock} шт` : '—'}
                              </TableCell>
                              <TableCell>{variant.sku || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Статистика товара */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  Статистика
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <ShoppingCart color="action" />
                      <Typography variant="body2" color="text.secondary">
                        Всего заказов:
                      </Typography>
                    </Box>
                    <Typography variant="h6">
                      {product._count.orderItems || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Schedule color="action" />
                      <Typography variant="body2" color="text.secondary">
                        Создан:
                      </Typography>
                    </Box>
                    <Typography variant="body2">
                      {format(new Date(product.createdAt), 'dd MMMM yyyy', { locale: ru })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Schedule color="action" />
                      <Typography variant="body2" color="text.secondary">
                        Последнее обновление:
                      </Typography>
                    </Box>
                    <Typography variant="body2">
                      {format(new Date(product.updatedAt), 'dd MMMM yyyy, HH:mm', { locale: ru })}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Предупреждения */}
              <Box>
                {product.stock === 0 && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Товар закончился!</strong> Необходимо пополнить склад или деактивировать товар.
                    </Typography>
                  </Alert>
                )}
                
                {product.stock > 0 && product.stock <= 10 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Мало товара на складе!</strong> Рекомендуется пополнить запасы.
                    </Typography>
                  </Alert>
                )}

                {!product.isActive && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Товар неактивен</strong> и не отображается в каталоге для покупателей.
                    </Typography>
                  </Alert>
                )}

                {!product.description && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Нет описания товара.</strong> Добавьте описание для улучшения продаж.
                    </Typography>
                  </Alert>
                )}

                {mainImages.length === 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Нет изображений товара.</strong> Добавьте фотографии для привлечения покупателей.
                    </Typography>
                  </Alert>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>
          Закрыть
        </Button>
        {onEdit && (
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => onEdit(product)}
          >
            Редактировать товар
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default ProductPreviewDialog
