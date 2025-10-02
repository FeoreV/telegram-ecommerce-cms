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
} from '@mui/material'
import {
  Store,
  ShoppingCart,
  Restaurant,
  Computer,
  LocalFlorist,
} from '@mui/icons-material'

interface StoreTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  category: string
  features: string[]
}

const templates: StoreTemplate[] = [
  {
    id: 'general',
    name: 'Универсальный магазин',
    description: 'Подходит для продажи различных товаров',
    icon: <Store />,
    category: 'Общее',
    features: ['Каталог товаров', 'Корзина', 'Оплата', 'Доставка'],
  },
  {
    id: 'electronics',
    name: 'Электроника',
    description: 'Специализированный магазин электроники',
    icon: <Computer />,
    category: 'Техника',
    features: ['Характеристики', 'Сравнение', 'Гарантия', 'Сервис'],
  },
  {
    id: 'food',
    name: 'Ресторан/Кафе',
    description: 'Доставка еды и напитков',
    icon: <Restaurant />,
    category: 'Еда',
    features: ['Меню', 'Быстрая доставка', 'Акции', 'Отзывы'],
  },
  {
    id: 'flowers',
    name: 'Цветы и подарки',
    description: 'Флористический магазин',
    icon: <LocalFlorist />,
    category: 'Подарки',
    features: ['Букеты', 'Композиции', 'Доставка', 'Открытки'],
  },
]

interface StoreTemplatesDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const StoreTemplatesDialog: React.FC<StoreTemplatesDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return

    setLoading(true)
    try {
      // Here you would normally create store from template
      // For now just close the dialog
      setTimeout(() => {
        setLoading(false)
        onSuccess()
      }, 1000)
    } catch (error) {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Выберите шаблон магазина</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          {templates.map((template) => (
            <Grid item xs={12} md={6} key={template.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: selectedTemplate === template.id ? 2 : 0,
                  borderColor: 'primary.main',
                  '&:hover': {
                    boxShadow: 4,
                  },
                }}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    {template.icon}
                    <Box>
                      <Typography variant="h6">{template.name}</Typography>
                      <Chip label={template.category} size="small" />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {template.description}
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {template.features.map((feature) => (
                      <Chip
                        key={feature}
                        label={feature}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          variant="contained"
          onClick={handleCreateFromTemplate}
          disabled={!selectedTemplate || loading}
        >
          {loading ? 'Создание...' : 'Создать из шаблона'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default StoreTemplatesDialog
