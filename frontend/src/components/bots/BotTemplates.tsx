import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Paper,
} from '@mui/material';
import {
  ShoppingCart as EcommerceIcon,
  Restaurant as RestaurantIcon,
  Computer as DigitalIcon,
  LocalFlorist as BeautyIcon,
  Build as ServiceIcon,
  School as EducationIcon,
  FitnessCenter as FitnessIcon,
  Pets as PetIcon,
  CheckCircle as CheckIcon,
  Palette as DesignIcon,
  ChatBubble as ChatIcon,
  Notifications as NotificationIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';

interface BotTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  preview: {
    welcomeMessage: string;
    catalogStyle: string;
    theme: string;
    autoResponses: number;
    notifications: number;
  };
  settings: any;
}

const TEMPLATES: BotTemplate[] = [
  {
    id: 'ecommerce_basic',
    name: 'Базовый интернет-магазин',
    description: 'Простой бот для продажи товаров с каталогом и оформлением заказов',
    category: 'E-commerce',
    icon: <EcommerceIcon />,
    color: '#1976d2',
    features: [
      'Каталог товаров в виде сетки',
      'Быстрое оформление заказов',
      'Показ цен и остатков',
      'Поиск товаров',
      'Базовые автоответы',
      'Уведомления о заказах'
    ],
    preview: {
      welcomeMessage: 'Добро пожаловать в наш магазин! 🛍️\nВыберите категорию товаров из меню ниже.',
      catalogStyle: 'Сетка',
      theme: 'Светлая',
      autoResponses: 2,
      notifications: 4
    },
    settings: {
      welcomeMessage: 'Добро пожаловать в наш магазин! 🛍️\nВыберите категорию товаров из меню ниже.',
      language: 'ru',
      currency: 'USD',
      timezone: 'UTC',
      theme: 'light',
      primaryColor: '#1976d2',
      accentColor: '#ff4081',
      catalogStyle: 'grid',
      showPrices: true,
      showStock: true,
      enableSearch: true,
      categoriesPerPage: 6,
      productsPerPage: 8,
      autoResponses: {
        enabled: true,
        responses: [
          { id: '1', trigger: 'помощь', response: 'Чем могу помочь? Используйте меню для навигации по каталогу.', enabled: true },
          { id: '2', trigger: 'контакты', response: 'Свяжитесь с нами в рабочее время для получения помощи.', enabled: true }
        ]
      },
      notifications: {
        newOrder: true,
        lowStock: true,
        paymentConfirmation: true,
        orderStatusUpdate: true,
        customNotifications: []
      },
      paymentMethods: ['manual_verification'],
      paymentInstructions: 'Оплатите заказ и прикрепите скриншот чека.',
      enableAnalytics: true,
      enableReferralSystem: false,
      enableReviews: true,
      customCommands: []
    }
  },
  {
    id: 'restaurant',
    name: 'Ресторан / Доставка еды',
    description: 'Бот для ресторана с меню, заказами, доставкой и рабочими часами',
    category: 'Food & Beverage',
    icon: <RestaurantIcon />,
    color: '#ff5722',
    features: [
      'Меню в виде списка',
      'Рабочие часы',
      'Информация о доставке',
      'Уведомления о готовности',
      'Оплата при получении',
      'Система отзывов',
      'Реферальная программа'
    ],
    preview: {
      welcomeMessage: 'Добро пожаловать! 🍕\nПосмотрите наше меню и сделайте заказ.',
      catalogStyle: 'Список',
      theme: 'Светлая',
      autoResponses: 3,
      notifications: 5
    },
    settings: {
      welcomeMessage: 'Добро пожаловать! 🍕\nПосмотрите наше меню и сделайте заказ.',
      language: 'ru',
      currency: 'USD',
      timezone: 'UTC',
      theme: 'light',
      primaryColor: '#ff5722',
      accentColor: '#4caf50',
      catalogStyle: 'list',
      showPrices: true,
      showStock: false,
      enableSearch: true,
      categoriesPerPage: 4,
      productsPerPage: 6,
      autoResponses: {
        enabled: true,
        workingHours: { start: '09:00', end: '23:00', timezone: 'UTC' },
        responses: [
          { id: '1', trigger: 'время работы', response: 'Мы работаем с 9:00 до 23:00 ежедневно.', enabled: true },
          { id: '2', trigger: 'доставка', response: 'Доставка занимает 30-60 минут в зависимости от загруженности.', enabled: true },
          { id: '3', trigger: 'меню', response: 'Посмотрите наше меню через кнопки ниже. У нас есть пицца, суши, бургеры и многое другое!', enabled: true }
        ]
      },
      notifications: {
        newOrder: true,
        lowStock: false,
        paymentConfirmation: true,
        orderStatusUpdate: true,
        customNotifications: [
          { id: '1', event: 'order_ready', message: 'Ваш заказ готов! 🍕', enabled: true }
        ]
      },
      paymentMethods: ['cash', 'card', 'manual_verification'],
      paymentInstructions: 'Оплата при получении или переводом.',
      enableAnalytics: true,
      enableReferralSystem: true,
      enableReviews: true,
      customCommands: [
        { id: '1', command: '/menu', response: 'Показать меню', description: 'Показать полное меню', enabled: true }
      ]
    }
  },
  {
    id: 'digital_products',
    name: 'Цифровые товары',
    description: 'Продажа цифровых товаров, курсов, подписок с мгновенной доставкой',
    category: 'Digital',
    icon: <DigitalIcon />,
    color: '#673ab7',
    features: [
      'Карусель товаров',
      'Мгновенная доставка',
      'Криптоплатежи',
      'Техподдержка 24/7',
      'Гарантия возврата',
      'Реферальная система',
      'Аналитика продаж'
    ],
    preview: {
      welcomeMessage: 'Добро пожаловать! 💻\nВыберите интересующий вас продукт.',
      catalogStyle: 'Карусель',
      theme: 'Темная',
      autoResponses: 3,
      notifications: 3
    },
    settings: {
      welcomeMessage: 'Добро пожаловать! 💻\nВыберите интересующий вас продукт.',
      language: 'ru',
      currency: 'USD',
      timezone: 'UTC',
      theme: 'dark',
      primaryColor: '#673ab7',
      accentColor: '#00bcd4',
      catalogStyle: 'carousel',
      showPrices: true,
      showStock: false,
      enableSearch: true,
      categoriesPerPage: 8,
      productsPerPage: 4,
      autoResponses: {
        enabled: true,
        responses: [
          { id: '1', trigger: 'поддержка', response: 'Наша техподдержка поможет вам 24/7. Опишите вашу проблему.', enabled: true },
          { id: '2', trigger: 'гарантия', response: 'На все продукты действует гарантия возврата средств в течение 30 дней.', enabled: true },
          { id: '3', trigger: 'доставка', response: 'Цифровые товары доставляются мгновенно после подтверждения оплаты.', enabled: true }
        ]
      },
      notifications: {
        newOrder: true,
        lowStock: false,
        paymentConfirmation: true,
        orderStatusUpdate: true,
        customNotifications: []
      },
      paymentMethods: ['crypto', 'card', 'paypal'],
      paymentInstructions: 'Мгновенная доставка после оплаты.',
      enableAnalytics: true,
      enableReferralSystem: true,
      enableReviews: true,
      customCommands: []
    }
  },
  {
    id: 'beauty_salon',
    name: 'Салон красоты',
    description: 'Бот для салона красоты с записью на услуги и портфолио работ',
    category: 'Beauty & Health',
    icon: <BeautyIcon />,
    color: '#e91e63',
    features: [
      'Каталог услуг',
      'Портфолио работ',
      'Запись на услуги',
      'Напоминания о записи',
      'Программа лояльности',
      'Отзывы клиентов',
      'Консультации онлайн'
    ],
    preview: {
      welcomeMessage: 'Добро пожаловать в наш салон красоты! ✨\nЗапишитесь на услуги или посмотрите наше портфолио.',
      catalogStyle: 'Сетка',
      theme: 'Светлая',
      autoResponses: 4,
      notifications: 5
    },
    settings: {
      welcomeMessage: 'Добро пожаловать в наш салон красоты! ✨\nЗапишитесь на услуги или посмотрите наше портфолио.',
      language: 'ru',
      currency: 'USD',
      timezone: 'UTC',
      theme: 'light',
      primaryColor: '#e91e63',
      accentColor: '#9c27b0',
      catalogStyle: 'grid',
      showPrices: true,
      showStock: false,
      enableSearch: true,
      categoriesPerPage: 6,
      productsPerPage: 6,
      autoResponses: {
        enabled: true,
        workingHours: { start: '10:00', end: '20:00', timezone: 'UTC' },
        responses: [
          { id: '1', trigger: 'запись', response: 'Для записи выберите услугу из каталога или свяжитесь с администратором.', enabled: true },
          { id: '2', trigger: 'цены', response: 'Актуальные цены на все услуги смотрите в каталоге.', enabled: true },
          { id: '3', trigger: 'время работы', response: 'Мы работаем с 10:00 до 20:00, без выходных.', enabled: true },
          { id: '4', trigger: 'скидка', response: 'У нас действует программа лояльности! Узнайте подробности у администратора.', enabled: true }
        ]
      },
      notifications: {
        newOrder: true,
        lowStock: false,
        paymentConfirmation: true,
        orderStatusUpdate: true,
        customNotifications: [
          { id: '1', event: 'appointment_reminder', message: 'Напоминаем о записи завтра в {{time}}! 💅', enabled: true },
          { id: '2', event: 'birthday_discount', message: 'С днем рождения! Специальная скидка 20% 🎉', enabled: true }
        ]
      },
      paymentMethods: ['cash', 'card', 'manual_verification'],
      paymentInstructions: 'Оплата услуг после их оказания.',
      enableAnalytics: true,
      enableReferralSystem: true,
      enableReviews: true,
      customCommands: [
        { id: '1', command: '/portfolio', response: 'Показать портфолио', description: 'Показать фотографии работ', enabled: true }
      ]
    }
  },
  {
    id: 'fitness_gym',
    name: 'Фитнес-клуб',
    description: 'Бот для фитнес-клуба с абонементами, расписанием и тренировками',
    category: 'Fitness & Sports',
    icon: <FitnessIcon />,
    color: '#4caf50',
    features: [
      'Каталог абонементов',
      'Расписание занятий',
      'Онлайн тренировки',
      'Трекер прогресса',
      'Питание и рецепты',
      'Мотивационные сообщения',
      'Статистика посещений'
    ],
    preview: {
      welcomeMessage: 'Добро пожаловать в наш фитнес-клуб! 💪\nВыберите абонемент или посмотрите расписание.',
      catalogStyle: 'Список',
      theme: 'Светлая',
      autoResponses: 5,
      notifications: 6
    },
    settings: {
      welcomeMessage: 'Добро пожаловать в наш фитнес-клуб! 💪\nВыберите абонемент или посмотрите расписание.',
      language: 'ru',
      currency: 'USD',
      timezone: 'UTC',
      theme: 'light',
      primaryColor: '#4caf50',
      accentColor: '#ff9800',
      catalogStyle: 'list',
      showPrices: true,
      showStock: true,
      enableSearch: true,
      categoriesPerPage: 4,
      productsPerPage: 6,
      autoResponses: {
        enabled: true,
        workingHours: { start: '06:00', end: '24:00', timezone: 'UTC' },
        responses: [
          { id: '1', trigger: 'расписание', response: 'Актуальное расписание групповых занятий смотрите в разделе "Занятия".', enabled: true },
          { id: '2', trigger: 'абонемент', response: 'У нас есть различные виды абонементов. Выберите подходящий в каталоге.', enabled: true },
          { id: '3', trigger: 'тренер', response: 'Персональные тренировки доступны по предварительной записи.', enabled: true },
          { id: '4', trigger: 'питание', response: 'Получите персональный план питания у наших диетологов!', enabled: true },
          { id: '5', trigger: 'заморозка', response: 'Заморозка абонемента возможна на срок до 60 дней.', enabled: true }
        ]
      },
      notifications: {
        newOrder: true,
        lowStock: true,
        paymentConfirmation: true,
        orderStatusUpdate: true,
        customNotifications: [
          { id: '1', event: 'workout_reminder', message: 'Время тренировки! Не пропустите занятие 🏃‍♂️', enabled: true },
          { id: '2', event: 'membership_expiry', message: 'Ваш абонемент заканчивается через 3 дня. Продлите его!', enabled: true },
          { id: '3', event: 'achievement', message: 'Поздравляем с достижением! Вы прошли {{milestone}} тренировок 🎉', enabled: true }
        ]
      },
      paymentMethods: ['cash', 'card', 'subscription'],
      paymentInstructions: 'Оплата абонементов на стойке администратора или онлайн.',
      enableAnalytics: true,
      enableReferralSystem: true,
      enableReviews: true,
      customCommands: [
        { id: '1', command: '/schedule', response: 'Показать расписание', description: 'Показать расписание групповых занятий', enabled: true },
        { id: '2', command: '/progress', response: 'Показать прогресс', description: 'Показать статистику тренировок', enabled: true }
      ]
    }
  }
];

