import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material'
import {
  Store,
  Restaurant,
  LocalMall,
  PhoneAndroid,
  MenuBook,
  Palette,
  SportsSoccer,
  LibraryBooks,
  Pets,
  Checkroom,
  Computer,
  LocalFlorist,
  Check,
} from '@mui/icons-material'
import { toast } from 'react-toastify'
import { storeService, CreateStoreRequest } from '../../services/storeService'

interface StoreTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: React.ReactNode
  currency: string
  features: string[]
  config: {
    contactInfo: any
    settings: any
    description: string
  }
}

interface StoreTemplatesProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const templates: StoreTemplate[] = [
  {
    id: 'electronics',
    name: 'Магазин электроники',
    description: 'Готовый шаблон для продажи электроники и гаджетов',
    category: 'Электроника',
    icon: <Computer />,
    currency: 'USD',
    features: [
      'Гарантийное обслуживание',
      'Техническая поддержка',
      'Быстрая доставка',
      'Сравнение товаров'
    ],
    config: {
      contactInfo: {
        phone: '+1-234-567-8900',
        email: 'support@electronics-store.com',
        address: '123 Tech Street'
      },
      settings: {
        paymentInstructions: 'Принимаем оплату картой, PayPal, криптовалюты. Гарантия 12 месяцев на все товары.',
        termsOfService: 'Условия гарантии, возврата и технической поддержки.'
      },
      description: 'Профессиональный магазин электроники с широким ассортиментом гаджетов и аксессуаров.'
    }
  },
  {
    id: 'fashion',
    name: 'Магазин одежды',
    description: 'Стильный шаблон для продажи одежды и аксессуаров',
    category: 'Мода',
    icon: <Checkroom />,
    currency: 'EUR',
    features: [
      'Таблица размеров',
      'Виртуальная примерка',
      'Сезонные коллекции',
      'Программа лояльности'
    ],
    config: {
      contactInfo: {
        phone: '+33-1-23-45-67-89',
        email: 'info@fashion-boutique.com',
        address: '456 Fashion Avenue'
      },
      settings: {
        paymentInstructions: 'Оплата картой, PayPal. Бесплатная доставка от €50. Возврат в течение 30 дней.',
        termsOfService: 'Правила возврата, обмена и ухода за изделиями.'
      },
      description: 'Современный бутик с трендовой одеждой и аксессуарами для стильных людей.'
    }
  },
  {
    id: 'food',
    name: 'Продуктовый магазин',
    description: 'Шаблон для продажи продуктов питания и напитков',
    category: 'Продукты',
    icon: <Restaurant />,
    currency: 'RUB',
    features: [
      'Свежие продукты',
      'Быстрая доставка',
      'Холодильная цепь',
      'Органические товары'
    ],
    config: {
      contactInfo: {
        phone: '+7-495-123-45-67',
        email: 'orders@fresh-market.ru',
        address: 'ул. Продуктовая, 789'
      },
      settings: {
        paymentInstructions: 'Оплата наличными при доставке, картой онлайн. Доставка свежих продуктов каждый день.',
        termsOfService: 'Сроки годности, условия хранения, политика возврата скоропортящихся товаров.'
      },
      description: 'Магазин свежих и качественных продуктов с быстрой доставкой на дом.'
    }
  },
  {
    id: 'books',
    name: 'Книжный магазин',
    description: 'Классический шаблон для продажи книг и учебных материалов',
    category: 'Книги',
    icon: <LibraryBooks />,
    currency: 'USD',
    features: [
      'Электронные книги',
      'Предзаказ новинок',
      'Рекомендации',
      'Клубы читателей'
    ],
    config: {
      contactInfo: {
        phone: '+1-555-BOOKS-01',
        email: 'info@bookstore.com',
        address: '321 Library Lane'
      },
      settings: {
        paymentInstructions: 'Принимаем все виды оплаты. Скидки на учебники для студентов.',
        termsOfService: 'Правила предзаказа, возврата и участия в читательских программах.'
      },
      description: 'Уютный книжный магазин с большим выбором литературы на любой вкус.'
    }
  },
  {
    id: 'pets',
    name: 'Зоомагазин',
    description: 'Специализированный шаблон для товаров для животных',
    category: 'Животные',
    icon: <Pets />,
    currency: 'USD',
    features: [
      'Ветеринарные препараты',
      'Консультации специалистов',
      'Подписка на корма',
      'Груминг услуги'
    ],
    config: {
      contactInfo: {
        phone: '+1-555-PETS-LOVE',
        email: 'care@petshop.com',
        address: '654 Animal Street'
      },
      settings: {
        paymentInstructions: 'Оплата любыми способами. Подписка на регулярную доставку кормов со скидкой.',
        termsOfService: 'Рекомендации по уходу, правила возврата кормов и аксессуаров.'
      },
      description: 'Все необходимое для здоровья и счастья ваших питомцев.'
    }
  },
  {
    id: 'handmade',
    name: 'Рукоделие и хобби',
    description: 'Творческий шаблон для handmade товаров',
    category: 'Рукоделие',
    icon: <Palette />,
    currency: 'EUR',
    features: [
      'Мастер-классы',
      'Индивидуальные заказы',
      'Материалы для творчества',
      'Сообщество мастеров'
    ],
    config: {
      contactInfo: {
        phone: '+49-30-123-456-78',
        email: 'hello@craftstore.de',
        address: 'Kreative Straße 12'
      },
      settings: {
        paymentInstructions: 'Поддержка независимых мастеров. Оплата через PayPal, SEPA.',
        termsOfService: 'Условия индивидуальных заказов, сроки изготовления, авторские права.'
      },
      description: 'Уникальные handmade товары и материалы для творчества от талантливых мастеров.'
    }
  }
]

