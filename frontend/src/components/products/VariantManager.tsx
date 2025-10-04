import React, { useState, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  IconButton,
  Button,
  Grid,
  Chip,
  Alert,
  Divider,
  Paper,
  Stack,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material'
import {
  Add,
  Delete,
  Edit,
  ContentCopy,
  Warning,
  CheckCircle,
  DragIndicator,
} from '@mui/icons-material'
import { Controller, useFieldArray, Control } from 'react-hook-form'

interface VariantManagerProps {
  control: Control<any>
  watch: any
  setValue: any
  basePrice: number
  baseCurrency?: string
}

interface VariantGroup {
  type: string // Color, Size, Weight, etc.
  values: string[]
}

const VariantManager: React.FC<VariantManagerProps> = ({
  control,
  watch,
  setValue,
  basePrice,
  baseCurrency = 'USD'
}) => {
  const { fields: variantFields, append, remove, update } = useFieldArray({
    control,
    name: 'variants',
  })

  const [variantType, setVariantType] = useState<string>('')
  const [variantValue, setVariantValue] = useState<string>('')
  const [variantPrice, setVariantPrice] = useState<number | ''>('')
  const [variantStock, setVariantStock] = useState<number | ''>('')
  const [variantSku, setVariantSku] = useState<string>('')

  const watchedVariants = watch('variants') || []

  // Группировка вариантов по типам с useMemo
  const variantGroups = useMemo(() => {
    const groups: { [key: string]: any[] } = {}
    watchedVariants.forEach((variant: any, index: number) => {
      const type = variant.name || 'Без типа'
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push({ ...variant, index })
    })
    return groups
  }, [watchedVariants])

  // Предопределенные типы вариантов
  const commonVariantTypes = [
    'Цвет',
    'Размер',
    'Вес',
    'Объем',
    'Вкус',
    'Материал',
    'Стиль',
    'Комплектация',
  ]

  const addVariant = () => {
    if (!variantType || !variantValue) {
      return
    }

    const newVariant = {
      name: variantType,
      value: variantValue,
      price: variantPrice ? Number(variantPrice) : null,
      stock: variantStock ? Number(variantStock) : null,
      sku: variantSku || null,
    }

    append(newVariant)

    // Очистка полей после добавления
    setVariantValue('')
    setVariantPrice('')
    setVariantStock('')
    setVariantSku('')
  }

  const duplicateVariant = (index: number) => {
    const variant = watchedVariants[index]
    append({
      ...variant,
      value: `${variant.value} (копия)`,
    })
  }

  const removeVariantGroup = (type: string) => {
    const indices = watchedVariants
      .map((v: any, i: number) => (v.name === type ? i : -1))
      .filter((i: number) => i !== -1)
      .reverse()

    indices.forEach((i: number) => remove(i))
  }

  const getVariantPrice = (variant: any) => {
    return variant.price || basePrice
  }

  const totalStock = useMemo(() => {
    return watchedVariants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0)
  }, [watchedVariants])

  const hasStockWarning = (variant: any) => {
    return variant.stock !== null && variant.stock !== undefined && variant.stock < 5
  }

  return (
    <Box>
      <Stack spacing={3}>
        {/* Форма добавления варианта */}
        <Card sx={{ bgcolor: 'primary.50' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              Добавить новый вариант
            </Typography>
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={12} md={3}>
                <Box>
                  <FormControl fullWidth size="small">
                    <InputLabel>Тип варианта *</InputLabel>
                    <Select
                      value={commonVariantTypes.includes(variantType) ? variantType : 'custom'}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === 'custom') {
                          setVariantType('')
                        } else {
                          setVariantType(value)
                        }
                      }}
                      label="Тип варианта *"
                    >
                      {commonVariantTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                      <Divider />
                      <MenuItem value="custom">Другой...</MenuItem>
                    </Select>
                  </FormControl>
                  {!commonVariantTypes.includes(variantType) && (
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Введите свой тип"
                      value={variantType}
                      sx={{ mt: 1 }}
                      onChange={(e) => setVariantType(e.target.value)}
                      autoFocus
                    />
                  )}
                </Box>
              </Grid>

              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Значение *"
                  value={variantValue}
                  onChange={(e) => setVariantValue(e.target.value)}
                  placeholder="XL, Красный..."
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Цена"
                  value={variantPrice}
                  onChange={(e) => setVariantPrice(e.target.value ? Number(e.target.value) : '')}
                  placeholder={basePrice.toString()}
                  helperText="Базовая если пусто"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{baseCurrency}</InputAdornment>,
                    inputProps: { min: 0, step: 0.01 }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Количество"
                  value={variantStock}
                  onChange={(e) => setVariantStock(e.target.value ? Number(e.target.value) : '')}
                  helperText="На складе"
                  InputProps={{
                    inputProps: { min: 0 }
                  }}
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="SKU"
                  value={variantSku}
                  onChange={(e) => setVariantSku(e.target.value)}
                  placeholder="Опционально"
                />
              </Grid>

              <Grid item xs={12} md={1}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Add />}
                  onClick={addVariant}
                  disabled={!variantType || !variantValue}
                  size="large"
                >
                  Добавить
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Статистика */}
        {watchedVariants.length > 0 && (
          <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {watchedVariants.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Всего вариантов
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {Object.keys(variantGroups).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Типов вариантов
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box textAlign="center">
                  <Typography variant="h4" color="info.main">
                    {totalStock}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Всего на складе
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Список вариантов, сгруппированных по типам */}
        {Object.keys(variantGroups).length > 0 ? (
          Object.entries(variantGroups).map(([type, variants]) => (
            <Card key={type} variant="outlined">
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <DragIndicator color="action" />
                    <Typography variant="h6" color="primary">
                      {type}
                    </Typography>
                    <Chip
                      label={variants.length}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                  <Tooltip title={`Удалить все варианты типа "${type}"`}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeVariantGroup(type)}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Stack spacing={1}>
                  {variants.map((variant: any) => {
                    const price = getVariantPrice(variant)
                    const stockWarning = hasStockWarning(variant)

                    return (
                      <Paper
                        key={variant.index}
                        sx={{
                          p: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          '&:hover': {
                            bgcolor: 'action.hover',
                          },
                        }}
                        elevation={0}
                      >
                        <Box flex={1}>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={3}>
                              <Controller
                                name={`variants.${variant.index}.value`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    value={field.value ?? ''}
                                    size="small"
                                    fullWidth
                                    label="Значение"
                                    variant="outlined"
                                  />
                                )}
                              />
                            </Grid>

                            <Grid item xs={12} sm={2}>
                              <Controller
                                name={`variants.${variant.index}.price`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                    size="small"
                                    fullWidth
                                    type="number"
                                    label="Цена"
                                    variant="outlined"
                                    InputProps={{
                                      endAdornment: (
                                        <InputAdornment position="end">
                                          {baseCurrency}
                                        </InputAdornment>
                                      ),
                                      inputProps: { min: 0, step: 0.01 }
                                    }}
                                  />
                                )}
                              />
                            </Grid>

                            <Grid item xs={12} sm={2}>
                              <Controller
                                name={`variants.${variant.index}.stock`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                    size="small"
                                    fullWidth
                                    type="number"
                                    label="Кол-во"
                                    variant="outlined"
                                    error={stockWarning}
                                    InputProps={{
                                      inputProps: { min: 0 },
                                      endAdornment: stockWarning && (
                                        <InputAdornment position="end">
                                          <Tooltip title="Низкий запас">
                                            <Warning color="warning" fontSize="small" />
                                          </Tooltip>
                                        </InputAdornment>
                                      ),
                                    }}
                                  />
                                )}
                              />
                            </Grid>

                            <Grid item xs={12} sm={2}>
                              <Controller
                                name={`variants.${variant.index}.sku`}
                                control={control}
                                render={({ field }) => (
                                  <TextField
                                    {...field}
                                    value={field.value ?? ''}
                                    size="small"
                                    fullWidth
                                    label="SKU"
                                    variant="outlined"
                                  />
                                )}
                              />
                            </Grid>

                            <Grid item xs={12} sm={3}>
                              <Box display="flex" gap={1} alignItems="center">
                                <Chip
                                  label={`${price} ${baseCurrency}`}
                                  size="small"
                                  color={variant.price ? 'primary' : 'default'}
                                  icon={variant.price ? <CheckCircle /> : undefined}
                                />
                                {variant.stock !== null && variant.stock !== undefined && (
                                  <Chip
                                    label={`${variant.stock} шт.`}
                                    size="small"
                                    color={stockWarning ? 'warning' : 'success'}
                                  />
                                )}
                              </Box>
                            </Grid>
                          </Grid>
                        </Box>

                        <Box display="flex" gap={0.5}>
                          <Tooltip title="Дублировать">
                            <IconButton
                              size="small"
                              onClick={() => duplicateVariant(variant.index)}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => remove(variant.index)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    )
                  })}
                </Stack>
              </CardContent>
            </Card>
          ))
        ) : (
          <Alert severity="info" icon={<Warning />}>
            <Typography variant="body2">
              <strong>Вариантов пока нет.</strong> Добавьте варианты товара, если у него есть различные
              размеры, цвета, вкусы или другие характеристики. Каждый вариант может иметь свою
              цену и количество на складе.
            </Typography>
          </Alert>
        )}

        {/* Подсказки */}
        {watchedVariants.length > 0 && (
          <Alert severity="success">
            <Typography variant="body2">
              💡 <strong>Совет:</strong> Используйте разные типы вариантов для гибкой настройки.
              Например, можно создать варианты "Размер: S, M, L" и "Цвет: Красный, Синий".
              Покупатели смогут выбрать нужную комбинацию в боте.
            </Typography>
          </Alert>
        )}
      </Stack>
    </Box>
  )
}

export default VariantManager

