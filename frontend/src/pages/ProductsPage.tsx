import {
    Add,
    Category as CategoryIcon,
    FilterAlt,
    ImportExport,
    Refresh,
    Search,
    Store as StoreIcon,
    ViewList,
    ViewModule
} from '@mui/icons-material'
import {
    Badge,
    Box,
    Button,
    Chip,
    CircularProgress,
    Fab,
    FormControl,
    Grid,
    InputAdornment,
    InputLabel,
    MenuItem,
    Alert as MuiAlert,
    Paper,
    Select,
    Snackbar,
    Tab,
    Tabs,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography
} from '@mui/material'
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import AdvancedFilters, { AdvancedFilterData } from '../components/products/AdvancedFilters'
import BulkOperations from '../components/products/BulkOperations'
import CategoryManager from '../components/products/CategoryManager'
import DuplicateProduct from '../components/products/DuplicateProduct'
import EnhancedSorting from '../components/products/EnhancedSorting'
import ExportImport from '../components/products/ExportImport'
import KeyboardShortcutsHelp from '../components/products/KeyboardShortcutsHelp'
import ProductAnalytics from '../components/products/ProductAnalytics'
import ProductCard from '../components/products/ProductCard'
import ProductDialog from '../components/products/ProductDialog'
import ProductPreviewDialog from '../components/products/ProductPreviewDialog'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { productPageShortcuts, useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useProductsRealTime } from '../hooks/useRealTimeUpdates'
import { ProductFilters, productService } from '../services/productService'
import { storeService } from '../services/storeService'
import { Category, Product, Store } from '../types'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`products-tabpanel-${index}`}
      aria-labelledby={`products-tab-${index}`}
      {...other}
    >
      {value === index && children}
    </div>
  )
}

