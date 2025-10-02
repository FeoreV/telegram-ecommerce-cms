import React, { useState } from 'react'
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
  const [favorites, setFavorites] = useState<string[]>(['1', '3'])

  // Mock data - in real app would come from API
  const performersData = {
    stores: [
      {
        id: '1',
        name: 'Tech Store',
        description: 'Электроника и гаджеты',
        value: 150000,
        change: 15.2,
        extra: 'USD',
        rank: 1,
        maxValue: 200000,
        avatar: undefined,
      },
      {
        id: '2',
        name: 'Fashion Boutique',
        description: 'Модная одежда',
        value: 120000,
        change: -5.3,
        extra: 'EUR',
        rank: 2,
        maxValue: 200000,
        avatar: undefined,
      },
      {
        id: '3',
        name: 'Book Haven',
        description: 'Книги и учебники',
        value: 85000,
        change: 8.7,
        extra: 'RUB',
        rank: 3,
        maxValue: 200000,
        avatar: undefined,
      },
      {
        id: '4',
        name: 'Pet Supplies',
        description: 'Товары для животных',
        value: 72000,
        change: 22.1,
        extra: 'USD',
        rank: 4,
        maxValue: 200000,
        avatar: undefined,
      },
    ],
    products: [
      {
        id: '1',
        name: 'iPhone 15 Pro',
        description: 'Смартфон Apple',
        value: 45,
        change: 12.5,
        extra: '12 продаж',
        rank: 1,
        maxValue: 50,
        avatar: undefined,
      },
      {
        id: '2',
        name: 'MacBook Air M2',
        description: 'Ноутбук Apple',
        value: 32,
        change: 8.3,
        extra: '8 продаж',
        rank: 2,
        maxValue: 50,
        avatar: undefined,
      },
      {
        id: '3',
        name: 'AirPods Pro',
        description: 'Беспроводные наушники',
        value: 28,
        change: -3.2,
        extra: '18 продаж',
        rank: 3,
        maxValue: 50,
        avatar: undefined,
      },
    ],
    users: [
      {
        id: '1',
        name: 'Алексей Иванов',
        description: 'Менеджер продаж',
        value: 95000,
        change: 18.5,
        extra: '45 заказов',
        rank: 1,
        maxValue: 100000,
        avatar: undefined,
      },
      {
        id: '2',
        name: 'Мария Петрова',
        description: 'Администратор',
        value: 78000,
        change: 7.2,
        extra: '32 заказа',
        rank: 2,
        maxValue: 100000,
        avatar: undefined,
      },
    ]
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
      onRefresh={onRefresh}
      onSettings={onSettings}
      showRefresh
      showSettings
      showFullscreen
      size="medium"
      headerAction={headerAction}
    >
      <Box>
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

        {currentData.length === 0 && (
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