interface BotTemplatesProps {
  onSelectTemplate: (template: BotTemplate) => void;
  onClose: () => void;
}

const BotTemplates: React.FC<BotTemplatesProps> = ({ onSelectTemplate, onClose }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<BotTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleTemplateClick = (template: BotTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      setPreviewOpen(false);
      onClose();
    }
  };

  const categories = [...new Set(TEMPLATES.map(t => t.category))];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        🎨 Выберите шаблон для вашего бота
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Готовые шаблоны помогут быстро настроить бота под ваш тип бизнеса
      </Typography>

      {categories.map((category) => (
        <Box key={category} sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            {category}
          </Typography>
          
          <Grid container spacing={3}>
            {TEMPLATES.filter(t => t.category === category).map((template) => (
              <Grid item xs={12} md={6} lg={4} key={template.id}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': { 
                      elevation: 8,
                      transform: 'translateY(-2px)'
                    }
                  }}
                  onClick={() => handleTemplateClick(template)}
                >
                  <Box sx={{ 
                    height: 60, 
                    bgcolor: template.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}>
                    <Avatar sx={{ bgcolor: 'transparent', color: 'inherit', fontSize: 32 }}>
                      {template.icon}
                    </Avatar>
                  </Box>
                  
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {template.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {template.description}
                    </Typography>

                    <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                      <Chip 
                        icon={<DesignIcon />} 
                        label={template.preview.theme} 
                        size="small" 
                        variant="outlined" 
                      />
                      <Chip 
                        icon={<ChatIcon />} 
                        label={`${template.preview.autoResponses} ответов`} 
                        size="small" 
                        variant="outlined" 
                      />
                    </Box>

                    <Typography variant="caption" color="text.secondary" display="block">
                      {template.features.slice(0, 3).join(' • ')}
                      {template.features.length > 3 && '...'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        {selectedTemplate && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ bgcolor: selectedTemplate.color, color: 'white' }}>
                  {selectedTemplate.icon}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedTemplate.name}</Typography>
                  <Chip label={selectedTemplate.category} size="small" />
                </Box>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    📋 Возможности шаблона
                  </Typography>
                  
                  <List dense>
                    {selectedTemplate.features.map((feature, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckIcon color="success" />
                        </ListItemIcon>
                        <ListItemText primary={feature} />
                      </ListItem>
                    ))}
                  </List>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    👀 Предварительный просмотр
                  </Typography>
                  
                  <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">
                      Приветственное сообщение:
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      whiteSpace: 'pre-line',
                      p: 2,
                      bgcolor: 'grey.100',
                      borderRadius: 1,
                      mb: 2
                    }}>
                      {selectedTemplate.preview.welcomeMessage}
                    </Typography>

                    <Box display="flex" flexWrap="wrap" gap={1}>
                      <Chip 
                        icon={<DesignIcon />} 
                        label={`Каталог: ${selectedTemplate.preview.catalogStyle}`} 
                        size="small" 
                      />
                      <Chip 
                        icon={<ChatIcon />} 
                        label={`Автоответов: ${selectedTemplate.preview.autoResponses}`} 
                        size="small" 
                      />
                      <Chip 
                        icon={<NotificationIcon />} 
                        label={`Уведомлений: ${selectedTemplate.preview.notifications}`} 
                        size="small" 
                      />
                      <Chip 
                        icon={<AnalyticsIcon />} 
                        label="Аналитика включена" 
                        size="small" 
                      />
                    </Box>
                  </Paper>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary">
                <strong>💡 Совет:</strong> Все настройки шаблона можно изменить после создания бота через конструктор.
              </Typography>
            </DialogContent>

            <DialogActions>
              <Button onClick={() => setPreviewOpen(false)}>
                Отмена
              </Button>
              <Button 
                variant="contained" 
                onClick={handleUseTemplate}
                startIcon={selectedTemplate.icon}
                sx={{ bgcolor: selectedTemplate.color }}
              >
                Использовать шаблон
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default BotTemplates;
