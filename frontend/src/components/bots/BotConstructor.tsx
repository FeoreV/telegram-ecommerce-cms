import {
    Add as AddIcon,
    SmartToy as BotIcon,
    ChatBubble as ChatIcon,
    Check as CheckIcon,
    Delete as DeleteIcon,
    Palette as DesignIcon,
    Edit as EditIcon,
    Image as ImageIcon,
    Notifications as NotificationIcon,
    Payment as PaymentIcon,
    Preview as PreviewIcon,
    Settings as SettingsIcon,
    Store as StoreIcon
} from '@mui/icons-material';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    Grid,
    IconButton,
    InputLabel,
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemSecondaryAction,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Switch,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient';
import StoreDialog from '../stores/StoreDialog';
import BotTemplates from './BotTemplates';

interface BotTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  settings: BotSettings;
  preview: {
    welcomeMessage: string;
    catalogStyle: string;
    theme: string;
    autoResponses: number;
    notifications: number;
  };
  icon: string;
  color: string;
  features: string[];
}

export interface BotSettings {
  // Basic settings
  welcomeMessage: string;
  language: string;
  currency: string;
  timezone: string;

  // Start customization
  startCustomization?: {
    emoji?: string;
    greeting?: string;
    welcomeText?: string;
    showStats?: boolean;
    showDescription?: boolean;
    additionalText?: string;
    headerImage?: string;
    catalogButton?: { text: string; emoji?: string };
    profileButton?: { text: string; emoji?: string };
    helpButton?: { text: string; emoji?: string };
    extraButtons?: Array<{ text: string; url?: string; callback_data?: string }>;
  };

  // Appearance
  theme: 'light' | 'dark' | 'custom';
  primaryColor: string;
  accentColor: string;
  botAvatar?: string;
  storelogo?: string;

  // Catalog settings
  catalogStyle: 'grid' | 'list' | 'carousel';
  showPrices: boolean;
  showStock: boolean;
  enableSearch: boolean;
  categoriesPerPage: number;
  productsPerPage: number;

  // Auto-responses
  autoResponses: {
    enabled: boolean;
    workingHours?: {
      start: string;
      end: string;
      timezone: string;
    };
    responses: AutoResponse[];
  };

  // Notifications
  notifications: {
    newOrder: boolean;
    lowStock: boolean;
    paymentConfirmation: boolean;
    orderStatusUpdate: boolean;
    customNotifications: CustomNotification[];
  };

  // Payment
  paymentMethods: string[];
  paymentInstructions: string;
  paymentRequisites?: {
    card?: string;
    bank?: string;
    receiver?: string;
    comment?: string;
  };

  // Advanced
  enableAnalytics: boolean;
  enableReferralSystem: boolean;
  enableReviews: boolean;
  customCommands: CustomCommand[];
}
interface AutoResponse {
  id: string;
  trigger: string;
  response: string;
  enabled: boolean;
}

interface CustomNotification {
  id: string;
  event: string;
  message: string;
  enabled: boolean;
}

interface CustomCommand {
  id: string;
  command: string;
  response: string;
  description: string;
  enabled: boolean;
}

interface BotConstructorProps {
  open: boolean;
  onClose: () => void;
  stores: Array<{ id: string; name: string; hasBot: boolean }>;
  onBotCreated: () => void;
  editBot?: {
    storeId: string;
    settings: BotSettings;
  } | null;
}

