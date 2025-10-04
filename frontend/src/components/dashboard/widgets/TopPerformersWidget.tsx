import React, { useState, useEffect } from 'react'
import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Chip,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import {
  Store,
  Inventory,
  Person,
  TrendingUp,
  TrendingDown,
  EmojiEvents,
  AttachMoney,
  ShoppingCart,
  Visibility,
  StarBorder,
  Star,
} from '@mui/icons-material'
import DashboardWidget from '../DashboardWidget'
import { dashboardService } from '../../../services/dashboardService'
import { storeService } from '../../../services/storeService'

interface PerformerData {
  id: string
  name: string
  description: string
  value: number
  change: number
  avatar?: string
  extra?: string
  rank: number
  maxValue: number
}

interface TopPerformersWidgetProps {
  onRefresh?: () => void
  onSettings?: () => void
}

type PerformanceType = 'stores' | 'products' | 'users'

const TopPerformersWidget: React.FC<TopPerformersWidgetProps> = ({
  onRefresh,
  onSettings,
}) => {
  const [performanceType, setPerformanceType] = useState<PerformanceType>('stores')
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [performersData, setPerformersData] = useState<{
    stores: PerformerData[]
    products: PerformerData[]
    users: PerformerData[]
  }>({
    stores: [],
    products: [],
    users: []
  })

  useEffect(() => {
    loadPerformers()
  }, [performanceType])

  const loadPerformers = async () => {
    setLoading(true)
    try {
      if (performanceType === 'stores') {
        const topStores = await dashboardService.getTopStores({ limit: 10 })
        const maxRevenue = Math.max(...topStores.map((s: any) => s.revenue || 0), 1)
        setPerformersData(prev => ({
          ...prev,
          stores: topStores.map((store: any, index: number) => ({
            id: store.id,
            name: store.name,
            description: store.description || '',
            value: store.revenue || 0,
            change: store.change || 0,
            extra: store.currency || 'RUB',
            rank: index + 1,
            maxValue: maxRevenue,
            avatar: store.logo
          }))
        }))
      } else if (performanceType === 'products') {
        const topProducts = await dashboardService.getTopProducts({ limit: 10 })
        const maxRevenue = Math.max(...topProducts.map((p: any) => p.revenue || 0), 1)
        setPerformersData(prev => ({
          ...prev,
          products: topProducts.map((product: any, index: number) => ({
            id: product.id,
            name: product.name,
            description: product.category || '',
            value: product.revenue || 0,
            change: product.change || 0,
            extra: `${product.quantity || 0} продаж`,
            rank: index + 1,
            maxValue: maxRevenue,
            avatar: product.image
          }))
        }))
      }
    } catch (error) {
      console.error('Error loading performers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    loadPerformers()
    onRefresh?.()
  }

  const currentData = performersData[performanceType]

  const getIcon = (type: PerformanceType) => {
    switch (type) {
      case 'stores': return <Store />
      case 'products': return <Inventory />
      case 'users': return <Person />
    }
  }

  const getValueLabel = (type: PerformanceType) => {
    switch (type) {
      case 'stores': return 'Выручка'
      case 'products': return 'Рейтинг'
      case 'users': return 'Продажи'
    }
  }

  const formatValue = (value: number, type: PerformanceType) => {
    switch (type) {
      case 'stores':
      case 'users':
        return `₽${value.toLocaleString()}`
      case 'products':
        return `${value}/5.0`
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <EmojiEvents sx={{ color: '#ffd700' }} />
      case 2: return <EmojiEvents sx={{ color: '#c0c0c0' }} />
      case 3: return <EmojiEvents sx={{ color: '#cd7f32' }} />
      default: return <Typography variant="body2" fontWeight="bold">#{rank}</Typography>
    }
  }

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) 
        ? prev.filter(fav => fav !== id)
        : [...prev, id]
    )
  }

  const headerAction = (
    <ToggleButtonGroup
      size="small"
      value={performanceType}
      exclusive
      onChange={(_, newType) => newType && setPerformanceType(newType)}
    >
      <ToggleButton value="stores" title="Магазины">
        <Store fontSize="small" />
      </ToggleButton>
      <ToggleButton value="products" title="Товары">
        <Inventory fontSize="small" />
      </ToggleButton>
      <ToggleButton value="users" title="Пользователи">
        <Person fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
  )

  return (
    <DashboardWidget
      id="top-performers"
      title={`Топ ${performanceType === 'stores' ? 'магазины' : performanceType === 'products' ? 'товары' : 'пользователи'}`}
      subtitle={`${getValueLabel(performanceType)} за месяц`}
      icon={getIcon(performanceType)}
      onRefresh={handleRefresh}
      onSettings={onSettings}
      showRefresh
      showSettings
      showFullscreen
      size="medium"
      headerAction={headerAction}
    >
      <Box>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={200}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ maxHeight: 320, overflow: 'auto' }}>
            {currentData.map((performer, index) => (
            <React.Fragment key={performer.id}>
              <ListItem
                sx={{
                  px: 0,
                  py: 1.5,
                  bgcolor: favorites.includes(performer.id) ? 'action.hover' : 'transparent',
                  borderRadius: 1,
                  mb: 0.5
                }}
              >
                <ListItemAvatar>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getRankIcon(performer.rank)}
                    <Avatar sx={{ width: 36, height: 36 }}>
                      {performer.avatar ? (
                        <img 
                          src={performer.avatar} 
                          alt={performer.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        getIcon(performanceType)
                      )}
                    </Avatar>
                  </Box>
                </ListItemAvatar>

                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight="medium" noWrap>
                        {performer.name}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          size="small"
                          label={formatValue(performer.value, performanceType)}
                          color="primary"
                          variant="outlined"
                        />
                        <IconButton 
                          size="small"
                          onClick={() => toggleFavorite(performer.id)}
                        >
                          {favorites.includes(performer.id) ? (
                            <Star fontSize="small" color="warning" />
                          ) : (
                            <StarBorder fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </Box>
                  }
                  secondary={
                    <Box mt={0.5}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        {performer.description} • {performer.extra}
                      </Typography>
                      
                      <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                        <LinearProgress
                          variant="determinate"
                          value={(performer.value / performer.maxValue) * 100}
                          sx={{ flex: 1, height: 6, borderRadius: 3 }}
                        />
                        <Box display="flex" alignItems="center" gap={0.5}>
                          {performer.change >= 0 ? (
                            <TrendingUp color="success" fontSize="small" />
                          ) : (
                            <TrendingDown color="error" fontSize="small" />
                          )}
                          <Typography
                            variant="caption"
                            color={performer.change >= 0 ? 'success.main' : 'error.main'}
                            fontWeight="medium"
                          >
                            {performer.change >= 0 ? '+' : ''}{performer.change}%
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
              
              {index < currentData.length - 1 && <Divider />}
            </React.Fragment>
            ))}
          </List>
        )}

        {!loading && currentData.length === 0 && (
          <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="center" 
            height={200}
            color="text.secondary"
          >
            <Typography variant="body2">
              Нет данных для отображения
            </Typography>
          </Box>
        )}

        {/* View All Button */}
        <Box mt={2}>
          <Divider sx={{ mb: 2 }} />
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Показано топ {currentData.length}
            </Typography>
            <Tooltip title="Посмотреть подробный рейтинг">
              <IconButton size="small">
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </DashboardWidget>
  )
}

export default TopPerformersWidget
