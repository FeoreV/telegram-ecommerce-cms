import React, { useState } from 'react'
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Badge,
  Divider,
  Card,
  CardHeader,
  CardContent,
  Avatar,
} from '@mui/material'
import {
  ViewList,
  ViewModule,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Sort,
  Store,
  Category,
  LocalOffer,
  TrendingUp,
  TrendingDown,
  Star,
} from '@mui/icons-material'
import { Product, Store as StoreType, Category as CategoryType } from '../../types'

interface EnhancedSortingProps {
  products: Product[]
  stores: StoreType[]
  categories: CategoryType[]
  onProductsFiltered: (products: Product[]) => void
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  groupBy: 'none' | 'store' | 'category' | 'status'
  onGroupChange: (groupBy: 'none' | 'store' | 'category' | 'status') => void
  viewMode: 'list' | 'grid'
  onViewModeChange: (mode: 'list' | 'grid') => void
}

interface ProductGroup {
  key: string
  title: string
  products: Product[]
  icon: React.ReactNode
  color: string
  stats: {
    total: number
    active: number
    totalValue: number
    avgPrice: number
  }
}

const EnhancedSorting: React.FC<EnhancedSortingProps> = ({
  products,
  stores,
  categories,
  onProductsFiltered,
  sortBy,
  sortOrder,
  onSortChange,
  groupBy,
  onGroupChange,
  viewMode,
  onViewModeChange,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroupCollapse = (groupKey: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupKey)) {
      newCollapsed.delete(groupKey)
    } else {
      newCollapsed.add(groupKey)
    }
    setCollapsedGroups(newCollapsed)
  }

  const groupProducts = (): ProductGroup[] => {
    if (groupBy === 'none') {
      return [{
        key: 'all',
        title: 'Все товары',
        products: sortProducts(products),
        icon: <LocalOffer />,
        color: 'primary',
        stats: calculateStats(products),
      }]
    }

    const groups: { [key: string]: ProductGroup } = {}

    products.forEach(product => {
      let groupKey: string
      let groupTitle: string
      let groupIcon: React.ReactNode
      let groupColor: string

      switch (groupBy) {
        case 'store':
          groupKey = product.store.id
          groupTitle = product.store.name
          groupIcon = <Store />
          groupColor = 'primary'
          break
        
        case 'category':
          groupKey = product.category?.id || 'no-category'
          groupTitle = product.category?.name || 'Без категории'
          groupIcon = <Category />
          groupColor = 'secondary'
          break
        
        case 'status':
          groupKey = getStatusKey(product)
          groupTitle = getStatusTitle(product)
          groupIcon = getStatusIcon(product)
          groupColor = getStatusColor(product)
          break
        
        default:
          groupKey = 'all'
          groupTitle = 'Все товары'
          groupIcon = <LocalOffer />
          groupColor = 'primary'
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          title: groupTitle,
          products: [],
          icon: groupIcon,
          color: groupColor,
          stats: { total: 0, active: 0, totalValue: 0, avgPrice: 0 },
        }
      }

      groups[groupKey].products.push(product)
    })

    // Вычисляем статистику для каждой группы и сортируем товары
    Object.values(groups).forEach(group => {
      group.stats = calculateStats(group.products)
      group.products = sortProducts(group.products)
    })

    // Сортируем группы по количеству товаров (по убыванию)
    return Object.values(groups).sort((a, b) => b.products.length - a.products.length)
  }

  const sortProducts = (productsToSort: Product[]): Product[] => {
    const sorted = [...productsToSort].sort((a, b) => {
      let compareValue = 0

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name)
          break
        case 'price':
          compareValue = Number(a.price) - Number(b.price)
          break
        case 'stock':
          compareValue = a.stock - b.stock
          break
        case 'sales':
          compareValue = a._count.orderItems - b._count.orderItems
          break
        case 'createdAt':
          compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'updatedAt':
          compareValue = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        default:
          compareValue = 0
      }

      return sortOrder === 'desc' ? -compareValue : compareValue
    })

    return sorted
  }

  const calculateStats = (productsForStats: Product[]) => {
    const total = productsForStats.length
    const active = productsForStats.filter(p => p.isActive).length
    const totalValue = productsForStats.reduce((sum, p) => sum + (Number(p.price) * p.stock), 0)
    const avgPrice = total > 0 ? productsForStats.reduce((sum, p) => sum + Number(p.price), 0) / total : 0

    return { total, active, totalValue, avgPrice }
  }

  const getStatusKey = (product: Product): string => {
    if (!product.isActive) return 'inactive'
    if (product.stock === 0) return 'out-of-stock'
    if (product.stock <= 10) return 'low-stock'
    return 'in-stock'
  }

  const getStatusTitle = (product: Product): string => {
    const statusKey = getStatusKey(product)
    const statusTitles = {
      'inactive': 'Неактивные товары',
      'out-of-stock': 'Нет в наличии',
      'low-stock': 'Мало товара',
      'in-stock': 'В наличии',
    }
    return statusTitles[statusKey] || 'Неизвестный статус'
  }

  const getStatusIcon = (product: Product): React.ReactNode => {
    const statusKey = getStatusKey(product)
    const statusIcons = {
      'inactive': <LocalOffer />,
      'out-of-stock': <TrendingDown />,
      'low-stock': <TrendingUp />,
      'in-stock': <Star />,
    }
    return statusIcons[statusKey] || <LocalOffer />
  }

  const getStatusColor = (product: Product): string => {
    const statusKey = getStatusKey(product)
    const statusColors = {
      'inactive': 'default',
      'out-of-stock': 'error',
      'low-stock': 'warning', 
      'in-stock': 'success',
    }
    return statusColors[statusKey] || 'primary'
  }

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ₽`
  }

  const groups = groupProducts()

  React.useEffect(() => {
    const allProducts = groups.flatMap(group => group.products)
    onProductsFiltered(allProducts)
  }, [groups, onProductsFiltered])

  return (
    <Box>
      {/* Панель управления сортировкой и группировкой */}
      <Box 
        display="flex" 
        flexWrap="wrap" 
        alignItems="center" 
        gap={2} 
        mb={3} 
        p={2} 
        sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}
      >
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Сортировка</InputLabel>
          <Select
            value={`${sortBy}_${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('_')
              onSortChange(newSortBy, newSortOrder as 'asc' | 'desc')
            }}
            label="Сортировка"
          >
            <MenuItem value="name_asc">Название ↑</MenuItem>
            <MenuItem value="name_desc">Название ↓</MenuItem>
            <MenuItem value="price_asc">Цена ↑</MenuItem>
            <MenuItem value="price_desc">Цена ↓</MenuItem>
            <MenuItem value="stock_asc">Остаток ↑</MenuItem>
            <MenuItem value="stock_desc">Остаток ↓</MenuItem>
            <MenuItem value="sales_asc">Продажи ↑</MenuItem>
            <MenuItem value="sales_desc">Продажи ↓</MenuItem>
            <MenuItem value="createdAt_desc">Новые</MenuItem>
            <MenuItem value="createdAt_asc">Старые</MenuItem>
            <MenuItem value="updatedAt_desc">Обновленные</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Группировка</InputLabel>
          <Select
            value={groupBy}
            onChange={(e) => onGroupChange(e.target.value as any)}
            label="Группировка"
          >
            <MenuItem value="none">Без группировки</MenuItem>
            <MenuItem value="store">По магазинам</MenuItem>
            <MenuItem value="category">По категориям</MenuItem>
            <MenuItem value="status">По статусу</MenuItem>
          </Select>
        </FormControl>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && onViewModeChange(newMode)}
          size="small"
        >
          <ToggleButton value="grid">
            <ViewModule />
          </ToggleButton>
          <ToggleButton value="list">
            <ViewList />
          </ToggleButton>
        </ToggleButtonGroup>

        <Chip
          icon={<Sort />}
          label={`${products.length} товаров`}
          color="primary"
          variant="outlined"
        />
      </Box>

      {/* Группы товаров */}
      <Box>
        {groups.map((group) => (
          <Card key={group.key} sx={{ mb: 2 }}>
            <CardHeader
              avatar={
                <Avatar sx={{ bgcolor: `${group.color}.main` }}>
                  {group.icon}
                </Avatar>
              }
              action={
                groupBy !== 'none' ? (
                  <IconButton onClick={() => toggleGroupCollapse(group.key)}>
                    {collapsedGroups.has(group.key) ? <KeyboardArrowDown /> : <KeyboardArrowUp />}
                  </IconButton>
                ) : null
              }
              title={
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h6">
                    {group.title}
                  </Typography>
                  <Badge badgeContent={group.stats.total} color="primary" />
                </Box>
              }
              subheader={
                <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                  <Chip 
                    label={`${group.stats.active} активных`} 
                    size="small" 
                    color="success"
                    variant="outlined"
                  />
                  <Chip 
                    label={`Ср. цена: ${formatCurrency(group.stats.avgPrice)}`} 
                    size="small" 
                    color="info"
                    variant="outlined"
                  />
                  <Chip 
                    label={`На складе: ${formatCurrency(group.stats.totalValue)}`} 
                    size="small" 
                    color="warning"
                    variant="outlined"
                  />
                </Box>
              }
              titleTypographyProps={{ component: 'div' }}
              subheaderTypographyProps={{ component: 'div' }}
              sx={{ cursor: groupBy !== 'none' ? 'pointer' : 'default' }}
              onClick={groupBy !== 'none' ? () => toggleGroupCollapse(group.key) : undefined}
            />
            
            {groupBy === 'none' || !collapsedGroups.has(group.key) ? (
              <CardContent sx={{ pt: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  Товары отображаются в основной области страницы с применённой сортировкой и группировкой
                </Typography>
              </CardContent>
            ) : null}
          </Card>
        ))}
      </Box>

      {/* Дополнительная информация */}
      {groupBy !== 'none' && groups.length > 1 && (
        <Box mt={2}>
          <Typography variant="body2" color="text.secondary">
            💡 Совет: Нажмите на заголовок группы для сворачивания/разворачивания
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default EnhancedSorting