const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: 'ecommerce_basic',
    name: 'Базовый интернет-магазин',
    description: 'Простой бот для продажи товаров с каталогом',
    category: 'E-commerce',
    icon: '🛍️',
    color: '#2196F3',
    features: [
      'Каталог товаров',
      'Быстрое оформление заказов',
      'Автоответы',
      'Уведомления'
    ],
    preview: {
      welcomeMessage: 'Добро пожаловать в наш магазин! 🛍️',
      catalogStyle: 'Сеточный вид',
      theme: 'Светлая тема',
      autoResponses: 3,
      notifications: 2
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
      paymentRequisites: {
        card: '',
        bank: '',
        receiver: '',
        comment: ''
      },
      enableAnalytics: true,
      enableReferralSystem: false,
      enableReviews: true,
      customCommands: []
    }
  },
  {
    id: 'restaurant',
    name: 'Ресторан/Доставка еды',
    description: 'Бот для ресторана с меню, заказами и доставкой',
    category: 'Food & Beverage',
    icon: '🍕',
    color: '#FF5722',
    features: [
      'Меню ресторана',
      'Доставка еды',
      'Бронирование столов',
      'Отзывы клиентов',
      'Рабочие часы'
    ],
    preview: {
      welcomeMessage: 'Добро пожаловать в наш ресторан! 🍽️',
      catalogStyle: 'Список с изображениями',
      theme: 'Теплая тема',
      autoResponses: 5,
      notifications: 4
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
          { id: '2', trigger: 'доставка', response: 'Доставка занимает 30-60 минут в зависимости от загруженности.', enabled: true }
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
    description: 'Продажа цифровых товаров, курсов, подписок',
    category: 'Digital',
    icon: '💻',
    color: '#9C27B0',
    features: [
      'Цифровые товары',
      'Курсы и обучение',
      'Подписки',
      'Мгновенная доставка',
      'Лицензии'
    ],
    preview: {
      welcomeMessage: 'Цифровые товары и услуги 💻',
      catalogStyle: 'Карточки с описанием',
      theme: 'Технологичная тема',
      autoResponses: 4,
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
          { id: '1', trigger: 'поддержка', response: 'Наша техподдержка поможет вам 24/7.', enabled: true },
          { id: '2', trigger: 'гарантия', response: 'На все продукты действует гарантия возврата средств.', enabled: true }
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
  }
];

const STEPS = [
  { id: 'basic', label: 'Основные настройки', icon: <SettingsIcon /> },
  { id: 'template', label: 'Выбор шаблона', icon: <BotIcon /> },
  { id: 'customization', label: 'Кастомизация', icon: <DesignIcon /> },
  { id: 'responses', label: 'Автоответы и FAQ', icon: <ChatIcon /> },
  { id: 'payment', label: 'Оплата', icon: <PaymentIcon /> },
  { id: 'notifications', label: 'Уведомления', icon: <NotificationIcon /> },
  { id: 'preview', label: 'Предпросмотр', icon: <PreviewIcon /> }
];

const BotConstructor: React.FC<BotConstructorProps> = ({
  open,
  onClose,
  stores,
  onBotCreated,
  editBot
}) => {
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStore, setSelectedStore] = useState('');
  const [botToken, setBotToken] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [settings, setSettings] = useState<BotSettings>(BOT_TEMPLATES[0].settings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showStoreDialog, setShowStoreDialog] = useState(false);
  const [extraButton, setExtraButton] = useState({ text: '', url: '', callback_data: '' });

  // States for FAQ/Auto-responses management
  const [newFaq, setNewFaq] = useState({ trigger: '', response: '' });
  const [editingFaq, setEditingFaq] = useState<string | null>(null);
  const [editingData, setEditingData] = useState({ trigger: '', response: '' });

  // Validation functions
  const isValidBotToken = (token: string): boolean => {
    const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
    return tokenPattern.test(token.trim());
  };

  const isValidBotUsername = (username: string): boolean => {
    const usernamePattern = /^[a-zA-Z][a-zA-Z0-9_]*bot$/i;
    return !username || usernamePattern.test(username.trim());
  };

  // Available stores without bots (or the current store being edited)
  const availableStores = editBot
    ? stores.filter(store => store.id === editBot.storeId || !store.hasBot)
    : stores.filter(store => !store.hasBot);

  useEffect(() => {
    if (editBot) {
      // Load existing bot settings for editing with defaults for undefined values
      setSelectedStore(editBot.storeId);
      setSettings({
        ...editBot.settings,
        // Ensure all boolean fields have default values
        startCustomization: {
          showStats: editBot.settings.startCustomization?.showStats ?? true,
          showDescription: editBot.settings.startCustomization?.showDescription ?? true,
          ...editBot.settings.startCustomization
        },
        showPrices: editBot.settings.showPrices ?? true,
        showStock: editBot.settings.showStock ?? true,
        enableSearch: editBot.settings.enableSearch ?? true,
        autoResponses: {
          enabled: editBot.settings.autoResponses?.enabled ?? true,
          workingHours: editBot.settings.autoResponses?.workingHours,
          responses: editBot.settings.autoResponses?.responses ?? []
        },
        notifications: {
          newOrder: editBot.settings.notifications?.newOrder ?? true,
          lowStock: editBot.settings.notifications?.lowStock ?? false,
          paymentConfirmation: editBot.settings.notifications?.paymentConfirmation ?? true,
          orderStatusUpdate: editBot.settings.notifications?.orderStatusUpdate ?? true,
          customNotifications: editBot.settings.notifications?.customNotifications ?? []
        },
        enableAnalytics: editBot.settings.enableAnalytics ?? true,
        enableReferralSystem: editBot.settings.enableReferralSystem ?? false,
        enableReviews: editBot.settings.enableReviews ?? true
      });
      // Skip basic and template steps when editing
      setCurrentStep(2); // Start at customization step
    } else {
      // Reset to first step when creating new bot
      setCurrentStep(0);
    }
  }, [editBot]);

  useEffect(() => {
    if (selectedTemplate) {
      const template = BOT_TEMPLATES.find(t => t.id === selectedTemplate);
      if (template) {
        setSettings({ ...template.settings });
      }
    }
  }, [selectedTemplate]);

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    // When editing, don't go back before step 2 (customization)
    const minStep = editBot ? 2 : 0;
    setCurrentStep(prev => Math.max(prev - 1, minStep));
  };

  const validateCurrentStep = (): boolean => {
    const errors: Record<string, string> = {};

    switch (STEPS[currentStep].id) {
      case 'basic':
        if (!selectedStore) errors.store = 'Выберите магазин';
        // Skip token validation when editing
        if (!editBot) {
          if (!botToken) errors.token = 'Введите токен бота';
          else if (!isValidBotToken(botToken)) errors.token = 'Неверный формат токена';
          if (botUsername && !isValidBotUsername(botUsername)) errors.username = 'Неверный формат username';
        }
        break;
      case 'template':
        if (!selectedTemplate && !editBot) errors.template = 'Выберите шаблон';
        break;
      case 'customization':
        if (!settings.welcomeMessage.trim()) errors.welcomeMessage = 'Введите приветственное сообщение';
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSettingsChange = <K extends keyof BotSettings>(
    key: K,
    value: BotSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateBot = async () => {
    if (!validateCurrentStep()) return;

    setLoading(true);
    setError('');

    try {
      const botData = {
        storeId: selectedStore,
        botToken,
        botUsername: botUsername || undefined,
        settings
      };

      if (editBot) {
        await apiClient.put(`/bots/${selectedStore}/settings`, { settings });
      } else {
        await apiClient.post('/bots', botData);
      }

      onBotCreated();
      onClose();
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Ошибка создания бота';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderBasicStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🤖 Основные настройки бота
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <FormControl fullWidth error={!!validationErrors.store}>
            <InputLabel>Выберите магазин</InputLabel>
            <Select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              label="Выберите магазин"
              disabled={!!editBot}
            >
              {availableStores.map(store => (
                <MenuItem key={store.id} value={store.id}>
                  {store.name}
                </MenuItem>
              ))}
            </Select>
            {validationErrors.store && (
              <Typography variant="caption" color="error">
                {validationErrors.store}
              </Typography>
            )}
            {availableStores.length === 0 && !editBot && (
              <Alert severity="warning" sx={{ mt: 1 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<StoreIcon />}
                    onClick={() => setShowStoreDialog(true)}
                  >
                    Создать магазин
                  </Button>
                }
              >
                У всех ваших магазинов уже есть боты. Создайте новый магазин для создания бота.
              </Alert>
            )}
          </FormControl>
        </Grid>

        {!editBot && (
          <>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>📖 Как создать бота в @BotFather:</strong>
                  <br />1. Найдите @BotFather в Telegram
                  <br />2. Отправьте /newbot
                  <br />3. Введите имя и username бота
                  <br />4. Скопируйте полученный токен
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Токен бота"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                fullWidth
                required
                error={!!validationErrors.token}
                helperText={validationErrors.token || "Токен получите у @BotFather"}
                placeholder="1234567890:ABCdefGhIJklmNOpqRStuvwXYz"
                InputProps={{
                  style: { fontFamily: 'monospace', fontSize: '0.9rem' }
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Username бота (необязательно)"
                value={botUsername}
                onChange={(e) => setBotUsername(e.target.value)}
                fullWidth
                error={!!validationErrors.username}
                helperText={validationErrors.username || "Если не указано, будет получено автоматически"}
                placeholder="my_shop_bot"
              />
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );

  const renderTemplateStep = () => {
    const handleTemplateSelect = (template: BotTemplate) => {
      setSelectedTemplate(template.id);
      setSettings({ ...template.settings });
    };

    return (
      <Box>
        <BotTemplates
          onSelectTemplate={handleTemplateSelect}
          onClose={() => {}}
        />

        {validationErrors.template && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {validationErrors.template}
          </Alert>
        )}
      </Box>
    );
  };

  const renderCustomizationStep = () => {
    const customization = settings.startCustomization || {};

    const handleCustomizationChange = (field: string, value: unknown) => {
      setSettings(prev => ({
        ...prev,
        startCustomization: {
          ...customization,
          [field]: value
        }
      }));
    };

    const handleButtonChange = (buttonType: string, field: string, value: string) => {
      const button = customization[buttonType as keyof typeof customization] || {};
      handleCustomizationChange(buttonType, {
        ...(typeof button === 'object' ? button : {}),
        [field]: value
      });
    };

    const addExtraButton = () => {
      if (!extraButton.text || (!extraButton.url && !extraButton.callback_data)) return;

      const currentButtons = customization.extraButtons || [];
      handleCustomizationChange('extraButtons', [
        ...currentButtons,
        { ...extraButton }
      ]);
      setExtraButton({ text: '', url: '', callback_data: '' });
    };

    const removeExtraButton = (index: number) => {
      const currentButtons = customization.extraButtons || [];
      handleCustomizationChange('extraButtons', currentButtons.filter((_, i) => i !== index));
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          🎨 Кастомизация внешнего вида и интерфейса бота
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Настройте язык, валюту и стартовое сообщение бота
        </Typography>

        <Tabs value={0} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Настройки и локализация" />
        </Tabs>

        <Grid container spacing={3}>
          {/* Локализация */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }}>
              <Chip label="🌍 Локализация" />
            </Divider>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Язык интерфейса</InputLabel>
              <Select
                value={settings.language}
                onChange={(e) => handleSettingsChange('language', e.target.value)}
                label="Язык интерфейса"
              >
                <MenuItem value="ru">🇷🇺 Русский</MenuItem>
                <MenuItem value="en">🇬🇧 English</MenuItem>
                <MenuItem value="uk">🇺🇦 Українська</MenuItem>
                <MenuItem value="es">🇪🇸 Español</MenuItem>
                <MenuItem value="de">🇩🇪 Deutsch</MenuItem>
                <MenuItem value="fr">🇫🇷 Français</MenuItem>
                <MenuItem value="it">🇮🇹 Italiano</MenuItem>
                <MenuItem value="pt">🇵🇹 Português</MenuItem>
                <MenuItem value="tr">🇹🇷 Türkçe</MenuItem>
                <MenuItem value="ar">🇸🇦 العربية</MenuItem>
                <MenuItem value="zh">🇨🇳 中文</MenuItem>
                <MenuItem value="ja">🇯🇵 日本語</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Валюта</InputLabel>
              <Select
                value={settings.currency}
                onChange={(e) => handleSettingsChange('currency', e.target.value)}
                label="Валюта"
              >
                <MenuItem value="USD">$ USD - Доллар США</MenuItem>
                <MenuItem value="EUR">€ EUR - Евро</MenuItem>
                <MenuItem value="RUB">₽ RUB - Российский рубль</MenuItem>
                <MenuItem value="UAH">₴ UAH - Украинская гривна</MenuItem>
                <MenuItem value="KZT">₸ KZT - Казахский тенге</MenuItem>
                <MenuItem value="GBP">£ GBP - Фунт стерлингов</MenuItem>
                <MenuItem value="TRY">₺ TRY - Турецкая лира</MenuItem>
                <MenuItem value="BRL">R$ BRL - Бразильский реал</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Часовой пояс</InputLabel>
              <Select
                value={settings.timezone}
                onChange={(e) => handleSettingsChange('timezone', e.target.value)}
                label="Часовой пояс"
              >
                <MenuItem value="UTC">UTC (GMT+0)</MenuItem>
                <MenuItem value="Europe/Moscow">Москва (GMT+3)</MenuItem>
                <MenuItem value="Europe/Kiev">Киев (GMT+2)</MenuItem>
                <MenuItem value="Asia/Almaty">Алматы (GMT+6)</MenuItem>
                <MenuItem value="Europe/Istanbul">Стамбул (GMT+3)</MenuItem>
                <MenuItem value="America/New_York">Нью-Йорк (GMT-5)</MenuItem>
                <MenuItem value="America/Los_Angeles">Лос-Анджелес (GMT-8)</MenuItem>
                <MenuItem value="Asia/Dubai">Дубай (GMT+4)</MenuItem>
                <MenuItem value="Asia/Tokyo">Токио (GMT+9)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Стартовое сообщение */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }}>
              <Chip label="💬 Стартовое сообщение" />
            </Divider>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Приветственное сообщение"
              value={settings.welcomeMessage}
              onChange={(e) => handleSettingsChange('welcomeMessage', e.target.value)}
              fullWidth
              multiline
              rows={4}
              required
              error={!!validationErrors.welcomeMessage}
              helperText={validationErrors.welcomeMessage || "Основное сообщение при команде /start"}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Эмоджи бота"
              value={customization.emoji || '🛍️'}
              onChange={(e) => handleCustomizationChange('emoji', e.target.value)}
              fullWidth
              placeholder="🛍️"
              helperText="Главный символ бота"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="URL картинки для шапки"
              value={customization.headerImage || ''}
              onChange={(e) => handleCustomizationChange('headerImage', e.target.value)}
              fullWidth
              placeholder="https://example.com/header.jpg"
              helperText="Изображение в приветствии (необязательно)"
              InputProps={{
                startAdornment: <ImageIcon sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Дополнительный текст (акции, анонсы)"
              value={customization.additionalText || ''}
              onChange={(e) => handleCustomizationChange('additionalText', e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="🔥 Только сегодня: скидка 20% на все товары!"
              helperText="Информация об акциях и специальных предложениях"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={customization.showStats ?? true}
                  onChange={(e) => handleCustomizationChange('showStats', e.target.checked)}
                />
              }
              label="Показывать статистику магазина"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={customization.showDescription ?? true}
                  onChange={(e) => handleCustomizationChange('showDescription', e.target.checked)}
                />
              }
              label="Показывать описание магазина"
            />
          </Grid>

          {/* Кнопки меню */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }}>
              <Chip label="🔘 Кнопки меню" />
            </Divider>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Кнопка каталога"
              value={customization.catalogButton?.text || '🛒 Каталог товаров'}
              onChange={(e) => handleButtonChange('catalogButton', 'text', e.target.value)}
              fullWidth
              helperText="Текст кнопки просмотра товаров"
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Кнопка профиля"
              value={customization.profileButton?.text || '👤 Профиль'}
              onChange={(e) => handleButtonChange('profileButton', 'text', e.target.value)}
              fullWidth
              helperText="Текст кнопки профиля пользователя"
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              label="Кнопка помощи"
              value={customization.helpButton?.text || '❓ Помощь и контакты'}
              onChange={(e) => handleButtonChange('helpButton', 'text', e.target.value)}
              fullWidth
              helperText="Текст кнопки поддержки"
            />
          </Grid>

          {/* Дополнительные кнопки */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }}>
              <Chip label="➕ Дополнительные кнопки" />
            </Divider>
          </Grid>

          {customization.extraButtons && customization.extraButtons.length > 0 && (
            <Grid item xs={12}>
              <List>
                {customization.extraButtons.map((btn, index) => (
                  <ListItem key={`extra-button-${index}-${btn.text}`} sx={{ bgcolor: 'action.hover', mb: 1, borderRadius: 1 }}>
                    <ListItemIcon>
                      <AddIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={btn.text}
                      secondary={btn.url || btn.callback_data}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => removeExtraButton(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Grid>
          )}

          <Grid item xs={12} md={5}>
            <TextField
              label="Текст кнопки"
              value={extraButton.text}
              onChange={(e) => setExtraButton({ ...extraButton, text: e.target.value })}
              fullWidth
              placeholder="📢 Наш канал"
            />
          </Grid>

          <Grid item xs={12} md={5}>
            <TextField
              label="URL (для внешних ссылок)"
              value={extraButton.url}
              onChange={(e) => setExtraButton({ ...extraButton, url: e.target.value, callback_data: '' })}
              fullWidth
              placeholder="https://t.me/your_channel"
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addExtraButton}
              disabled={!extraButton.text || (!extraButton.url && !extraButton.callback_data)}
              fullWidth
              sx={{ height: '56px' }}
            >
              Добавить
            </Button>
          </Grid>

          {/* Превью */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }}>
              <Chip label="👀 Предпросмотр интерфейса" icon={<PreviewIcon />} />
            </Divider>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{
              p: 3,
              bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary'
            }}>
              <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap' }}>
                {customization.emoji || '🛍️'} <strong>{settings.welcomeMessage || 'Добро пожаловать!'}</strong>
                {'\n\n'}
                {(customization.showDescription ?? true) && '📝 Современный магазин с быстрой доставкой\n\n'}
                {customization.additionalText && `${customization.additionalText}\n\n`}
                {(customization.showStats ?? true) && '📊 О магазине:\n• Товаров в наличии: 120\n• Выполненных заказов: 450\n• ⭐ Рейтинг: 4.8/5\n\n'}
                Выберите действие:
                {'\n\n'}
                <Box component="div" sx={{ mt: 2 }}>
                  <Chip
                    label={customization.catalogButton?.text || '🛒 Каталог товаров'}
                    sx={{ m: 0.5, bgcolor: 'primary.main', color: 'white' }}
                  />
                  <Chip
                    label={customization.profileButton?.text || '👤 Профиль'}
                    sx={{ m: 0.5, bgcolor: 'primary.main', color: 'white' }}
                  />
                  <Chip
                    label={customization.helpButton?.text || '❓ Помощь и контакты'}
                    sx={{ m: 0.5, bgcolor: 'primary.main', color: 'white' }}
                  />
                  {customization.extraButtons?.map((btn, i) => (
                    <Chip
                      key={`extra-btn-${i}`}
                      label={btn.text}
                      sx={{ m: 0.5, bgcolor: 'secondary.main', color: 'white' }}
                    />
                  ))}
                </Box>
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>💡 Совет:</strong> Выберите цвета, соответствующие вашему бренду.
                Добавьте языки и валюту для работы на международном рынке.
              </Typography>
            </Alert>
          </Grid>
        </Grid>

        {validationErrors.customization && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {validationErrors.customization}
          </Alert>
        )}
      </Box>
    );
  };


  const renderResponsesStep = () => {
    const addFaq = () => {
      if (!newFaq.trigger.trim() || !newFaq.response.trim()) return;

      const newResponse: AutoResponse = {
        id: Date.now().toString(),
        trigger: newFaq.trigger.trim(),
        response: newFaq.response.trim(),
        enabled: true
      };

      handleSettingsChange('autoResponses', {
        ...settings.autoResponses,
        responses: [...settings.autoResponses.responses, newResponse]
      });

      setNewFaq({ trigger: '', response: '' });
    };

    const deleteFaq = (id: string) => {
      handleSettingsChange('autoResponses', {
        ...settings.autoResponses,
        responses: settings.autoResponses.responses.filter(r => r.id !== id)
      });
    };

    const startEdit = (response: AutoResponse) => {
      setEditingFaq(response.id);
      setEditingData({ trigger: response.trigger, response: response.response });
    };

    const saveEdit = (id: string) => {
      const updatedResponses = settings.autoResponses.responses.map(r =>
        r.id === id ? { ...r, trigger: editingData.trigger, response: editingData.response } : r
      );
      handleSettingsChange('autoResponses', {
        ...settings.autoResponses,
        responses: updatedResponses
      });
      setEditingFaq(null);
    };

    const toggleFaq = (id: string, enabled: boolean) => {
      const updatedResponses = settings.autoResponses.responses.map(r =>
        r.id === id ? { ...r, enabled } : r
      );
      handleSettingsChange('autoResponses', {
        ...settings.autoResponses,
        responses: updatedResponses
      });
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          💬 Автоответы и FAQ
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Настройте автоматические ответы на часто задаваемые вопросы
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.autoResponses.enabled}
              onChange={(e) => handleSettingsChange('autoResponses', {
                ...settings.autoResponses,
                enabled: e.target.checked
              })}
            />
          }
          label="Включить автоответы и FAQ"
          sx={{ mb: 3 }}
        />

        {settings.autoResponses.enabled && (
          <Grid container spacing={3}>
            {/* Рабочие часы */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }}>
                <Chip label="⏰ Рабочие часы (необязательно)" />
              </Divider>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Начало рабочего дня"
                type="time"
                value={settings.autoResponses.workingHours?.start || '09:00'}
                onChange={(e) => handleSettingsChange('autoResponses', {
                  ...settings.autoResponses,
                  workingHours: {
                    ...settings.autoResponses.workingHours,
                    start: e.target.value,
                    end: settings.autoResponses.workingHours?.end || '18:00',
                    timezone: settings.autoResponses.workingHours?.timezone || 'UTC'
                  }
                })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Конец рабочего дня"
                type="time"
                value={settings.autoResponses.workingHours?.end || '18:00'}
                onChange={(e) => handleSettingsChange('autoResponses', {
                  ...settings.autoResponses,
                  workingHours: {
                    ...settings.autoResponses.workingHours,
                    start: settings.autoResponses.workingHours?.start || '09:00',
                    end: e.target.value,
                    timezone: settings.autoResponses.workingHours?.timezone || 'UTC'
                  }
                })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Часовой пояс</InputLabel>
                <Select
                  value={settings.autoResponses.workingHours?.timezone || 'UTC'}
                  onChange={(e) => handleSettingsChange('autoResponses', {
                    ...settings.autoResponses,
                    workingHours: {
                      ...settings.autoResponses.workingHours,
                      start: settings.autoResponses.workingHours?.start || '09:00',
                      end: settings.autoResponses.workingHours?.end || '18:00',
                      timezone: e.target.value
                    }
                  })}
                  label="Часовой пояс"
                >
                  <MenuItem value="UTC">UTC</MenuItem>
                  <MenuItem value="Europe/Moscow">Москва</MenuItem>
                  <MenuItem value="Europe/Kiev">Киев</MenuItem>
                  <MenuItem value="Asia/Almaty">Алматы</MenuItem>
                  <MenuItem value="Europe/Istanbul">Стамбул</MenuItem>
                  <MenuItem value="America/New_York">Нью-Йорк</MenuItem>
                  <MenuItem value="America/Los_Angeles">Лос-Анджелес</MenuItem>
                  <MenuItem value="Asia/Dubai">Дубай</MenuItem>
                  <MenuItem value="Asia/Tokyo">Токио</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* FAQ список */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }}>
                <Chip label="❓ Список FAQ" />
              </Divider>
            </Grid>

            {settings.autoResponses.responses.length > 0 ? (
              <Grid item xs={12}>
                <List>
                  {settings.autoResponses.responses.map((response) => (
                    <ListItem
                      key={response.id}
                      sx={{
                        bgcolor: response.enabled ? 'action.hover' : 'action.disabledBackground',
                        mb: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      {editingFaq === response.id ? (
                        <Box sx={{ width: '100%' }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                              <TextField
                                label="Триггер (ключевое слово)"
                                value={editingData.trigger}
                                onChange={(e) => setEditingData({ ...editingData, trigger: e.target.value })}
                                fullWidth
                                size="small"
                              />
                            </Grid>
                            <Grid item xs={12} md={8}>
                              <TextField
                                label="Ответ"
                                value={editingData.response}
                                onChange={(e) => setEditingData({ ...editingData, response: e.target.value })}
                                fullWidth
                                size="small"
                                multiline
                                rows={2}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <Box display="flex" gap={1}>
                                <Button
                                  key="save"
                                  variant="contained"
                                  size="small"
                                  startIcon={<CheckIcon />}
                                  onClick={() => saveEdit(response.id)}
                                >
                                  Сохранить
                                </Button>
                                <Button
                                  key="cancel"
                                  variant="outlined"
                                  size="small"
                                  onClick={() => setEditingFaq(null)}
                                >
                                  Отмена
                                </Button>
                              </Box>
                            </Grid>
                          </Grid>
                        </Box>
                      ) : (
                        <>
                          <ListItemIcon>
                            <ChatIcon color={response.enabled ? 'primary' : 'disabled'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Chip key="trigger" label={response.trigger} size="small" color="primary" variant="outlined" />
                                {!response.enabled && <Chip key="disabled" label="Выключено" size="small" color="default" />}
                              </Box>
                            }
                            secondary={response.response}
                          />
                          <ListItemSecondaryAction>
                            <Box display="flex" gap={1}>
                              <Tooltip key="toggle" title={response.enabled ? "Отключить" : "Включить"}>
                                <Switch
                                  checked={response.enabled}
                                  onChange={(e) => toggleFaq(response.id, e.target.checked)}
                                  size="small"
                                />
                              </Tooltip>
                              <Tooltip key="edit" title="Редактировать">
                                <IconButton
                                  edge="end"
                                  onClick={() => startEdit(response)}
                                  size="small"
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip key="delete" title="Удалить">
                                <IconButton
                                  edge="end"
                                  onClick={() => deleteFaq(response.id)}
                                  color="error"
                                  size="small"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </ListItemSecondaryAction>
                        </>
                      )}
                    </ListItem>
                  ))}
                </List>
              </Grid>
            ) : (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    Пока не добавлено ни одного FAQ. Добавьте первый вопрос-ответ ниже.
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* Добавление нового FAQ */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }}>
                <Chip label="➕ Добавить новый FAQ" />
              </Divider>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Триггер (ключевое слово)"
                value={newFaq.trigger}
                onChange={(e) => setNewFaq({ ...newFaq, trigger: e.target.value })}
                fullWidth
                placeholder="помощь, доставка, оплата..."
                helperText="Слово или фраза, которую ищет бот"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Ответ бота"
                value={newFaq.response}
                onChange={(e) => setNewFaq({ ...newFaq, response: e.target.value })}
                fullWidth
                multiline
                rows={3}
                placeholder="Текст ответа, который увидит пользователь"
                helperText="Будет отправлен при обнаружении триггера"
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={addFaq}
                disabled={!newFaq.trigger.trim() || !newFaq.response.trim()}
                fullWidth
                sx={{ height: '56px' }}
              >
                Добавить
              </Button>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>💡 Как работают автоответы:</strong>
                  <br />• Бот ищет триггерные слова в сообщениях пользователей
                  <br />• При обнаружении триггера автоматически отправляет заданный ответ
                  <br />• Можно использовать несколько FAQ для разных вопросов
                  <br />• Отключенные FAQ не будут срабатывать
                  <br />• Рабочие часы помогут настроить автоответы вне рабочего времени
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        )}
      </Box>
    );
  };

  const renderPaymentStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        💳 Настройка оплаты
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Настройте способы оплаты и P2P реквизиты для приема платежей
      </Typography>

      <Grid container spacing={3}>
        {/* Инструкции по оплате */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }}>
            <Chip label="📋 Инструкции по оплате" />
          </Divider>
        </Grid>

        <Grid item xs={12}>
          <TextField
            label="Инструкции для клиентов"
            value={settings.paymentInstructions}
            onChange={(e) => handleSettingsChange('paymentInstructions', e.target.value)}
            fullWidth
            multiline
            rows={4}
            placeholder="Оплатите заказ и прикрепите скриншот чека..."
            helperText="Эти инструкции увидят покупатели при оформлении заказа"
          />
        </Grid>

        {/* P2P Реквизиты */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }}>
            <Chip label="💰 P2P Реквизиты для оплаты" />
          </Divider>
        </Grid>

        <Grid item xs={12}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>⚠️ Важно:</strong> Эти данные будут показаны всем клиентам при оплате заказов.
              Убедитесь, что указали корректные реквизиты.
            </Typography>
          </Alert>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Номер карты"
            placeholder="1234 5678 9012 3456"
            value={settings.paymentRequisites?.card || ''}
            onChange={(e) => handleSettingsChange('paymentRequisites', {
              ...settings.paymentRequisites,
              card: e.target.value
            })}
            helperText="Номер карты для перевода средств"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Банк"
            placeholder="Сбербанк, ВТБ, Тинькофф..."
            value={settings.paymentRequisites?.bank || ''}
            onChange={(e) => handleSettingsChange('paymentRequisites', {
              ...settings.paymentRequisites,
              bank: e.target.value
            })}
            helperText="Название банка-эмитента карты"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Получатель"
            placeholder="Иванов Иван Иванович"
            value={settings.paymentRequisites?.receiver || ''}
            onChange={(e) => handleSettingsChange('paymentRequisites', {
              ...settings.paymentRequisites,
              receiver: e.target.value
            })}
            helperText="ФИО владельца карты"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Комментарий к переводу"
            placeholder="Заказ №..."
            value={settings.paymentRequisites?.comment || ''}
            onChange={(e) => handleSettingsChange('paymentRequisites', {
              ...settings.paymentRequisites,
              comment: e.target.value
            })}
            helperText="Обязательный комментарий (необязательно)"
          />
        </Grid>

        {/* Превью реквизитов */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }}>
            <Chip label="👀 Как это увидят клиенты" icon={<PreviewIcon />} />
          </Divider>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              💳 Реквизиты для оплаты:
            </Typography>
            <Typography variant="body2" component="div" sx={{ mt: 2, fontFamily: 'monospace' }}>
              {settings.paymentRequisites?.card ? (
                <>
                  <strong>Карта:</strong> {settings.paymentRequisites.card}<br />
                  {settings.paymentRequisites.bank && (
                    <><strong>Банк:</strong> {settings.paymentRequisites.bank}<br /></>
                  )}
                  {settings.paymentRequisites.receiver && (
                    <><strong>Получатель:</strong> {settings.paymentRequisites.receiver}<br /></>
                  )}
                  {settings.paymentRequisites.comment && (
                    <><strong>Комментарий:</strong> {settings.paymentRequisites.comment}<br /></>
                  )}
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="body2">
                      {settings.paymentInstructions || 'Инструкции по оплате не заданы'}
                    </Typography>
                  </Box>
                </>
              ) : (
                <Alert severity="info">
                  Заполните реквизиты выше, чтобы увидеть предпросмотр
                </Alert>
              )}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>💡 Совет:</strong> Вы можете добавить несколько способов оплаты в инструкциях,
              например: банковский перевод, криптовалюта, электронные кошельки и т.д.
            </Typography>
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );

  const renderNotificationsStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        🔔 Настройка уведомлений
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Настройте уведомления о важных событиях в боте
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }}>
            <Chip label="⚙️ Системные уведомления" />
          </Divider>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.newOrder}
                onChange={(e) => handleSettingsChange('notifications', {
                  ...settings.notifications,
                  newOrder: e.target.checked
                })}
              />
            }
            label="📦 Новые заказы"
          />
          <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
            Уведомление при создании нового заказа
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.paymentConfirmation}
                onChange={(e) => handleSettingsChange('notifications', {
                  ...settings.notifications,
                  paymentConfirmation: e.target.checked
                })}
              />
            }
            label="💰 Подтверждение оплаты"
          />
          <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
            Уведомление при подтверждении платежа
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.orderStatusUpdate}
                onChange={(e) => handleSettingsChange('notifications', {
                  ...settings.notifications,
                  orderStatusUpdate: e.target.checked
                })}
              />
            }
            label="🔄 Изменение статуса заказа"
          />
          <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
            Уведомление при смене статуса заказа
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.lowStock}
                onChange={(e) => handleSettingsChange('notifications', {
                  ...settings.notifications,
                  lowStock: e.target.checked
                })}
              />
            }
            label="⚠️ Низкие остатки товаров"
          />
          <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
            Предупреждение о малом количестве товара
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>💡 Совет:</strong> Включайте только необходимые уведомления,
              чтобы не перегружать администраторов лишними сообщениями.
            </Typography>
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );

  const renderPreviewStep = () => {
    const customization = settings.startCustomization || {};

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          👀 Предварительный просмотр бота
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Интерактивная симуляция того, как ваш бот будет выглядеть для пользователей
        </Typography>

        <Grid container spacing={3}>
          {/* Симуляция Telegram интерфейса */}
          <Grid item xs={12} lg={6}>
            <Paper
              elevation={3}
              sx={{
                p: 0,
                maxWidth: 450,
                mx: 'auto',
                bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff',
                borderRadius: 3,
                overflow: 'hidden'
              }}
            >
              {/* Хедер бота */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'primary.main',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <Avatar sx={{ bgcolor: 'white', color: 'primary.main' }}>
                  {customization.emoji || '🤖'}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {botUsername || 'Ваш бот'}
                  </Typography>
                  <Typography variant="caption">
                    онлайн • бот
                  </Typography>
                </Box>
              </Box>

              {/* Сообщение бота */}
              <Box sx={{ p: 3, bgcolor: theme.palette.mode === 'dark' ? '#2a2a2a' : 'grey.50' }}>
                {customization.headerImage && (
                  <Box
                    component="img"
                    src={customization.headerImage}
                    sx={{
                      width: '100%',
                      borderRadius: 2,
                      mb: 2,
                      maxHeight: 200,
                      objectFit: 'cover'
                    }}
                    alt="Header"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}

                <Paper sx={{
                  p: 2,
                  bgcolor: theme.palette.mode === 'dark' ? '#363636' : 'white',
                  borderRadius: 2,
                  color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary'
                }}>
                  <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap' }}>
                    {customization.emoji || '🛍️'} <strong>{settings.welcomeMessage || 'Добро пожаловать!'}</strong>
                    {'\n\n'}
                    {(customization.showDescription ?? true) && '📝 Современный магазин с быстрой доставкой\n\n'}
                    {customization.additionalText && `${customization.additionalText}\n\n`}
                    {(customization.showStats ?? true) && '📊 О магазине:\n• 🛍️ Товаров: 120\n• ✅ Заказов: 450\n• ⭐ Рейтинг: 4.8/5\n\n'}
                    Выберите действие:
                    {'\n\n'}
                    <Box component="div" sx={{ mt: 2 }}>
                      <Chip
                        label={customization.catalogButton?.text || '🛒 Каталог товаров'}
                        sx={{ m: 0.5, bgcolor: 'primary.main', color: 'white' }}
                      />
                      <Chip
                        label={customization.profileButton?.text || '👤 Профиль'}
                        sx={{ m: 0.5, bgcolor: 'primary.main', color: 'white' }}
                      />
                      <Chip
                        label={customization.helpButton?.text || '❓ Помощь и контакты'}
                        sx={{ m: 0.5, bgcolor: 'primary.main', color: 'white' }}
                      />
                      {customization.extraButtons?.map((btn, i) => (
                        <Chip
                          key={`extra-btn-${i}`}
                          label={btn.text}
                          sx={{ m: 0.5, bgcolor: 'secondary.main', color: 'white' }}
                        />
                      ))}
                    </Box>
                  </Typography>
                </Paper>
              </Box>
            </Paper>
          </Grid>

          {/* Сводка настроек */}
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📋 Сводка настроек
                </Typography>

                <List>
                  <ListItem key="summary-basic">
                    <ListItemIcon><SettingsIcon color="primary" /></ListItemIcon>
                    <ListItemText
                      primary="Основные настройки"
                      secondary={`Язык: ${settings.language.toUpperCase()} • Валюта: ${settings.currency}`}
                    />
                  </ListItem>

                  <ListItem key="summary-design">
                    <ListItemIcon><DesignIcon color="primary" /></ListItemIcon>
                    <ListItemText
                      primary="Внешний вид"
                      secondary="Стандартное оформление"
                    />
                  </ListItem>

                  <ListItem key="summary-autoresponses">
                    <ListItemIcon><ChatIcon color="primary" /></ListItemIcon>
                    <ListItemText
                      primary="Автоответы"
                      secondary={settings.autoResponses.enabled
                        ? `Включено • ${settings.autoResponses.responses.length} ответов`
                        : 'Выключено'
                      }
                    />
                  </ListItem>

                  <ListItem key="summary-notifications">
                    <ListItemIcon><NotificationIcon color="primary" /></ListItemIcon>
                    <ListItemText
                      primary="Уведомления"
                      secondary={`${[
                        settings.notifications.newOrder && 'Новые заказы',
                        settings.notifications.paymentConfirmation && 'Оплата',
                        settings.notifications.orderStatusUpdate && 'Статусы',
                        settings.notifications.lowStock && 'Остатки'
                      ].filter(Boolean).join(', ') || 'Не настроены'}`}
                    />
                  </ListItem>

                  <ListItem key="summary-payment">
                    <ListItemIcon><PaymentIcon color="primary" /></ListItemIcon>
                    <ListItemText
                      primary="Реквизиты оплаты"
                      secondary={settings.paymentRequisites?.card
                        ? `Карта: ${settings.paymentRequisites.card.slice(0, 4)}...${settings.paymentRequisites.card.slice(-4)}`
                        : 'Не указаны'
                      }
                    />
                  </ListItem>
                </List>

                <Divider sx={{ my: 2 }} />

                <Alert severity="success">
                  <Typography variant="body2">
                    <strong>✅ Готово к созданию!</strong>
                    <br />Ваш бот настроен и готов к работе. Нажмите &quot;Создать бота&quot; для завершения.
                  </Typography>
                </Alert>

                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>💡 Рекомендации:</strong>
                    <br />• Проверьте все настройки перед созданием
                    <br />• После создания протестируйте бота
                    <br />• Вы можете изменить настройки в любое время
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'basic': return renderBasicStep();
      case 'template': return renderTemplateStep();
      case 'customization': return renderCustomizationStep();
      case 'responses': return renderResponsesStep();
      case 'payment': return renderPaymentStep();
      case 'notifications': return renderNotificationsStep();
      case 'preview': return renderPreviewStep();
      default: return null;
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { minHeight: '80vh' } }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <BotIcon />
          {editBot ? 'Редактирование бота' : 'Конструктор Telegram бота'}
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box display="flex" gap={3}>
          {/* Progress Steps */}
          <Box width={280} flexShrink={0}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Шаги создания
                </Typography>

                <List dense>
                  {STEPS.map((step, index) => (
                    <ListItem
                      key={step.id}
                      button
                      selected={currentStep === index}
                      onClick={() => index <= currentStep && setCurrentStep(index)}
                      disabled={index > currentStep}
                    >
                      <ListItemIcon>
                        {step.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={step.label}
                        primaryTypographyProps={{
                          color: currentStep === index ? 'primary' : 'text.primary',
                          fontWeight: currentStep === index ? 600 : 400
                        }}
                      />
                      {index < currentStep && (
                        <ListItemSecondaryAction>
                          <CheckIcon color="success" />
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  ))}
                </List>

                <LinearProgress
                  variant="determinate"
                  value={(currentStep + 1) / STEPS.length * 100}
                  sx={{ mt: 2 }}
                />
              </CardContent>
            </Card>
          </Box>

          {/* Step Content */}
          <Box flex={1}>
            <Card sx={{ minHeight: 500 }}>
              <CardContent sx={{ p: 4 }}>
                {renderStepContent()}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={loading}>
          Отмена
        </Button>

        {!isFirstStep && (
          <Button onClick={handleBack} disabled={loading}>
            Назад
          </Button>
        )}

        {!isLastStep ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading}
          >
            Далее
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleCreateBot}
            disabled={loading || Object.keys(validationErrors).length > 0}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Создание...' : editBot ? 'Сохранить изменения' : 'Создать бота'}
          </Button>
        )}
      </DialogActions>

      <StoreDialog
        open={showStoreDialog}
        onClose={() => setShowStoreDialog(false)}
        onSuccess={() => {
          setShowStoreDialog(false);
          onBotCreated(); // Reload stores
        }}
      />
    </Dialog>
  );
};

export default BotConstructor;
