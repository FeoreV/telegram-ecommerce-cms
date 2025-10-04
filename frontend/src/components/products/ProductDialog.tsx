import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Card,
  CardContent,
  CardMedia,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Tabs,
  Tab,
} from '@mui/material'
import {
  Add,
  Delete,
  CloudUpload,
  ExpandMore,
  Image as ImageIcon,
  Info,
  Category as CategoryIcon,
  Settings,
} from '@mui/icons-material'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { Product, Store, Category } from '../../types'
import { productService, CreateProductRequest, UpdateProductRequest } from '../../services/productService'
import { storeService } from '../../services/storeService'
import { toast } from 'react-toastify'
import VariantManager from './VariantManager'

const schema = yup.object({
  name: yup.string().required('Название товара обязательно').min(2, 'Минимум 2 символа'),
  description: yup.string().optional(),
  sku: yup.string().optional(),
  price: yup.number().required('Цена обязательна').min(0, 'Цена не может быть отрицательной'),
  stock: yup.number().required('Количество на складе обязательно').min(0, 'Количество не может быть отрицательным'),
  storeId: yup.string().required('Выберите магазин'),
  categoryId: yup.string().optional(),
  isActive: yup.boolean().default(true),
  images: yup.array().of(yup.string()).default([]),
  variants: yup.array().of(
    yup.object({
      name: yup.string().required('Название варианта обязательно'),
      value: yup.string().required('Значение варианта обязательно'),
      price: yup.number().optional().min(0, 'Цена не может быть отрицательной'),
      stock: yup.number().optional().min(0, 'Количество не может быть отрицательным'),
      sku: yup.string().optional(),
    })
  ).default([]),
})

type ProductFormData = {
  name: string
  description?: string
  sku?: string
  price: number
  stock: number
  storeId: string
  categoryId?: string
  isActive: boolean
  images: string[]
  variants: Array<{
    name: string
    value: string
    price?: number
    stock?: number
    sku?: string
  }>
}

interface ProductDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  product?: Product | null
}

