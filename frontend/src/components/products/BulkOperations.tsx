import {
    Cancel,
    Category,
    Delete,
    Inventory,
    LocalOffer,
    MoreHoriz,
    Visibility,
    VisibilityOff
} from '@mui/icons-material'
import {
    Alert,
    Badge,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Fab,
    FormControl,
    Grid,
    InputLabel,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Select,
    TextField,
    Typography
} from '@mui/material'
import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { productService } from '../../services/productService'
import { Category as CategoryType, Product } from '../../types'

interface BulkOperationsProps {
  products: Product[]
  selectedProducts: string[]
  onSelectionChange: (selectedIds: string[]) => void
  categories: CategoryType[]
  onRefresh: () => void
}

type BulkOperation = 'activate' | 'deactivate' | 'delete' | 'update_category' | 'update_price' | 'update_stock' | 'toggle_visibility'

interface BulkUpdateData {
  operation: BulkOperation
  categoryId?: string
  priceMultiplier?: number
  fixedPrice?: number
  stockAdjustment?: number
  setStock?: number
  targetVisibility?: boolean
}

const BulkOperations: React.FC<BulkOperationsProps> = ({
  products,
  selectedProducts,
  onSelectionChange,
  categories,
  onRefresh,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<BulkOperation | null>(null)
  const [loading, setLoading] = useState(false)
  const [bulkData, setBulkData] = useState<BulkUpdateData>({
    operation: 'activate',
  })
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const selectedCount = selectedProducts.length
  const allSelected = products.length > 0 && selectedProducts.length === products.length
  const someSelected = selectedProducts.length > 0 && selectedProducts.length < products.length

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([])
    } else {
      onSelectionChange(products.map(p => p.id))
    }
  }

  const handleSelectProduct = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      onSelectionChange(selectedProducts.filter(id => id !== productId))
    } else {
      onSelectionChange([...selectedProducts, productId])
    }
  }

  const openBulkDialog = (operation: BulkOperation, targetVisibility?: boolean) => {
    setCurrentOperation(operation)
    setBulkData({ operation, targetVisibility })
    setDialogOpen(true)
    setAnchorEl(null)
  }

  const handleBulkOperation = async () => {
    if (!currentOperation || selectedProducts.length === 0) return

    setLoading(true)
    try {
      const promises = selectedProducts.map(async (productId) => {
        switch (currentOperation) {
          case 'activate':
            return productService.updateVisibility(productId, true)

          case 'deactivate':
            return productService.updateVisibility(productId, false)

          case 'toggle_visibility':
            return productService.updateVisibility(productId, bulkData.targetVisibility === true)

          case 'delete':
            return productService.deleteProduct(productId)

          case 'update_category':
            return productService.updateProduct(productId, {
              categoryId: bulkData.categoryId
            })

          case 'update_price': {
            const product = products.find(p => p.id === productId)
            if (!product) return Promise.resolve()

            let newPrice: number
            if (bulkData.fixedPrice !== undefined) {
              newPrice = bulkData.fixedPrice
            } else if (bulkData.priceMultiplier !== undefined) {
              newPrice = Number(product.price) * bulkData.priceMultiplier
            } else {
              return Promise.resolve()
            }

            return productService.updateProduct(productId, { price: newPrice })
          }
          case 'update_stock': {
            const currentProduct = products.find(p => p.id === productId)
            if (!currentProduct) return Promise.resolve()

            let newStock: number
            if (bulkData.setStock !== undefined) {
              newStock = bulkData.setStock
            } else if (bulkData.stockAdjustment !== undefined) {
              newStock = currentProduct.stock + bulkData.stockAdjustment
            } else {
              return Promise.resolve()
            }

            return productService.updateStock(productId, Math.max(0, newStock))
          }

          default:
            return Promise.resolve()
        }
      })

      await Promise.all(promises)

      const operationNames = {
        activate: 'активированы',
        deactivate: 'деактивированы',
        delete: 'удалены',
        update_category: 'категория обновлена',
        update_price: 'цены обновлены',
        update_stock: 'остатки обновлены',
        toggle_visibility: 'видимость обновлена',
      }

      toast.success(`Товары ${operationNames[currentOperation]} (${selectedProducts.length} шт.)`)

      // Очищаем выделение
      onSelectionChange([])

      // Обновляем список
      onRefresh()

      // Закрываем диалог
      setDialogOpen(false)
      setCurrentOperation(null)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при выполнении массовой операции')
    } finally {
      setLoading(false)
    }
  }

  const getOperationTitle = (operation: BulkOperation) => {
    const titles = {
      activate: 'Активировать товары',
      deactivate: 'Деактивировать товары',
      delete: 'Удалить товары',
      update_category: 'Изменить категорию',
      update_price: 'Изменить цены',
      update_stock: 'Изменить остатки',
      toggle_visibility: 'Изменить видимость',
    }
    return titles[operation]
  }

  const renderOperationContent = () => {
    switch (currentOperation) {
      case 'activate':
      case 'deactivate':
      case 'toggle_visibility':
        return (
          <Alert severity="info">
            {currentOperation === 'activate'
              ? 'Выбранные товары станут видимыми для покупателей'
              : currentOperation === 'deactivate'
              ? 'Выбранные товары будут скрыты от покупателей'
              : bulkData.targetVisibility
                ? 'Выбранные товары станут видимыми для покупателей'
                : 'Выбранные товары будут скрыты от покупателей'
            }
          </Alert>
        )

      case 'delete':
        return (
          <Alert severity="error">
            <Typography variant="body2">
              <strong>Внимание!</strong> Это действие необратимо.
              Все выбранные товары и их данные будут удалены навсегда.
            </Typography>
          </Alert>
        )

      case 'update_category':
        return (
          <FormControl fullWidth>
            <InputLabel>Новая категория</InputLabel>
            <Select
              value={bulkData.categoryId || ''}
              onChange={(e) => setBulkData(prev => ({ ...prev, categoryId: e.target.value }))}
              label="Новая категория"
            >
              <MenuItem value="">Без категории</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )

      case 'update_price':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Выберите способ изменения цены:
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Установить фиксированную цену"
                type="number"
                fullWidth
                value={bulkData.fixedPrice || ''}
                onChange={(e) => setBulkData(prev => ({
                  ...prev,
                  fixedPrice: Number(e.target.value),
                  priceMultiplier: undefined
                }))}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Установит одинаковую цену для всех товаров"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Коэффициент изменения"
                type="number"
                fullWidth
                value={bulkData.priceMultiplier || ''}
                onChange={(e) => setBulkData(prev => ({
                  ...prev,
                  priceMultiplier: Number(e.target.value),
                  fixedPrice: undefined
                }))}
                inputProps={{ min: 0, step: 0.1 }}
                helperText="1.0 = без изменений, 1.1 = +10%, 0.9 = -10%"
              />
            </Grid>
          </Grid>
        )

      case 'update_stock':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Выберите способ изменения остатков:
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Установить количество"
                type="number"
                fullWidth
                value={bulkData.setStock || ''}
                onChange={(e) => setBulkData(prev => ({
                  ...prev,
                  setStock: Number(e.target.value),
                  stockAdjustment: undefined
                }))}
                inputProps={{ min: 0 }}
                helperText="Установит одинаковое количество для всех товаров"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Изменить на количество"
                type="number"
                fullWidth
                value={bulkData.stockAdjustment || ''}
                onChange={(e) => setBulkData(prev => ({
                  ...prev,
                  stockAdjustment: Number(e.target.value),
                  setStock: undefined
                }))}
                helperText="+ для добавления, - для уменьшения"
              />
            </Grid>
          </Grid>
        )

      default:
        return null
    }
  }

  return (
    <>
      {/* Панель выделения */}
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={handleSelectAll}
          inputProps={{ 'aria-label': 'select all products' }}
        />

        <Typography variant="body2" color="text.secondary">
          {selectedCount > 0
            ? `Выбrano: ${selectedCount} из ${products.length}`
            : 'Выбрать все товары'
          }
        </Typography>

        {selectedCount > 0 && (
          <Box display="flex" alignItems="center" gap={1} ml={2}>
            {/* Основные кнопки */}
            <Button
              size="small"
              startIcon={<Visibility />}
              onClick={() => openBulkDialog('activate')}
              color="success"
            >
              Активировать
            </Button>

            <Button
              size="small"
              startIcon={<VisibilityOff />}
              onClick={() => openBulkDialog('deactivate')}
              color="warning"
            >
              Деактивировать
            </Button>

            {/* Меню с дополнительными операциями */}
            <Button
              size="small"
              startIcon={<MoreHoriz />}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              Еще
            </Button>

            <Button
              size="small"
              startIcon={<Cancel />}
              onClick={() => onSelectionChange([])}
              color="secondary"
            >
              Отменить
            </Button>
          </Box>
        )}
      </Box>

      {/* Floating Action Button для мобильных устройств */}
      {selectedCount > 0 && (
        <Fab
          size="medium"
          color="primary"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            display: { xs: 'flex', md: 'none' },
          }}
        >
          <Badge badgeContent={selectedCount} color="secondary">
            <MoreHoriz />
          </Badge>
        </Fab>
      )}

      {/* Меню массовых операций */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => openBulkDialog('toggle_visibility', true)}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          <ListItemText>Установить видимым</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openBulkDialog('toggle_visibility', false)}>
          <ListItemIcon>
            <VisibilityOff fontSize="small" />
          </ListItemIcon>
          <ListItemText>Установить скрытым</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={() => openBulkDialog('update_category')}>
          <ListItemIcon>
            <Category fontSize="small" />
          </ListItemIcon>
          <ListItemText>Изменить категорию</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => openBulkDialog('update_price')}>
          <ListItemIcon>
            <LocalOffer fontSize="small" />
          </ListItemIcon>
          <ListItemText>Изменить цены</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => openBulkDialog('update_stock')}>
          <ListItemIcon>
            <Inventory fontSize="small" />
          </ListItemIcon>
          <ListItemText>Изменить остатки</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => openBulkDialog('delete')}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Удалить товары</ListItemText>
        </MenuItem>
      </Menu>

      {/* Диалог массовых операций */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {currentOperation && getOperationTitle(currentOperation)}
          <Typography variant="body2" color="text.secondary">
            Применить к {selectedCount} товарам
          </Typography>
        </DialogTitle>

        <DialogContent>
          {currentOperation && renderOperationContent()}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={handleBulkOperation}
            variant="contained"
            disabled={loading}
            color={currentOperation === 'delete' ? 'error' : 'primary'}
          >
            {loading ? 'Обработка...' : 'Применить'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default BulkOperations
