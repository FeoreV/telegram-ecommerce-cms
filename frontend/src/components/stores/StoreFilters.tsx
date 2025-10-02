import React from 'react'
import {
  Paper,
  Grid,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  Button,
  Autocomplete,
} from '@mui/material'
import {
  Search,
  FilterList,
  Clear,
  AttachMoney,
  CalendarToday,
  Store,
} from '@mui/icons-material'
import { StoreFilters as IStoreFilters } from '../../services/storeService'

interface AdvancedStoreFilters extends IStoreFilters {
  currency?: string
  createdAfter?: string
  createdBefore?: string
  minProducts?: number
  maxProducts?: number
  minOrders?: number
  maxOrders?: number
  ownerId?: string
}

interface StoreFiltersProps {
  filters: AdvancedStoreFilters
  onFiltersChange: (filters: AdvancedStoreFilters) => void
  onReset: () => void
  totalCount: number
}

const currencies = [
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'RUB', label: 'RUB (₽)', symbol: '₽' },
  { value: 'UAH', label: 'UAH (₴)', symbol: '₴' },
  { value: 'KZT', label: 'KZT (₸)', symbol: '₸' },
]

const StoreFilters: React.FC<StoreFiltersProps> = ({
  filters: rawFilters,
  onFiltersChange,
  onReset,
  totalCount,
}) => {
  // Ensure filters is always defined
  const filters = rawFilters || {}
  const safeTotalCount = totalCount || 0
  const handleFilterChange = (field: keyof AdvancedStoreFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [field]: value,
      page: 1, // Reset to first page when filters change
    })
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.status) count++
    if (filters.currency) count++
    if (filters.createdAfter) count++
    if (filters.createdBefore) count++
    if (filters.minProducts !== undefined) count++
    if (filters.maxProducts !== undefined) count++
    if (filters.minOrders !== undefined) count++
    if (filters.maxOrders !== undefined) count++
    return count
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success'
      case 'INACTIVE': return 'default'
      case 'SUSPENDED': return 'error'
      default: return 'default'
    }
  }

  const activeFiltersCount = getActiveFiltersCount()

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <FilterList />
          <Typography variant="h6">
            Фильтры
          </Typography>
          {activeFiltersCount > 0 && (
            <Chip 
              label={`${activeFiltersCount} активных`} 
              color="primary" 
              size="small" 
            />
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" color="text.secondary">
            Найдено: {safeTotalCount} магазинов
          </Typography>
          {activeFiltersCount > 0 && (
            <Button 
              startIcon={<Clear />}
              onClick={onReset}
              size="small"
              color="warning"
            >
              Очистить
            </Button>
          )}
        </Box>
      </Box>

      {/* Basic Filters */}
      <Grid container spacing={2} alignItems="center" mb={2}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            placeholder="Поиск по названию, описанию или slug..."
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            size="small"
          />
        </Grid>

        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Статус</InputLabel>
            <Select
              value={filters.status || 'all'}
              onChange={(e) => handleFilterChange('status', e.target.value === 'all' ? undefined : e.target.value)}
              label="Статус"
            >
              <MenuItem value="all">Все</MenuItem>
              <MenuItem value="ACTIVE">Активные</MenuItem>
              <MenuItem value="INACTIVE">Неактивные</MenuItem>
              <MenuItem value="SUSPENDED">Заблокированные</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Валюта</InputLabel>
            <Select
              value={filters.currency || 'all'}
              onChange={(e) => handleFilterChange('currency', e.target.value === 'all' ? undefined : e.target.value)}
              label="Валюта"
            >
              <MenuItem value="all">Все</MenuItem>
              {(currencies || []).map((currency) => (
                <MenuItem key={currency.value} value={currency.value}>
                  {currency.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField
            fullWidth
            type="date"
            label="Создан после"
            value={filters.createdAfter || ''}
            onChange={(e) => handleFilterChange('createdAfter', e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField
            fullWidth
            type="date"
            label="Создан до"
            value={filters.createdBefore || ''}
            onChange={(e) => handleFilterChange('createdBefore', e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
        </Grid>
      </Grid>

      {/* Advanced Numeric Filters */}
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="number"
            label="Минимум товаров"
            value={filters.minProducts || ''}
            onChange={(e) => handleFilterChange('minProducts', e.target.value ? parseInt(e.target.value) : undefined)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Store />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="number"
            label="Максимум товаров"
            value={filters.maxProducts || ''}
            onChange={(e) => handleFilterChange('maxProducts', e.target.value ? parseInt(e.target.value) : undefined)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Store />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="number"
            label="Минимум заказов"
            value={filters.minOrders || ''}
            onChange={(e) => handleFilterChange('minOrders', e.target.value ? parseInt(e.target.value) : undefined)}
            size="small"
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="number"
            label="Максимум заказов"
            value={filters.maxOrders || ''}
            onChange={(e) => handleFilterChange('maxOrders', e.target.value ? parseInt(e.target.value) : undefined)}
            size="small"
          />
        </Grid>
      </Grid>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <Box display="flex" gap={1} mt={2} flexWrap="wrap">
          {filters.search && (
            <Chip
              label={`Поиск: "${filters.search}"`}
              onDelete={() => handleFilterChange('search', '')}
              size="small"
            />
          )}
          {filters.status && (
            <Chip
              label={`Статус: ${filters.status}`}
              color={getStatusColor(filters.status) as any}
              onDelete={() => handleFilterChange('status', undefined)}
              size="small"
            />
          )}
          {filters.currency && (
            <Chip
              icon={<AttachMoney />}
              label={`Валюта: ${filters.currency}`}
              onDelete={() => handleFilterChange('currency', undefined)}
              size="small"
            />
          )}
          {filters.createdAfter && (
            <Chip
              icon={<CalendarToday />}
              label={`От: ${new Date(filters.createdAfter).toLocaleDateString('ru-RU')}`}
              onDelete={() => handleFilterChange('createdAfter', '')}
              size="small"
            />
          )}
          {filters.createdBefore && (
            <Chip
              icon={<CalendarToday />}
              label={`До: ${new Date(filters.createdBefore).toLocaleDateString('ru-RU')}`}
              onDelete={() => handleFilterChange('createdBefore', '')}
              size="small"
            />
          )}
          {filters.minProducts !== undefined && (
            <Chip
              label={`Товары: от ${filters.minProducts}`}
              onDelete={() => handleFilterChange('minProducts', undefined)}
              size="small"
            />
          )}
          {filters.maxProducts !== undefined && (
            <Chip
              label={`Товары: до ${filters.maxProducts}`}
              onDelete={() => handleFilterChange('maxProducts', undefined)}
              size="small"
            />
          )}
          {filters.minOrders !== undefined && (
            <Chip
              label={`Заказы: от ${filters.minOrders}`}
              onDelete={() => handleFilterChange('minOrders', undefined)}
              size="small"
            />
          )}
          {filters.maxOrders !== undefined && (
            <Chip
              label={`Заказы: до ${filters.maxOrders}`}
              onDelete={() => handleFilterChange('maxOrders', undefined)}
              size="small"
            />
          )}
        </Box>
      )}
    </Paper>
  )
}

export default StoreFilters
