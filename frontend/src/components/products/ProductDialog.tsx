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
} from '@mui/material'
import {
  Add,
  Delete,
  CloudUpload,
  ExpandMore,
  Image as ImageIcon,
} from '@mui/icons-material'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { Product, Store, Category } from '../../types'
import { productService, CreateProductRequest, UpdateProductRequest } from '../../services/productService'
import { storeService } from '../../services/storeService'
import { toast } from 'react-toastify'

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
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {isEdit ? 'Редактировать товар' : 'Создать новый товар'}
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Basic Information */}
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

            {/* Images Section */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
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

            {/* Variants Section */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6" color="primary">
                    Варианты товара ({variantFields.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={addVariant}
                      sx={{ mb: 2 }}
                    >
                      Добавить вариант
                    </Button>

                    {variantFields.map((field, index) => (
                      <Card key={field.id} sx={{ mb: 2, p: 2 }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} sm={3}>
                            <Controller
                              name={`variants.${index}.name`}
                              control={control}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  label="Название варианта"
                                  fullWidth
                                  size="small"
                                  placeholder="Размер, Цвет, Вкус..."
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Controller
                              name={`variants.${index}.value`}
                              control={control}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  label="Значение"
                                  fullWidth
                                  size="small"
                                  placeholder="XL, Красный, Ванильный..."
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <Controller
                              name={`variants.${index}.price`}
                              control={control}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  label="Цена"
                                  type="number"
                                  fullWidth
                                  size="small"
                                  helperText="Если отличается"
                                  inputProps={{ min: 0, step: 0.01 }}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <Controller
                              name={`variants.${index}.stock`}
                              control={control}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  label="Количество"
                                  type="number"
                                  fullWidth
                                  size="small"
                                  helperText="Отдельно"
                                  inputProps={{ min: 0 }}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12} sm={2}>
                            <IconButton
                              color="error"
                              onClick={() => removeVariant(index)}
                              size="small"
                            >
                              <Delete />
                            </IconButton>
                          </Grid>
                        </Grid>
                      </Card>
                    ))}

                    {variantFields.length === 0 && (
                      <Alert severity="info">
                        <Typography variant="body2">
                          Добавьте варианты товара, если у него есть различные размеры, цвета или другие характеристики.
                        </Typography>
                      </Alert>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
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
