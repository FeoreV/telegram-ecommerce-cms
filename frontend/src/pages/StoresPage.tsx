import {
    Add,
    Delete,
    Refresh
} from '@mui/icons-material'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    CircularProgress,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Pagination,
    Select,
    Typography
} from '@mui/material'
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import StoreCard from '../components/stores/StoreCard'
import StoreDialog from '../components/stores/StoreDialog'
import { useAuth } from '../contexts/AuthContext'
import { useStoresRealTime } from '../hooks/useRealTimeUpdates'
import { storeService } from '../services/storeService'
import { Store as StoreType } from '../types'

interface StoreFilters {
  search?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  sortBy?: 'name' | 'createdAt' | 'orders' | 'revenue'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

const StoresPage: React.FC = () => {
  const { user } = useAuth()
  const [stores, setStores] = useState<StoreType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<StoreType | null>(null)
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [filters, setFilters] = useState<StoreFilters>({
    page: 1,
    limit: 12,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    status: undefined,
  })
  const [totalPages, setTotalPages] = useState(0)

  const canCreateStore = user?.role === 'OWNER' || user?.role === 'ADMIN' || false

  const loadStores = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await storeService.getStores(filters || {})

      // Ensure response is valid
      if (!response) {
        throw new Error('Не удалось получить ответ от сервера')
      }

      // Safely extract data with fallbacks
      const storesData = Array.isArray(response.items) ? response.items : []

      setStores(storesData)
      setTotalPages(response?.pagination?.totalPages || Math.ceil(storesData.length / (filters?.limit || 12)))
      setSelectedStores([]) // Clear selection when stores change

    } catch (error: any) {
      console.error('Error loading stores:', error)
      const errorMessage = error?.response?.data?.error || error?.message || 'Ошибка при загрузке магазинов'
      setError(errorMessage)
      toast.error(errorMessage)

      // Reset all arrays to empty on error
      setStores([])
      setSelectedStores([])
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    if (filters) {
      loadStores()
    }
  }, [loadStores, filters])

  // Real-time updates
  useStoresRealTime(loadStores)

  const handleCreateStore = () => {
    setEditingStore(null)
    setDialogOpen(true)
  }

  const handleEditStore = (store: StoreType) => {
    setEditingStore(store)
    setDialogOpen(true)
  }

  const handleDeleteStore = async (storeId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот магазин?')) {
      return
    }

    try {
      await storeService.deleteStore(storeId)
      toast.success('Магазин удален')
      loadStores()
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Ошибка при удалении магазина')
    }
  }

  const handleStoreSuccess = () => {
    setDialogOpen(false)
    setEditingStore(null)
    loadStores()
  }

  const handleFilterChange = (newFilters: Partial<StoreFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }))
  }

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }

  const handleSelectStore = (storeId: string) => {
    setSelectedStores(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    )
  }

  const handleSelectAll = () => {
    const storesArray = stores || []
    setSelectedStores(
      selectedStores.length === storesArray.length
        ? []
        : storesArray.map(store => store.id)
    )
  }

  const handleBulkDelete = async () => {
    if (!selectedStores.length) return

    if (!window.confirm(`Вы уверены, что хотите удалить ${selectedStores.length} магазинов?`)) {
      return
    }

    try {
      await Promise.all(selectedStores.map(id => storeService.deleteStore(id)))
      toast.success(`${selectedStores.length} магазинов удалено`)
      setSelectedStores([])
      loadStores()
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Ошибка при удалении магазинов')
    }
  }

  if (loading && !(stores && stores.length)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Магазины
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Управляйте своими интернет-магазинами
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadStores}
          >
            Обновить
          </Button>
          {canCreateStore && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleCreateStore}
            >
              Создать магазин
            </Button>
          )}
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Статус</InputLabel>
                <Select
                  value={filters.status || ''}
                  label="Статус"
                  onChange={(e) => handleFilterChange({ status: e.target.value as any || undefined })}
                >
                  <MenuItem value="">Все</MenuItem>
                  <MenuItem value="ACTIVE">Активные</MenuItem>
                  <MenuItem value="INACTIVE">Неактивные</MenuItem>
                  <MenuItem value="SUSPENDED">Заблокированные</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Сортировка</InputLabel>
                <Select
                  value={filters.sortBy}
                  label="Сортировка"
                  onChange={(e) => handleFilterChange({ sortBy: e.target.value as any })}
                >
                  <MenuItem value="createdAt">По дате создания</MenuItem>
                  <MenuItem value="name">По названию</MenuItem>
                  <MenuItem value="orders">По заказам</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {selectedStores.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={handleBulkDelete}
                >
                  Удалить выбранные ({selectedStores.length})
                </Button>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {(stores && stores.length > 0) && (
        <Box mb={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedStores.length === (stores?.length || 0)}
                indeterminate={selectedStores.length > 0 && selectedStores.length < (stores?.length || 0)}
                onChange={handleSelectAll}
              />
            }
            label={`Выбрать все (${stores?.length || 0})`}
          />
        </Box>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stores Grid */}
      {(!stores || stores.length === 0) && !loading ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <div style={{ fontSize: 64, color: 'gray', marginBottom: 16 }}>🏪</div>
            <Typography variant="h6" gutterBottom>
              Магазины не найдены
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {filters.status || filters.search
                ? 'Попробуйте изменить фильтры поиска'
                : 'Создайте свой первый магазин'
              }
            </Typography>
            {canCreateStore && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateStore}
              >
                Создать магазин
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Grid container spacing={3}>
            {(stores || []).map((store) => (
              <Grid item xs={12} sm={6} lg={4} key={store.id}>
                <StoreCard
                  store={store}
                  selected={selectedStores.includes(store.id)}
                  onSelect={() => handleSelectStore(store.id)}
                  onEdit={() => handleEditStore(store)}
                  onDelete={() => handleDeleteStore(store.id)}
                />
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={filters.page || 1}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}

      {/* Store Form Dialog */}
      <StoreDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleStoreSuccess}
        store={editingStore}
      />
    </Box>
  )
}

export default StoresPage
