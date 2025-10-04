import {
    CheckCircle as ActiveIcon,
    Add as AddIcon,
    SmartToy as BotIcon,
    Build as ConstructorIcon,
    Delete as DeleteIcon,
    Error as ErrorIcon,
    Cancel as InactiveIcon,
    RestartAlt as RestartIcon,
    Settings as SettingsIcon,
    Timeline as StatsIcon,
    Store as StoreIcon,
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Fab,
    Grid,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { apiClient } from '../../services/apiClient';
import { Store } from '../../types';
import StoreDialog from '../stores/StoreDialog';
import BotConstructor, { BotSettings } from './BotConstructor';

interface Bot {
  storeId: string;
  storeName: string;
  storeSlug: string;
  botUsername?: string;
  botStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  botCreatedAt?: string;
  botLastActive?: string;
  botSettings?: BotSettings;
  hasToken: boolean;
  isActive: boolean;
  messageCount: number;
  lastActivity?: string;
  orderCount: number;
  productCount: number;
}

interface BotStats {
  totalBots: number;
  activeBots: number;
  inactiveBots: number;
  suspendedBots: number;
  totalMessages: number;
}

interface CreateBotDialogProps {
  open: boolean;
  onClose: () => void;
  stores: Array<{ id: string; name: string; hasBot: boolean }>;
  onBotCreated: () => void;
}

const CreateBotDialog: React.FC<CreateBotDialogProps> = ({
  open,
  onClose,
  stores,
  onBotCreated
}) => {
  const [storeId, setStoreId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showStoreDialog, setShowStoreDialog] = useState(false);

  // Validation functions
  const isValidBotToken = (token: string): boolean => {
    const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
    return tokenPattern.test(token.trim());
  };

  const isValidBotUsername = (username: string): boolean => {
    const usernamePattern = /^[a-zA-Z][a-zA-Z0-9_]*bot$/i;
    return usernamePattern.test(username.trim());
  };

  const handleSubmit = async () => {
    if (!storeId || !botToken) {
      setError('Выберите магазин и введите токен бота');
      return;
    }

    // Validate bot token
    if (!isValidBotToken(botToken)) {
      setError('Неверный формат токена. Токен должен иметь формат: цифры:буквы_символы');
      return;
    }

    // Validate bot username if provided
    if (botUsername && !isValidBotUsername(botUsername)) {
      setError('Неверный формат имени пользователя. Имя должно заканчиваться на "bot"');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/bots', {
        storeId,
        botToken,
        botUsername: botUsername || undefined,
      });

      if (response.data.success) {
        onBotCreated();
        onClose();
        setStoreId('');
        setBotToken('');
        setBotUsername('');
      }
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Ошибка создания бота';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const availableStores = stores.filter(store => !store.hasBot);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <BotIcon />
          Создать нового бота
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box mt={2} display="flex" flexDirection="column" gap={3}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>📖 Пошаговая инструкция создания бота:</strong>
              <br />
              <br />
              <strong>1. Откройте @BotFather в Telegram</strong>
              <br />
              • Найдите официального @BotFather в Telegram
              <br />
              • Этот бот управляет всеми ботами в Telegram
              <br />
              <br />
              <strong>2. Создайте нового бота</strong>
              <br />
              • Отправьте команду: <code>/newbot</code>
              <br />
              • Введите имя для вашего бота (например: &quot;Мой Магазин&quot;)
              <br />
              • Введите username для вашего бота (например: &quot;MyStoreBot&quot;)
              <br />
              • Загрузите изображение для вашего бота (по желанию)
              <br />
              • Отключите режим приватности (privacy mode) для бота. Для этого отправьте команду: <code>/setprivacy</code>
              <br />
              • Выберите вашего бота
              <br />
              • Выберите &quot;Disable&quot;
              <br />
              <br />
              <strong>3. Получите токен</strong>
              <br />
              • @BotFather отправит вам токен доступа
              <br />
              • Токен выглядит как: <code>1234567890:ABCdefGhIJKLmnopQRstUVwxyz</code>
              <br />
              • ⚠️ Никому не сообщайте этот токен!
              <br />
              <br />
              <strong>4. Вставьте токен в поле ниже</strong>
              <br />
              • Скопируйте весь токен целиком
              <br />
              • Вставьте его в поле &quot;Токен бота&quot;
              <br />
              • Нажмите &quot;Создать бота&quot;
            </Typography>
          </Alert>

          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>✅ После создания бота:</strong>
              <br />
              • Бот автоматически подключится к вашему магазину
              <br />
              • Клиенты смогут просматривать товары и делать заказы
              <br />
              • Вы будете получать уведомления о новых заказах
              <br />
              • Можете настроить автоответы и приветственные сообщения
            </Typography>
          </Alert>

          <TextField
            select
            label="Выберите магазин"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            SelectProps={{ native: true }}
            fullWidth
            required
          >
            <option value="">-- Выберите магазин --</option>
            {availableStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </TextField>

          {availableStores.length === 0 && (
            <Alert severity="warning"
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
              У всех ваших магазинов уже есть боты. Создайте новый магазин или удалите существующего бота.
            </Alert>
          )}

          <TextField
            label="Токен бота"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="1234567890:ABCdefGhIJklmNOpqRStuvwXYz"
            fullWidth
            required
            multiline
            rows={2}
            helperText={
              <Box>
                <Typography variant="caption">
                  Токен получите у @BotFather в Telegram
                  <br />
                  <strong>Формат:</strong> цифры:буквы_символы
                  <br />
                  <strong>Пример:</strong> 1234567890:ABCdefGhIJklmNOpqRStuvwXYz
                </Typography>
              </Box>
            }
            error={botToken.length > 0 && !isValidBotToken(botToken)}
            InputProps={{
              style: { fontFamily: 'monospace', fontSize: '0.9rem' }
            }}
          />

          <TextField
            label="Имя пользователя бота (необязательно)"
            value={botUsername}
            onChange={(e) => setBotUsername(e.target.value)}
            placeholder="my_shop_bot"
            fullWidth
            helperText={
              <Box>
                <Typography variant="caption">
                  Если не указано, будет получено автоматически
                  <br />
                  <strong>Требования:</strong> должен заканчиваться на &quot;bot&quot;
                  <br />
                  <strong>Пример:</strong> my_shop_bot, store_bot
                </Typography>
              </Box>
            }
            error={botUsername.length > 0 && !isValidBotUsername(botUsername)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Отмена
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            loading ||
            !storeId ||
            !botToken ||
            !isValidBotToken(botToken) ||
            (botUsername && !isValidBotUsername(botUsername))
          }
        >
          {loading ? <CircularProgress size={20} /> : 'Создать бота'}
        </Button>
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

const BotManagement: React.FC = () => {
  const [bots, setBots] = useState<Bot[]>([]);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [stores, setStores] = useState<Array<{ id: string; name: string; hasBot: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [constructorOpen, setConstructorOpen] = useState(false);
  const [editBot, setEditBot] = useState<{ storeId: string; settings: BotSettings } | null>(null);
  const { socket } = useSocket();

  const loadBots = async () => {
    try {
      setLoading(true);
      const [botsResponse, storesResponse] = await Promise.all([
        apiClient.get('/bots'),
        apiClient.get('/stores')
      ]);

      if (botsResponse.data.success) {
        setBots(botsResponse.data.bots || []);
        setStats(botsResponse.data.stats || null);
      }

      if (storesResponse.data.items) {
        const storeList = storesResponse.data.items.map((store: Store) => ({
          id: store.id,
          name: store.name,
          hasBot: botsResponse.data.bots?.some((bot: Bot) => bot.storeId === store.id && bot.hasToken) || false
        }));
        setStores(storeList);
      }
    } catch (error: unknown) {
      console.error('Error loading bots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBot = async (storeId: string, storeName: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить бота для магазина "${storeName}"?`)) {
      return;
    }

    try {
      const response = await apiClient.delete(`/bots/${storeId}`);
      if (response.data.success) {
        alert(response.data.message || 'Бот успешно удален');
        await loadBots();
      }
    } catch (error: unknown) {
      const errorMessage = (error as any).response?.data?.message || 'Ошибка при удалении бота';
      alert(`Ошибка: ${errorMessage}`);
      console.error('Error removing bot:', error);
    }
  };

  const handleRestartBot = async (storeId: string, storeName: string) => {
    if (!window.confirm(`Перезапустить бота для магазина "${storeName}"?`)) {
      return;
    }

    try {
      const response = await apiClient.post(`/bots/${storeId}/restart`);
      if (response.data.success) {
        await loadBots();
      }
    } catch (error: unknown) {
      console.error('Error restarting bot:', error);
    }
  };

  const handleEditBot = async (storeId: string) => {
    try {
      // Получаем настройки бота
      const response = await apiClient.get(`/bots/${storeId}/settings`);
      if (response.data.success) {
        setEditBot({
          storeId: storeId,
          settings: response.data.settings
        });
        setConstructorOpen(true);
      }
    } catch (error: unknown) {
      console.error('Error loading bot settings:', error);
      // Если не удается загрузить настройки, открываем конструктор с базовыми настройками
      setEditBot({
        storeId: storeId,
        settings: {
          welcomeMessage: 'Welcome!',
          language: 'ru',
          currency: 'USD',
          timezone: 'Europe/Moscow',
          theme: 'light' as const,
          primaryColor: '#1976d2',
          accentColor: '#dc004e',
          catalogStyle: 'grid' as const,
          showPrices: true,
          showStock: true,
          enableSearch: true,
          categoriesPerPage: 10,
          productsPerPage: 10,
          autoResponses: { enabled: false, responses: [] },
          notifications: {
            newOrder: true,
            lowStock: true,
            paymentConfirmation: true,
            orderStatusUpdate: true,
            customNotifications: []
          },
          paymentMethods: [],
          paymentInstructions: '',
          enableAnalytics: false,
          enableReferralSystem: false,
          enableReviews: false,
          customCommands: []
        }
      });
      setConstructorOpen(true);
    }
  };

  const getStatusIcon = (status: string, isActive: boolean) => {
    if (!isActive && status !== 'INACTIVE') return <ErrorIcon color="error" />;

    switch (status) {
      case 'ACTIVE':
        return isActive ? <ActiveIcon color="success" /> : <InactiveIcon color="warning" />;
      case 'INACTIVE':
        return <InactiveIcon color="disabled" />;
      case 'SUSPENDED':
        return <ErrorIcon color="error" />;
      default:
        return <InactiveIcon color="disabled" />;
    }
  };

  const getStatusText = (status: string, isActive: boolean) => {
    if (!isActive && status !== 'INACTIVE') return 'Ошибка подключения';

    switch (status) {
      case 'ACTIVE':
        return isActive ? 'Активен' : 'Неактивен';
      case 'INACTIVE':
        return 'Неактивен';
      case 'SUSPENDED':
        return 'Приостановлен';
      default:
        return 'Неизвестно';
    }
  };

  const formatLastActivity = (lastActivity?: string) => {
    if (!lastActivity) return 'Никогда';
    const date = new Date(lastActivity);
    return date.toLocaleString('ru-RU');
  };

  useEffect(() => {
    loadBots();
  }, []);

  // Listen for bot-related socket events
  useEffect(() => {
    if (socket) {
      const handleBotNotification = (data: { type: string }) => {
        if (data.type?.includes('BOT_')) {
          loadBots(); // Refresh bots when bot-related events occur
        }
      };

      socket.on('notification', handleBotNotification);

      return () => {
        socket.off('notification', handleBotNotification);
      };
    }
  }, [socket, loadBots]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Управление ботами
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Быстрое создание
          </Button>
          <Button
            variant="contained"
            startIcon={<ConstructorIcon />}
            onClick={() => setConstructorOpen(true)}
          >
            Конструктор бота
          </Button>
        </Box>
      </Box>

      {stats && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography color="textSecondary" gutterBottom>
                    Всего ботов
                  </Typography>
                  <BotIcon color="primary" />
                </Box>
                <Typography variant="h4">
                  {stats.totalBots}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography color="textSecondary" gutterBottom>
                    Активных
                  </Typography>
                  <ActiveIcon color="success" />
                </Box>
                <Typography variant="h4" color="success.main">
                  {stats.activeBots}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography color="textSecondary" gutterBottom>
                    Неактивных
                  </Typography>
                  <InactiveIcon color="warning" />
                </Box>
                <Typography variant="h4" color="warning.main">
                  {stats.inactiveBots}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography color="textSecondary" gutterBottom>
                    Всего сообщений
                  </Typography>
                  <StatsIcon color="info" />
                </Box>
                <Typography variant="h4" color="info.main">
                  {stats.totalMessages.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Список ботов
          </Typography>

          {bots.length === 0 ? (
            <Box textAlign="center" py={4}>
              <BotIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                У вас пока нет ботов
              </Typography>
              <Typography variant="body2" color="textSecondary" mb={3}>
                Создайте первого бота для одного из ваших магазинов
              </Typography>
              <Box display="flex" gap={2} justifyContent="center">
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateDialogOpen(true)}
                  disabled={stores.length === 0}
                >
                  Быстрое создание
                </Button>
                <Button
                  variant="contained"
                  startIcon={<ConstructorIcon />}
                  onClick={() => setConstructorOpen(true)}
                  disabled={stores.length === 0}
                >
                  Конструктор бота
                </Button>
              </Box>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Магазин</TableCell>
                    <TableCell>Бот</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Активность</TableCell>
                    <TableCell>Статистика</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bots.map((bot) => (
                    <TableRow key={bot.storeId}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <StoreIcon color="primary" />
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {bot.storeName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              /{bot.storeSlug}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {bot.botUsername ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <BotIcon />
                            <Typography>@{bot.botUsername}</Typography>
                          </Box>
                        ) : (
                          <Typography color="textSecondary">
                            Не настроен
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getStatusIcon(bot.botStatus, bot.isActive)}
                          <Typography>
                            {getStatusText(bot.botStatus, bot.isActive)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatLastActivity(bot.lastActivity)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {bot.messageCount} сообщений
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          📦 {bot.productCount} товаров
                        </Typography>
                        <Typography variant="body2">
                          🛒 {bot.orderCount} заказов
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          {bot.hasToken && (
                            <Tooltip title="Перезапустить бота">
                              <IconButton
                                size="small"
                                onClick={() => handleRestartBot(bot.storeId, bot.storeName)}
                                disabled={!bot.isActive}
                              >
                                <RestartIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Настройки бота">
                            <IconButton
                              size="small"
                              onClick={() => handleEditBot(bot.storeId)}
                            >
                              <SettingsIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить бота">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveBot(bot.storeId, bot.storeName)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <CreateBotDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        stores={stores}
        onBotCreated={loadBots}
      />

      <BotConstructor
        open={constructorOpen}
        onClose={() => {
          setConstructorOpen(false);
          setEditBot(null);
        }}
        stores={stores}
        onBotCreated={loadBots}
        editBot={editBot}
      />

      {/* Floating Action Button for quick access */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
        onClick={() => setConstructorOpen(true)}
      >
        <ConstructorIcon />
      </Fab>
    </Box>
  );
};

export default BotManagement;