const ProductDialog: React.FC<ProductDialogProps> = ({
  open,
  onClose,
  onSuccess,
  product,
}) => {
  const [loading, setLoading] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [stores, setStores] = useState<Store[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const isEdit = !!product

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<any>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      name: '',
      description: '',
      sku: '',
      price: 0,
      stock: 0,
      storeId: '',
      categoryId: '',
      isActive: true,
      images: [],
      variants: [],
    },
  })

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: 'variants',
  })

  const watchedImages = watch('images')

  useEffect(() => {
    if (open) {
      loadInitialData()
    }
  }, [open])

  useEffect(() => {
    if (product && open) {
      reset({
        name: product.name,
        description: product.description || '',
        sku: product.sku || '',
        price: Number(product.price),
        stock: product.stock,
        storeId: product.store.id,
        categoryId: product.category?.id || '',
        isActive: product.isActive,
        images: Array.isArray(product.images) ? product.images : [],
        variants: product.variants?.map(v => ({
          name: v.name,
          value: v.value,
          price: v.price ? Number(v.price) : undefined,
          stock: v.stock || undefined,
          sku: v.sku || '',
        })) || [],
      })
    } else if (!product && open) {
      reset({
        name: '',
        description: '',
        sku: '',
        price: 0,
        stock: 0,
        storeId: '',
        categoryId: '',
        isActive: true,
        images: [],
        variants: [],
      })
    }
  }, [product, open, reset])

  const loadInitialData = async () => {
    try {
      const [storesResponse, categoriesResponse] = await Promise.allSettled([
        storeService.getStores({ limit: 100 }),
        productService.getCategories(),
      ])

      if (storesResponse.status === 'fulfilled') {
        setStores(storesResponse.value.items)
      }
      if (categoriesResponse.status === 'fulfilled') {
        setCategories(categoriesResponse.value)
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    setImageUploading(true)
    try {
      const uploadPromises = Array.from(files).map(file => productService.uploadImage(file))
      const imageUrls = await Promise.all(uploadPromises)
      
      setValue('images', [...watchedImages, ...imageUrls])
      toast.success(`Загружено ${imageUrls.length} изображений`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при загрузке изображений')
    } finally {
      setImageUploading(false)
    }
  }

  const removeImage = (index: number) => {
    const newImages = watchedImages.filter((_, i) => i !== index)
    setValue('images', newImages)
  }

  const addVariant = () => {
    appendVariant({
      name: '',
      value: '',
      price: undefined,
      stock: undefined,
      sku: '',
    })
  }

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      console.log('ProductDialog - Submitting data:', data)
      
      if (isEdit && product) {
        const updateData: UpdateProductRequest = {
          name: data.name,
          description: data.description,
          sku: data.sku,
          price: data.price,
          stock: data.stock,
          categoryId: data.categoryId,
          isActive: data.isActive,
          images: data.images,
          variants: data.variants,
        }
        console.log('ProductDialog - Update data:', updateData)
        console.log('ProductDialog - Variants:', data.variants)
        await productService.updateProduct(product.id, updateData)
        toast.success('Товар обновлен!')
      } else {
        const createData: CreateProductRequest = {
          name: data.name,
          description: data.description,
          sku: data.sku,
          price: data.price,
          stock: data.stock,
          storeId: data.storeId,
          categoryId: data.categoryId,
          isActive: data.isActive,
          images: data.images,
          variants: data.variants,
        }
        await productService.createProduct(createData)
        toast.success('Товар создан!')
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при сохранении товара')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" component="span">
            {isEdit ? 'Редактировать товар' : 'Создать новый товар'}
          </Typography>
          {isEdit && product && (
            <Chip
              label={product.isActive ? 'Активен' : 'Не активен'}
              color={product.isActive ? 'success' : 'default'}
              size="small"
            />
          )}
        </Box>
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab icon={<Info />} iconPosition="start" label="Основная информация" />
            <Tab icon={<ImageIcon />} iconPosition="start" label="Изображения" />
            <Tab icon={<Settings />} iconPosition="start" label="Варианты товара" />
          </Tabs>
        </Box>
        <DialogContent>
          {/* Tab 0: Basic Information */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom color="primary">
                  Основная информация
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
                    label="Название товара"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message as string}
                    margin="normal"
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
                    margin="normal"
                    helperText="Уникальный код товара (необязательно)"
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
                    rows={4}
                    margin="normal"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Цена"
                    type="number"
                    fullWidth
                    error={!!errors.price}
                    helperText={errors.price?.message as string}
                    margin="normal"
                    required
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="stock"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Количество на складе"
                    type="number"
                    fullWidth
                    error={!!errors.stock}
                    helperText={errors.stock?.message as string}
                    margin="normal"
                    required
                    inputProps={{ min: 0 }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Товар активен"
                    sx={{ mt: 2 }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="storeId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth margin="normal" error={!!errors.storeId}>
                    <InputLabel>Магазин *</InputLabel>
                    <Select {...field} label="Магазин *" disabled={isEdit}>
                      {stores.map((store) => (
                        <MenuItem key={store.id} value={store.id}>
                          {store.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.storeId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                        {errors.storeId?.message as string}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Категория</InputLabel>
                    <Select 
                      {...field} 
                      value={field.value || ''} 
                      label="Категория"
                    >
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
            </Grid>
          )}

          {/* Tab 1: Images Section */}
          {activeTab === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom color="primary">
                  Изображения товара
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

            <Grid item xs={12}>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="image-upload"
                multiple
                type="file"
                onChange={handleImageUpload}
              />
              <label htmlFor="image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUpload />}
                  disabled={imageUploading}
                  sx={{ mb: 2 }}
                >
                  {imageUploading ? 'Загрузка...' : 'Загрузить изображения'}
                </Button>
              </label>

              <Grid container spacing={2}>
                {watchedImages.map((imageUrl, index) => (
                  <Grid item xs={6} sm={4} md={3} key={index}>
                    <Card>
                      <CardMedia
                        component="img"
                        height="120"
                        image={imageUrl}
                        alt={`Product image ${index + 1}`}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeImage(index)}
                        >
                          <Delete />
                        </IconButton>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                {watchedImages.length === 0 && (
                  <Grid item xs={12}>
                    <Box
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      sx={{
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 4,
                        bgcolor: 'action.hover',
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        Изображения не загружены
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Grid>
            </Grid>
          )}

          {/* Tab 2: Variants Section */}
          {activeTab === 2 && (
            <Box sx={{ py: 2 }}>
              <VariantManager
                control={control}
                watch={watch}
                setValue={setValue}
                basePrice={watch('price') || 0}
                baseCurrency={
                  stores.find(s => s.id === watch('storeId'))?.currency || 'USD'
                }
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || imageUploading}
          >
            {loading ? 'Сохранение...' : isEdit ? 'Обновить' : 'Создать'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default ProductDialog
