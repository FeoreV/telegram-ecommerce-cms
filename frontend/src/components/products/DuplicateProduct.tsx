import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  ContentCopy,
  Edit,
  Store,
  Category,
  LocalOffer,
  Inventory,
  Image,
  ExpandMore,
  Warning,
} from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { Product, Store as StoreType, Category as CategoryType } from '../../types'
import { productService, CreateProductRequest } from '../../services/productService'
import { toast } from 'react-toastify'

interface DuplicateProductProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  product: Product | null
  stores: StoreType[]
  categories: CategoryType[]
}

interface DuplicateOptions {
  name: string
  sku?: string
  price: number
  stock: number
  storeId: string
  categoryId?: string
  description?: string
  duplicateImages: boolean
  duplicateVariants: boolean
  isActive: boolean
  quantity: number
  namePrefix?: string
  nameSuffix?: string
  priceAdjustment: number
  priceAdjustmentType: 'fixed' | 'percent'
  stockAdjustment: number
}

const schema = yup.object({
  name: yup.string().required('Название товара обязательно').min(2, 'Минимум 2 символа'),
  price: yup.number().required('Цена обязательна').min(0, 'Цена не может быть отрицательной'),
  stock: yup.number().required('Количество на складе обязательно').min(0, 'Количество не может быть отрицательным'),
  storeId: yup.string().required('Выберите магазин'),
  quantity: yup.number().min(1, 'Минимум 1 копия').max(100, 'Максимум 100 копий'),
  priceAdjustment: yup.number(),
  stockAdjustment: yup.number(),
})