const ProductsPage: React.FC = () => {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false)
  const [exportImportOpen, setExportImportOpen] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [duplicatingProduct, setDuplicatingProduct] = useState<Product | null>(null)
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterData>({
    priceRange: [0, 100000],
    stockRange: [0, 1000],
    salesRange: [0, 100],
    hasSales: null,
    hasImages: null,
    hasDescription: null,
    hasVariants: null,
  })
  const [analyticsExpanded, setAnalyticsExpanded] = useState(true)
  const [shortcutMessage, setShortcutMessage] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'none' | 'store' | 'category' | 'status'>('none')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [activeTab, setActiveTab] = useState(0)
  const [filters, setFilters] = useState<ProductFilters>({
    page: 1,
    limit: 20,
    search: '',
    storeId: undefined,
    categoryId: undefined,
    isActive: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})

  const statusTabs = [
    { key: 'all', label: 'Все', isActive: undefined },
    { key: 'active', label: 'Активные', isActive: true },
    { key: 'inactive', label: 'Неактивные', isActive: false },
    { key: 'low_stock', label: 'Мало товара', filter: 'low_stock' },
    { key: 'out_of_stock', label: 'Нет в наличии', filter: 'out_of_stock' },
  ]

  const canCreateProduct = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'VENDOR'

  // Helper functions for shortcuts
  const showShortcutMessage = (message: string) => {
    setShortcutMessage(message)
    setTimeout(() => setShortcutMessage(null), 2000)
  }

  const handleSelectAllProducts = () => {
    const productsArray = products || []
    if (selectedProducts.length === productsArray.length) {
      setSelectedProducts([])
      showShortcutMessage('Выделение снято')
    } else {
      setSelectedProducts(productsArray.map(p => p.id))
      showShortcutMessage(`Выделено ${productsArray.length} товаров`)
    }
  }

  const handleDeleteSelected = () => {
    if (selectedProducts.length > 0) {
      // Здесь должна быть логика массового удаления
      showShortcutMessage(`Удаление ${selectedProducts.length} товаров...`)
    }
  }

  const handleToggleAnalytics = () => {
    setAnalyticsExpanded(!analyticsExpanded)
    showShortcutMessage(`Аналитика ${!analyticsExpanded ? 'показана' : 'скрыта'}`)
  }

  // Настройка горячих клавиш
  const { shortcuts } = useKeyboardShortcuts({
    shortcuts: [
      {
        ...productPageShortcuts.createProduct,
        callback: () => {
          if (canCreateProduct) {
            handleCreateProduct()
            showShortcutMessage('Создание нового товара')
          }
        },
      },
      {
        ...productPageShortcuts.search,
        callback: () => {
          const searchInput = document.querySelector('input[placeholder*="Поиск"]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
            searchInput.select()
          }
        },
      },
      {
        ...productPageShortcuts.refresh,
        callback: () => {
          handleRefresh()
          showShortcutMessage('Обновление данных...')
        },
      },
      {
        ...productPageShortcuts.selectAll,
        callback: handleSelectAllProducts,
      },
      {
        ...productPageShortcuts.delete,
        callback: handleDeleteSelected,
      },
      {
        ...productPageShortcuts.escape,
        callback: () => {
          setSelectedProducts([])
          showShortcutMessage('Выделение снято')
        },
      },
      {
        ...productPageShortcuts.filters,
        callback: () => {
          handleAdvancedFilters()
          showShortcutMessage('Расширенные фильтры')
        },
      },
      {
        ...productPageShortcuts.categories,
        callback: () => {
          handleCategoryManager()
          showShortcutMessage('Управление категориями')
        },
      },
      {
        ...productPageShortcuts.analytics,
        callback: handleToggleAnalytics,
      },
      {
        ...productPageShortcuts.gridView,
        callback: () => {
          setViewMode('grid')
          showShortcutMessage('Режим сетки')
        },
      },
      {
        ...productPageShortcuts.listView,
        callback: () => {
          setViewMode('list')
          showShortcutMessage('Режим списка')
        },
      },
      {
        ...productPageShortcuts.help,
        callback: () => {
          setKeyboardHelpOpen(true)
        },
      },
    ],
    enabled: true,
  })

  const loadStatusCounts = useCallback(async () => {
    try {
      // Load all products to count statuses
      const response = await productService.getProducts({
        limit: 1000,
        storeId: filters.storeId,
      })

      // Check if response and items exist
      if (!response || !response.items || !Array.isArray(response.items)) {
        console.warn('Invalid response format for products:', response)
        setStatusCounts({ all: 0, active: 0, inactive: 0, low_stock: 0, out_of_stock: 0 })
        return
      }

      const counts = {
        all: response.items.length,
        active: response.items.filter(p => p.isActive).length,
        inactive: response.items.filter(p => !p.isActive).length,
        low_stock: response.items.filter(p => p.stock > 0 && p.stock <= 10).length,
        out_of_stock: response.items.filter(p => p.stock === 0).length,
      }

      setStatusCounts(counts)
    } catch (error) {
      console.error('Error loading status counts:', error)
      // Set default counts on error
      setStatusCounts({ all: 0, active: 0, inactive: 0, low_stock: 0, out_of_stock: 0 })
    }
  }, [filters.storeId])

  const loadInitialData = useCallback(async () => {
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

      loadStatusCounts()
    } catch (error: any) {
      console.error('Error loading initial data:', error)
    }
  }, [loadStatusCounts])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      let currentFilters = {
        ...filters,
        isActive: statusTabs[activeTab].isActive,
      }

      // Special handling for stock-based tabs
      if (statusTabs[activeTab].filter === 'low_stock') {
        currentFilters = { ...currentFilters, isActive: true }
      } else if (statusTabs[activeTab].filter === 'out_of_stock') {
        currentFilters = { ...currentFilters, isActive: true }
      }

      const response = await productService.getProducts(currentFilters)

      // Check if response and items exist
      if (!response || !response.items || !Array.isArray(response.items)) {
        console.warn('Invalid response format for products:', response)
        setProducts([])
        setTotalPages(0)
        setTotalCount(0)
        return
      }

      let filteredProducts = response.items

      // Client-side filtering for stock-based tabs
      if (statusTabs[activeTab].filter === 'low_stock') {
        filteredProducts = response.items.filter(p => p.stock > 0 && p.stock <= 10)
      } else if (statusTabs[activeTab].filter === 'out_of_stock') {
        filteredProducts = response.items.filter(p => p.stock === 0)
      }

      setProducts(filteredProducts)
      setTotalPages(response.pagination?.totalPages || 0)
      setTotalCount(response.pagination?.total || 0)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при загрузке товаров')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [filters, activeTab, statusTabs])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  useEffect(() => {
    loadProducts()
  }, [filters, activeTab])

  // Real-time updates
  useProductsRealTime(() => {
    loadProducts()
    loadStatusCounts()
  })

  const handleCreateProduct = () => {
    setEditingProduct(null)
    setDialogOpen(true)
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  const handlePreviewProduct = (product: Product) => {
    setPreviewProduct(product)
    setPreviewDialogOpen(true)
  }

  const handleCategoryManager = () => {
    setCategoryManagerOpen(true)
  }

  const handleAdvancedFilters = () => {
    setAdvancedFiltersOpen(true)
  }

  const handleExportImport = () => {
    setExportImportOpen(true)
  }

  const handleDuplicateProduct = (product: Product) => {
    setDuplicatingProduct(product)
    setDuplicateDialogOpen(true)
  }

  const handleToggleView = () => {
    const newViewMode = viewMode === 'grid' ? 'list' : 'grid'
    setViewMode(newViewMode)
    showShortcutMessage(`Режим просмотра: ${newViewMode === 'grid' ? 'сетка' : 'список'}`)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingProduct(null)
  }

  const handleDialogSuccess = () => {
    loadProducts()
    loadStatusCounts()
  }

  const handleCategoryManagerSuccess = () => {
    loadInitialData() // Перезагружаем категории
    loadProducts()
  }

  const handleApplyAdvancedFilters = (filterData: AdvancedFilterData) => {
    setAdvancedFilters(filterData)
    // Здесь должна быть логика применения расширенных фильтров
    loadProducts()
    showShortcutMessage('Расширенные фильтры применены')
  }

  const handleClearAdvancedFilters = () => {
    setAdvancedFilters({
      priceRange: [0, 100000],
      stockRange: [0, 1000],
      salesRange: [0, 100],
      hasSales: null,
      hasImages: null,
      hasDescription: null,
      hasVariants: null,
    })
    loadProducts()
    showShortcutMessage('Фильтры очищены')
  }

  const handleRefresh = async () => {
    await loadProducts()
    await loadStatusCounts()
    toast.success('Данные обновлены')
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
    setFilters(prev => ({ ...prev, page: 1 }))
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({
      ...prev,
      search: event.target.value,
      page: 1,
    }))
  }

  const handleStoreChange = (storeId: string) => {
    setFilters(prev => ({
      ...prev,
      storeId: storeId === 'all' ? undefined : storeId,
      page: 1,
    }))
    loadStatusCounts()
  }

  const handleCategoryChange = (categoryId: string) => {
    setFilters(prev => ({
      ...prev,
      categoryId: categoryId === 'all' ? undefined : categoryId,
      page: 1,
    }))
  }

  const handleSortChange = (sortBy: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: sortBy as any,
      page: 1,
    }))
  }

  const handleLoadMore = () => {
    setFilters(prev => ({
      ...prev,
      page: (prev.page || 1) + 1,
    }))
  }

  const getTabLabel = (tab: any, index: number) => {
    const count = statusCounts[tab.key] || 0
    return (
      <Badge badgeContent={count} color="primary" showZero={false}>
        {tab.label}
      </Badge>
    )
  }

  if (loading && (!products || products.length === 0)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Товары"
        subtitle={`Управление товарами и запасами • Всего: ${totalCount}`}
        actions={
          <Box display="flex" gap={2}>
          <Tooltip title="Alt + C">
            <Button
              variant="outlined"
              startIcon={<CategoryIcon />}
              onClick={handleCategoryManager}
            >
              Категории
            </Button>
          </Tooltip>
          <Tooltip title="Alt + F">
            <Button
              variant="outlined"
              startIcon={<FilterAlt />}
              onClick={handleAdvancedFilters}
            >
              Фильтры
            </Button>
          </Tooltip>
          <Tooltip title="Ctrl + R">
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Обновить
            </Button>
          </Tooltip>
          {canCreateProduct && (
            <Tooltip title="Ctrl + N">
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreateProduct}
              >
                Добавить товар
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Экспорт/Импорт">
            <Button
              variant="outlined"
              startIcon={<ImportExport />}
              onClick={handleExportImport}
            >
              Экспорт/Импорт
            </Button>
          </Tooltip>
          <Tooltip title="? - Показать горячие клавиши">
            <Button
              variant="outlined"
              onClick={() => setKeyboardHelpOpen(true)}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              ?
            </Button>
          </Tooltip>
          </Box>
        }
      />

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Поиск по названию, описанию, SKU..."
              value={filters.search}
              onChange={handleSearchChange}
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

          {(stores && stores.length > 1) && (
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Магазин</InputLabel>
                <Select
                  value={filters.storeId || 'all'}
                  onChange={(e) => handleStoreChange(e.target.value)}
                  label="Магазин"
                >
                  <MenuItem value="all">Все магазины</MenuItem>
                  {(stores || []).map((store) => (
                    <MenuItem key={store.id} value={store.id}>
                      {store.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Категория</InputLabel>
              <Select
                value={filters.categoryId || 'all'}
                onChange={(e) => handleCategoryChange(e.target.value)}
                label="Категория"
              >
                <MenuItem value="all">Все категории</MenuItem>
                {(categories || []).map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Сортировка</InputLabel>
              <Select
                value={filters.sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                label="Сортировка"
              >
                <MenuItem value="createdAt">По дате</MenuItem>
                <MenuItem value="name">По названию</MenuItem>
                <MenuItem value="price">По цене</MenuItem>
                <MenuItem value="stock">По количеству</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
              fullWidth
            >
              <ToggleButton value="grid">
                <ViewModule />
              </ToggleButton>
              <ToggleButton value="list">
                <ViewList />
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>

        {/* Active Filters */}
        <Box display="flex" gap={1} mt={2} flexWrap="wrap">
          {filters.search && (
            <Chip
              label={`Поиск: ${filters.search}`}
              onDelete={() => setFilters(prev => ({ ...prev, search: '', page: 1 }))}
              size="small"
            />
          )}
          {filters.storeId && (
            <Chip
              icon={<StoreIcon />}
              label={(stores || []).find(s => s.id === filters.storeId)?.name}
              onDelete={() => handleStoreChange('all')}
              size="small"
            />
          )}
          {filters.categoryId && (
            <Chip
              icon={<CategoryIcon />}
              label={(categories || []).find(c => c.id === filters.categoryId)?.name}
              onDelete={() => handleCategoryChange('all')}
              size="small"
            />
          )}
        </Box>
      </Paper>

      {/* Product Analytics */}
      {analyticsExpanded && (
        <ProductAnalytics
          products={products}
          stores={stores}
          loading={loading}
        />
      )}

      {/* Bulk Operations */}
      <BulkOperations
        products={products}
        selectedProducts={selectedProducts}
        onSelectionChange={setSelectedProducts}
        categories={categories}
        onRefresh={loadProducts}
      />

      {/* Enhanced Sorting */}
      <EnhancedSorting
        products={products}
        stores={stores}
        categories={categories}
        onProductsFiltered={setFilteredProducts}
        sortBy={filters.sortBy || 'createdAt'}
        sortOrder={filters.sortOrder || 'desc'}
        onSortChange={(sortBy, sortOrder) => {
          setFilters(prev => ({ ...prev, sortBy: sortBy as any, sortOrder, page: 1 }))
        }}
        groupBy={groupBy}
        onGroupChange={setGroupBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Status Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {statusTabs.map((tab, index) => (
            <Tab
              key={tab.key}
              label={getTabLabel(tab, index)}
              id={`products-tab-${index}`}
              aria-controls={`products-tabpanel-${index}`}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Products List */}
      {(!products || products.length === 0) ? (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <EmptyState
            title="Товары не найдены"
            description={statusTabs[activeTab].label === 'Все' ? 'Пока нет товаров. Создайте первый товар для начала продаж.' : `Нет товаров в категории "${statusTabs[activeTab].label}"`}
            actionLabel={canCreateProduct && statusTabs[activeTab].label === 'Все' ? 'Создать первый товар' : undefined}
            onAction={canCreateProduct && statusTabs[activeTab].label === 'Все' ? handleCreateProduct : undefined}
          />
        </Paper>
      ) : (
        <Box>
          <Grid container spacing={viewMode === 'grid' ? 3 : 1}>
            {(products || []).map((product) => (
              <Grid
                item
                xs={12}
                sm={viewMode === 'grid' ? 6 : 12}
                md={viewMode === 'grid' ? 4 : 12}
                lg={viewMode === 'grid' ? 3 : 12}
                key={product.id}
              >
                <ProductCard
                  product={product}
                  onEdit={handleEditProduct}
                  onPreview={handlePreviewProduct}
                  onDuplicate={handleDuplicateProduct}
                  onRefresh={loadProducts}
                  compact={viewMode === 'list'}
                  selected={selectedProducts.includes(product.id)}
                  onSelect={(selected) => {
                    if (selected) {
                      setSelectedProducts(prev => [...prev, product.id])
                    } else {
                      setSelectedProducts(prev => prev.filter(id => id !== product.id))
                    }
                  }}
                />
              </Grid>
            ))}
          </Grid>

          {/* Load More Button */}
          {filters.page && filters.page < totalPages && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Button
                variant="outlined"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? 'Загрузка...' : 'Загрузить еще'}
              </Button>
            </Box>
          )}

          {/* Results Summary */}
          <Box display="flex" justifyContent="center" mt={2}>
            <Typography variant="body2" color="text.secondary">
              Показано {products?.length || 0} из {totalCount} товаров
            </Typography>
          </Box>
        </Box>
      )}

      {/* Floating Action Button for mobile */}
      {canCreateProduct && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={handleCreateProduct}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: { xs: 'flex', md: 'none' },
          }}
        >
          <Add />
        </Fab>
      )}

      {/* Create/Edit Product Dialog */}
      <ProductDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSuccess={handleDialogSuccess}
        product={editingProduct}
      />

      {/* Category Manager Dialog */}
      <CategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        onSuccess={handleCategoryManagerSuccess}
        currentCategories={categories}
      />

      {/* Product Preview Dialog */}
      <ProductPreviewDialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        product={previewProduct}
        onEdit={(product) => {
          setPreviewDialogOpen(false)
          handleEditProduct(product)
        }}
      />

      {/* Advanced Filters Dialog */}
      <AdvancedFilters
        open={advancedFiltersOpen}
        onClose={() => setAdvancedFiltersOpen(false)}
        onApply={handleApplyAdvancedFilters}
        onClear={handleClearAdvancedFilters}
        currentFilters={advancedFilters}
        priceRange={[0, Math.max(...(products || []).map(p => Number(p?.price || 0)), 100000)]}
        stockRange={[0, Math.max(...(products || []).map(p => p?.stock || 0), 1000)]}
        salesRange={[0, Math.max(...(products || []).map(p => p?._count?.orderItems || 0), 100)]}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        open={keyboardHelpOpen}
        onClose={() => setKeyboardHelpOpen(false)}
        shortcuts={shortcuts}
      />

      {/* Shortcut Message Snackbar */}
      {/* Export/Import Dialog */}
      <ExportImport
        open={exportImportOpen}
        onClose={() => setExportImportOpen(false)}
        onSuccess={() => {
          loadProducts()
          toast.success('Операция успешно выполнена!')
        }}
        products={products}
        stores={stores}
        categories={categories}
      />

      {/* Duplicate Product Dialog */}
      <DuplicateProduct
        open={duplicateDialogOpen}
        onClose={() => {
          setDuplicateDialogOpen(false)
          setDuplicatingProduct(null)
        }}
        onSuccess={() => {
          loadProducts()
          loadStatusCounts()
        }}
        product={duplicatingProduct}
        stores={stores}
        categories={categories}
      />

      <Snackbar
        open={!!shortcutMessage}
        autoHideDuration={2000}
        onClose={() => setShortcutMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <MuiAlert severity="info" variant="filled" sx={{ width: '100%' }}>
          {shortcutMessage}
        </MuiAlert>
      </Snackbar>
    </Box>
  )
}

export default ProductsPage