const StoreTemplates: React.FC<StoreTemplatesProps> = ({ open, onClose, onSuccess }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<StoreTemplate | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSelectTemplate = (template: StoreTemplate) => {
    setSelectedTemplate(template)
  }

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return

    setLoading(true)
    try {
      const slug = `${selectedTemplate.id}-${Date.now()}`
      
      const storeData: CreateStoreRequest = {
        name: selectedTemplate.name,
        slug: slug,
        description: selectedTemplate.config.description,
        currency: selectedTemplate.currency,
        contactInfo: selectedTemplate.config.contactInfo,
        settings: selectedTemplate.config.settings,
      }

      await storeService.createStore(storeData)
      toast.success(`Магазин создан по шаблону "${selectedTemplate.name}"!`)
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при создании магазина')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
      'Электроника': 'info',
      'Мода': 'secondary',
      'Продукты': 'success',
      'Книги': 'warning',
      'Животные': 'primary',
      'Рукоделие': 'error',
    }
    return colors[category] || 'primary'
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Store />
          Шаблоны магазинов
        </Box>
        <Typography variant="body2" color="text.secondary">
          Выберите готовый шаблон для быстрого создания магазина
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={3}>
          {templates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  border: selectedTemplate?.id === template.id ? '2px solid' : '1px solid',
                  borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.2s'
                }}
                onClick={() => handleSelectTemplate(template)}
              >
                <CardContent>
                  <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
                    <Avatar
                      sx={{
                        bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                        color: theme => theme.palette.primary.contrastText,
                        border: theme => `1px solid ${theme.palette.primary.main}`,
                      }}
                    >
                      {template.icon}
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom>
                        {template.name}
                      </Typography>
                      <Chip 
                        label={template.category}
                        color={getCategoryColor(template.category)}
                        size="small"
                      />
                    </Box>
                    {selectedTemplate?.id === template.id && (
                      <Check color="primary" />
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {template.description}
                  </Typography>

                  <Chip 
                    label={template.currency}
                    variant="outlined"
                    size="small"
                    sx={{ mb: 2 }}
                  />

                  <Typography variant="subtitle2" gutterBottom>
                    Включает:
                  </Typography>
                  <List dense>
                    {template.features.slice(0, 3).map((feature, index) => (
                      <ListItem key={index} disablePadding>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <Check fontSize="small" color="success" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={feature} 
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                    {template.features.length > 3 && (
                      <ListItem disablePadding>
                        <ListItemText 
                          primary={`И еще ${template.features.length - 3} функций...`}
                          primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {selectedTemplate && (
          <Card sx={{ mt: 3, bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.50', color: theme => theme.palette.mode === 'dark' ? theme.palette.primary.contrastText : 'inherit' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Предпросмотр: {selectedTemplate.name}
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Основная информация:
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Категория:</strong> {selectedTemplate.category}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Валюта:</strong> {selectedTemplate.currency}
                  </Typography>
                  <Typography variant="body2">
                    {selectedTemplate.config.description}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Все функции шаблона:
                  </Typography>
                  <List dense>
                    {selectedTemplate.features.map((feature, index) => (
                      <ListItem key={index} disablePadding>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <Check fontSize="small" color="success" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={feature}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Отмена
        </Button>
        <Button
          onClick={handleCreateFromTemplate}
          variant="contained"
          disabled={!selectedTemplate || loading}
        >
          {loading ? 'Создание...' : 'Создать магазин'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default StoreTemplates