const DuplicateProduct: React.FC<DuplicateProductProps> = ({
  open,
  onClose,
  onSuccess,
  product,
  stores,
  categories,
}) => {
  const [loading, setLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<DuplicateOptions>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      name: '',
      sku: '',
      price: 0,
      stock: 0,
      storeId: '',
      categoryId: '',
      description: '',
      duplicateImages: true,
      duplicateVariants: true,
      isActive: true,
      quantity: 1,
      namePrefix: '',
      nameSuffix: ' (копия)',
      priceAdjustment: 0,
      priceAdjustmentType: 'fixed',
      stockAdjustment: 0,
    },
  })

  const watchedValues = watch()

  React.useEffect(() => {
    if (product && open) {
      reset({
        name: product.name + ' (копия)',
        sku: '', // SKU должен быть уникальным, поэтому очищаем
        price: Number(product.price),
        stock: product.stock,
        storeId: product.store.id,
        categoryId: product.category?.id || '',
        description: product.description || '',
        duplicateImages: true,
        duplicateVariants: true,
        isActive: true,
        quantity: 1,
        namePrefix: '',
        nameSuffix: ' (копия)',
        priceAdjustment: 0,
        priceAdjustmentType: 'fixed',
        stockAdjustment: 0,
      })
    }
  }, [product, open, reset])

  const generateDuplicates = () => {
    if (!product) return []

    const duplicates: CreateProductRequest[] = []
    
    for (let i = 0; i < watchedValues.quantity; i++) {
      let name = watchedValues.name
      let price = watchedValues.price
      let stock = watchedValues.stock
      
      // Для множественного дублирования добавляем номер
      if (watchedValues.quantity > 1) {
        name = `${watchedValues.namePrefix || ''}${product.name}${watchedValues.nameSuffix || ''} ${i + 1}`
      }
      
      // Применяем корректировку цены
      if (watchedValues.priceAdjustment !== 0) {
        if (watchedValues.priceAdjustmentType === 'percent') {
          price = watchedValues.price * (1 + watchedValues.priceAdjustment / 100)
        } else {
          price = watchedValues.price + watchedValues.priceAdjustment
        }
      }
      
      // Применяем корректировку остатков
      if (watchedValues.stockAdjustment !== 0) {
        stock = Math.max(0, watchedValues.stock + watchedValues.stockAdjustment)
      }

      duplicates.push({
        name: name.trim(),
        description: watchedValues.description,
        sku: watchedValues.sku ? `${watchedValues.sku}_${i + 1}` : undefined,
        price: Math.round(price * 100) / 100, // Округляем до копеек
        stock: Math.floor(stock),
        storeId: watchedValues.storeId,
        categoryId: watchedValues.categoryId || undefined,
        isActive: watchedValues.isActive,
        images: watchedValues.duplicateImages ? (Array.isArray(product.images) ? product.images : []) : [],
        variants: watchedValues.duplicateVariants && product.variants ? product.variants.map(variant => ({
          name: variant.name,
          value: variant.value,
          price: variant.price ? Number(variant.price) : undefined,
          stock: variant.stock || undefined,
          sku: variant.sku || undefined,
        })) : [],
      })
    }
    
    return duplicates
  }

  const handleDuplicate = async (data: DuplicateOptions) => {
    if (!product) return

    setLoading(true)
    try {
      const duplicates = generateDuplicates()
      let successCount = 0
      let errorCount = 0

      for (const duplicate of duplicates) {
        try {
          await productService.createProduct(duplicate)
          successCount++
        } catch (error: any) {
          errorCount++
          console.error('Ошибка создания дубликата:', duplicate.name, error)
        }
      }

      if (successCount > 0) {
        toast.success(`Создано ${successCount} копий товара${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`)
        onSuccess()
        onClose()
      } else {
        toast.error('Не удалось создать ни одной копии товара')
      }
    } catch (error: any) {
      toast.error('Ошибка при дублировании товара: ' + error.response?.data?.error || error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ₽`
  }

  if (!product) return null

  const previewData = generateDuplicates()

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <ContentCopy color="primary" />
          Дублирование товара: {product.name}
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(handleDuplicate)}>
        <DialogContent>
          {!previewMode ? (
            <Grid container spacing={3}>
              {/* Основные параметры */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom color="primary">
                  Основные параметры копии
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={8}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Название нового товара"
                      fullWidth
                      error={!!errors.name}
                      helperText={errors.name?.message as string}
                      required
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="sku"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="SKU/Артикул"
                      fullWidth
                      helperText="Оставьте пустым для автогенерации"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="storeId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.storeId}>
                      <InputLabel>Магазин *</InputLabel>
                      <Select {...field} label="Магазин *">
                        {stores.map((store) => (
                          <MenuItem key={store.id} value={store.id}>
                            {store.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Категория</InputLabel>
                      <Select {...field} label="Категория">
                        <MenuItem value="">Без категории</MenuItem>
                        {categories.map((category) => (
                          <MenuItem key={category.id} value={category.id}>
                            {category.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Корректировки цены и остатков */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
                  Корректировки
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="price"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Базовая цена"
                      type="number"
                      fullWidth
                      error={!!errors.price}
                      helperText={errors.price?.message as string}
                      required
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="priceAdjustment"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Корректировка цены"
                      type="number"
                      fullWidth
                      helperText={
                        watchedValues.priceAdjustmentType === 'percent' 
                          ? 'В процентах (+10 = +10%)' 
                          : 'В рублях (+100 = +100₽)'
                      }
                      InputProps={{
                        endAdornment: watchedValues.priceAdjustmentType === 'percent' ? '%' : '₽'
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Controller
                  name="priceAdjustmentType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Тип корректировки</InputLabel>
                      <Select {...field} label="Тип корректировки">
                        <MenuItem value="fixed">Фиксированная сумма</MenuItem>
                        <MenuItem value="percent">Процент</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="stock"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Базовое количество"
                      type="number"
                      fullWidth
                      error={!!errors.stock}
                      helperText={errors.stock?.message as string}
                      required
                      inputProps={{ min: 0 }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="stockAdjustment"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Корректировка остатков"
                      type="number"
                      fullWidth
                      helperText="Добавить/убавить к базовому количеству"
                      InputProps={{
                        endAdornment: 'шт'
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Множественное дублирование */}
              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6" color="primary">
                      Множественное дублирование
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Controller
                          name="quantity"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Количество копий"
                              type="number"
                              fullWidth
                              error={!!errors.quantity}
                              helperText={errors.quantity?.message as string}
                              inputProps={{ min: 1, max: 100 }}
                            />
                          )}
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <Controller
                          name="namePrefix"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Префикс названия"
                              fullWidth
                              helperText="Добавится в начало названия"
                            />
                          )}
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <Controller
                          name="nameSuffix"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="Суффикс названия"
                              fullWidth
                              helperText="Добавится в конец названия"
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>

              {/* Дополнительные опции */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
                  Что копировать
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="duplicateImages"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Image fontSize="small" />
                          Изображения ({Array.isArray(product.images) ? product.images.length : 0})
                        </Box>
                      }
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="duplicateVariants"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <LocalOffer fontSize="small" />
                          Варианты товара ({product.variants?.length || 0})
                        </Box>
                      }
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="Товар активен"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Описание товара"
                      fullWidth
                      multiline
                      rows={3}
                    />
                  )}
                />
              </Grid>
            </Grid>
          ) : (
            /* Режим предварительного просмотра */
            <Box>
              <Typography variant="h6" gutterBottom color="primary">
                Предварительный просмотр ({previewData.length} товаров)
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {previewData.map((item, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <Typography variant="h6">{item.name}</Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {item.description}
                        </Typography>
                        <Box display="flex" gap={1} flexWrap="wrap">
                          <Chip icon={<Store />} label={stores.find(s => s.id === item.storeId)?.name} size="small" />
                          {item.categoryId && (
                            <Chip 
                              icon={<Category />} 
                              label={categories.find(c => c.id === item.categoryId)?.name} 
                              size="small" 
                            />
                          )}
                          {item.sku && <Chip icon={<LocalOffer />} label={item.sku} size="small" />}
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="h5" color="primary">
                          {formatCurrency(item.price)}
                        </Typography>
                        <Typography variant="body2">
                          Остаток: {item.stock} шт
                        </Typography>
                        <Box mt={1}>
                          {item.images?.length > 0 && (
                            <Chip 
                              label={`${item.images.length} изображений`} 
                              size="small" 
                              color="info" 
                            />
                          )}
                          {item.variants?.length > 0 && (
                            <Chip 
                              label={`${item.variants.length} вариантов`} 
                              size="small" 
                              color="secondary" 
                              sx={{ ml: 1 }} 
                            />
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}

              {previewData.length > 10 && (
                <Alert severity="warning">
                  Показаны только первые 10 товаров. Всего будет создано: {previewData.length}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          
          {!previewMode ? (
            <>
              <Button 
                onClick={() => setPreviewMode(true)}
                disabled={Object.keys(errors).length > 0}
              >
                Предварительный просмотр
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={<ContentCopy />}
              >
                {loading ? 'Создание...' : `Создать ${watchedValues.quantity} копий`}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setPreviewMode(false)}>
                Назад к редактированию
              </Button>
              <Button
                onClick={handleSubmit(handleDuplicate)}
                variant="contained"
                disabled={loading}
                startIcon={<ContentCopy />}
              >
                {loading ? 'Создание...' : `Подтвердить создание ${previewData.length} копий`}
              </Button>
            </>
          )}
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default DuplicateProduct
