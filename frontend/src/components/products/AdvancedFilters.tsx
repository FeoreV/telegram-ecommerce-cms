import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Typography,
  Box,
  Chip,
  Divider,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker } from '@mui/x-date-pickers'
import { ExpandMore, FilterList, Clear } from '@mui/icons-material'
import { ru } from 'date-fns/locale'

export interface AdvancedFilterData {
  priceRange: [number, number]
  stockRange: [number, number]
  dateCreatedFrom?: Date
  dateCreatedTo?: Date
  dateUpdatedFrom?: Date
  dateUpdatedTo?: Date
  hasSales: boolean | null
  hasImages: boolean | null
  hasDescription: boolean | null
  hasVariants: boolean | null
  salesRange: [number, number]
  minOrderCount?: number
}

interface AdvancedFiltersProps {
  open: boolean
  onClose: () => void
  onApply: (filters: AdvancedFilterData) => void
  onClear: () => void
  currentFilters: AdvancedFilterData
  priceRange: [number, number]
  stockRange: [number, number]
  salesRange: [number, number]
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  open,
  onClose,
  onApply,
  onClear,
  currentFilters,
  priceRange,
  stockRange,
  salesRange,
}) => {
  const [filters, setFilters] = useState<AdvancedFilterData>(currentFilters)

  React.useEffect(() => {
    if (open) {
      setFilters(currentFilters)
    }
  }, [open, currentFilters])

  const handleApply = () => {
    onApply(filters)
    onClose()
  }

  const handleClear = () => {
    const clearedFilters: AdvancedFilterData = {
      priceRange: priceRange,
      stockRange: stockRange,
      salesRange: salesRange,
      hasSales: null,
      hasImages: null,
      hasDescription: null,
      hasVariants: null,
    }
    setFilters(clearedFilters)
    onClear()
  }

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString()} ₽`
  }

  const isFilterActive = () => {
    return (
      filters.priceRange[0] !== priceRange[0] ||
      filters.priceRange[1] !== priceRange[1] ||
      filters.stockRange[0] !== stockRange[0] ||
      filters.stockRange[1] !== stockRange[1] ||
      filters.salesRange[0] !== salesRange[0] ||
      filters.salesRange[1] !== salesRange[1] ||
      filters.dateCreatedFrom ||
      filters.dateCreatedTo ||
      filters.dateUpdatedFrom ||
      filters.dateUpdatedTo ||
      filters.hasSales !== null ||
      filters.hasImages !== null ||
      filters.hasDescription !== null ||
      filters.hasVariants !== null ||
      filters.minOrderCount
    )
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <FilterList color="primary" />
          Расширенные фильтры
        </Box>
      </DialogTitle>

      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
          {/* Ценовой диапазон */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Цена товара</Typography>
              {(filters.priceRange[0] !== priceRange[0] || filters.priceRange[1] !== priceRange[1]) && (
                <Chip size="small" label="Активен" color="primary" sx={{ ml: 2 }} />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ px: 2 }}>
                <Typography gutterBottom>
                  Диапазон: {formatCurrency(filters.priceRange[0])} — {formatCurrency(filters.priceRange[1])}
                </Typography>
                <Slider
                  value={filters.priceRange}
                  onChange={(_, newValue) => setFilters(prev => ({ ...prev, priceRange: newValue as [number, number] }))}
                  valueLabelDisplay="auto"
                  valueLabelFormat={formatCurrency}
                  min={priceRange[0]}
                  max={priceRange[1]}
                  step={Math.max(1, Math.floor((priceRange[1] - priceRange[0]) / 100))}
                />
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <TextField
                      label="Минимальная цена"
                      type="number"
                      fullWidth
                      size="small"
                      value={filters.priceRange[0]}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        priceRange: [Number(e.target.value), prev.priceRange[1]]
                      }))}
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Максимальная цена"
                      type="number"
                      fullWidth
                      size="small"
                      value={filters.priceRange[1]}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        priceRange: [prev.priceRange[0], Number(e.target.value)]
                      }))}
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Остатки на складе */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Остатки на складе</Typography>
              {(filters.stockRange[0] !== stockRange[0] || filters.stockRange[1] !== stockRange[1]) && (
                <Chip size="small" label="Активен" color="primary" sx={{ ml: 2 }} />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ px: 2 }}>
                <Typography gutterBottom>
                  Количество: {filters.stockRange[0]} — {filters.stockRange[1]} шт.
                </Typography>
                <Slider
                  value={filters.stockRange}
                  onChange={(_, newValue) => setFilters(prev => ({ ...prev, stockRange: newValue as [number, number] }))}
                  valueLabelDisplay="auto"
                  min={stockRange[0]}
                  max={stockRange[1]}
                  step={1}
                />
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <TextField
                      label="Минимальный остаток"
                      type="number"
                      fullWidth
                      size="small"
                      value={filters.stockRange[0]}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        stockRange: [Number(e.target.value), prev.stockRange[1]]
                      }))}
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Максимальный остаток"
                      type="number"
                      fullWidth
                      size="small"
                      value={filters.stockRange[1]}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        stockRange: [prev.stockRange[0], Number(e.target.value)]
                      }))}
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Даты */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Даты</Typography>
              {(filters.dateCreatedFrom || filters.dateCreatedTo || filters.dateUpdatedFrom || filters.dateUpdatedTo) && (
                <Chip size="small" label="Активен" color="primary" sx={{ ml: 2 }} />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Дата создания</Typography>
                </Grid>
                <Grid item xs={6}>
                  <DatePicker
                    label="От"
                    value={filters.dateCreatedFrom || null}
                    onChange={(date) => setFilters(prev => ({ ...prev, dateCreatedFrom: date || undefined }))}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <DatePicker
                    label="До"
                    value={filters.dateCreatedTo || null}
                    onChange={(date) => setFilters(prev => ({ ...prev, dateCreatedTo: date || undefined }))}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                
                <Grid item xs={12} sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Дата обновления</Typography>
                </Grid>
                <Grid item xs={6}>
                  <DatePicker
                    label="От"
                    value={filters.dateUpdatedFrom || null}
                    onChange={(date) => setFilters(prev => ({ ...prev, dateUpdatedFrom: date || undefined }))}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <DatePicker
                    label="До"
                    value={filters.dateUpdatedTo || null}
                    onChange={(date) => setFilters(prev => ({ ...prev, dateUpdatedTo: date || undefined }))}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Продажи */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Продажи</Typography>
              {(filters.salesRange[0] !== salesRange[0] || filters.salesRange[1] !== salesRange[1] || filters.minOrderCount) && (
                <Chip size="small" label="Активен" color="primary" sx={{ ml: 2 }} />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography gutterBottom>
                    Количество продаж: {filters.salesRange[0]} — {filters.salesRange[1]}
                  </Typography>
                  <Slider
                    value={filters.salesRange}
                    onChange={(_, newValue) => setFilters(prev => ({ ...prev, salesRange: newValue as [number, number] }))}
                    valueLabelDisplay="auto"
                    min={salesRange[0]}
                    max={salesRange[1]}
                    step={1}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Минимальное количество заказов"
                    type="number"
                    fullWidth
                    size="small"
                    value={filters.minOrderCount || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, minOrderCount: e.target.value ? Number(e.target.value) : undefined }))}
                    inputProps={{ min: 0 }}
                    helperText="Показать товары с минимальным количеством заказов"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Характеристики товара */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Характеристики товара</Typography>
              {(filters.hasSales !== null || filters.hasImages !== null || filters.hasDescription !== null || filters.hasVariants !== null) && (
                <Chip size="small" label="Активен" color="primary" sx={{ ml: 2 }} />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Наличие продаж</InputLabel>
                    <Select
                      value={filters.hasSales === null ? '' : filters.hasSales.toString()}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        hasSales: e.target.value === '' ? null : e.target.value === 'true' 
                      }))}
                      label="Наличие продаж"
                    >
                      <MenuItem value="">Все товары</MenuItem>
                      <MenuItem value="true">Есть продажи</MenuItem>
                      <MenuItem value="false">Нет продаж</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Наличие изображений</InputLabel>
                    <Select
                      value={filters.hasImages === null ? '' : filters.hasImages.toString()}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        hasImages: e.target.value === '' ? null : e.target.value === 'true' 
                      }))}
                      label="Наличие изображений"
                    >
                      <MenuItem value="">Все товары</MenuItem>
                      <MenuItem value="true">Есть изображения</MenuItem>
                      <MenuItem value="false">Нет изображений</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Наличие описания</InputLabel>
                    <Select
                      value={filters.hasDescription === null ? '' : filters.hasDescription.toString()}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        hasDescription: e.target.value === '' ? null : e.target.value === 'true' 
                      }))}
                      label="Наличие описания"
                    >
                      <MenuItem value="">Все товары</MenuItem>
                      <MenuItem value="true">Есть описание</MenuItem>
                      <MenuItem value="false">Нет описания</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Наличие вариантов</InputLabel>
                    <Select
                      value={filters.hasVariants === null ? '' : filters.hasVariants.toString()}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        hasVariants: e.target.value === '' ? null : e.target.value === 'true' 
                      }))}
                      label="Наличие вариантов"
                    >
                      <MenuItem value="">Все товары</MenuItem>
                      <MenuItem value="true">Есть варианты</MenuItem>
                      <MenuItem value="false">Нет вариантов</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {isFilterActive() && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Активны расширенные фильтры. Нажмите "Очистить все" для сброса.
              </Typography>
            </Alert>
          )}
        </LocalizationProvider>
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={handleClear} 
          startIcon={<Clear />}
          disabled={!isFilterActive()}
        >
          Очистить все
        </Button>
        <Button onClick={onClose}>
          Отмена
        </Button>
        <Button 
          variant="contained" 
          onClick={handleApply}
          startIcon={<FilterList />}
        >
          Применить фильтры
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AdvancedFilters
