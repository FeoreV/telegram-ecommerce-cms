import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Divider,
} from '@mui/material'
import {
  SmartToy,
  Message,
  ShoppingCart,
  Notifications,
  Palette,
  AutoAwesome,
} from '@mui/icons-material'

interface BotPreviewCardProps {
  botInfo?: {
    username?: string
    firstName?: string
  }
  isVisible?: boolean
}

const BotPreviewCard: React.FC<BotPreviewCardProps> = ({ 
  botInfo, 
  isVisible = false 
}) => {
  if (!isVisible || !botInfo) return null

  const features = [
    {
      icon: <Message />,
      title: 'Автоматические ответы',
      description: 'Приветствие клиентов и информация о товарах'
    },
    {
      icon: <ShoppingCart />,
      title: 'Каталог товаров',
      description: 'Удобный просмотр и выбор товаров'
    },
    {
      icon: <Notifications />,
      title: 'Уведомления о заказах',
      description: 'Моментальные оповещения о новых заказах'
    },
    {
      icon: <AutoAwesome />,
      title: 'Умное управление',
      description: 'Автоматическая обработка корзины и оплат'
    }
  ]

  return (
    <Card
      sx={{
        mt: 2,
        bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
        border: theme => `1px solid ${theme.palette.primary.main}`,
        color: theme => theme.palette.primary.contrastText,
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
      <Avatar
        sx={{
          bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
          color: theme => theme.palette.primary.contrastText,
          border: theme => `1px solid ${theme.palette.primary.main}`,
        }}
      >
            <SmartToy />
          </Avatar>
          <Box>
            <Typography variant="h6" color="primary.contrastText">
              Предпросмотр бота @{botInfo.username}
            </Typography>
            <Typography variant="body2" color="primary.contrastText" sx={{ opacity: 0.8 }}>
              {botInfo.firstName} • Готов к работе
            </Typography>
          </Box>
          <Chip 
            label="Активный" 
            color="success" 
            size="small" 
            sx={{ ml: 'auto' }}
          />
        </Box>
        
        <Divider sx={{ my: 2, borderColor: 'primary.main' }} />
        
        <Typography variant="subtitle2" color="primary.contrastText" gutterBottom>
          Возможности вашего бота:
        </Typography>
        
        <List dense>
          {features.map((feature, index) => (
            <ListItem key={index} sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ color: 'primary.contrastText', minWidth: 36 }}>
                {feature.icon}
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Typography variant="body2" color="primary.contrastText" fontWeight="bold">
                    {feature.title}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="primary.contrastText" sx={{ opacity: 0.8 }}>
                    {feature.description}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
        
        <Box mt={2}>
          <Typography variant="caption" color="primary.contrastText" sx={{ opacity: 0.7 }}>
            💡 Бот будет автоматически настроен после создания магазина
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

export default BotPreviewCard
