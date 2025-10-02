import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Switch,
  Checkbox,
  Typography,
  Box,
  Chip,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
  Divider,
  Card,
  CardContent,
} from '@mui/material'
import {
  NotificationsActive,
  Email,
  Telegram,
  PhoneAndroid,
  Computer,
  Science,
} from '@mui/icons-material'
import { apiClient, unwrap } from '../../services/apiClient'
import { toast } from 'react-toastify'

const CHANNEL_KEYS = ['EMAIL', 'TELEGRAM', 'PUSH', 'SOCKET'] as const

type ChannelKey = typeof CHANNEL_KEYS[number]

type ChannelSettings = Record<Lowercase<ChannelKey>, { enabled: boolean; types: string[] }>

type NotificationSettings = ChannelSettings

interface NotificationSettingsResponse {
  settings: NotificationSettings
  availableTypes: string[]
  availableChannels: string[]
}

interface TestNotificationPayload {
  type: string
  channels: string[]
  priority: string
}

interface NotificationSettingsProps {
  open: boolean
  onClose: () => void
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ open, onClose }) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<ChannelKey | null>(null)
  const [settings, setSettings] = useState<NotificationSettings>({
    email: { enabled: false, types: [] },
    telegram: { enabled: false, types: [] },
    push: { enabled: false, types: [] },
    socket: { enabled: false, types: [] },
  })
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState(0)

  const notificationTypeLabels: Record<string, string> = {
    ORDER_CREATED: 'Новый заказ',
    ORDER_PAID: 'Заказ оплачен',
    ORDER_REJECTED: 'Заказ отклонен',
    LOW_STOCK: 'Мало товара',
    OUT_OF_STOCK: 'Товар закончился',
    SYSTEM_ERROR: 'Системная ошибка',
    ADMIN_LOGIN: 'Вход администратора',
    BULK_OPERATION: 'Массовые операции',
    STORE_CREATED: 'Магазин создан',
    USER_REGISTERED: 'Пользователь зарегистрировался',
  }

  const channelLabels: Record<ChannelKey, { label: string; icon: React.ReactNode; description: string }> = {
    EMAIL: {
      label: 'Email',
      icon: <Email />,
      description: 'Уведомления на электронную почту',
    },
    TELEGRAM: {
      label: 'Telegram',
      icon: <Telegram />,
      description: 'Уведомления в Telegram бот',
    },
    PUSH: {
      label: 'Push',
      icon: <PhoneAndroid />,
      description: 'Push-уведомления в браузере',
    },
    SOCKET: {
      label: 'Real-time',
      icon: <Computer />,
      description: 'Мгновенные уведомления в панели',
    },
  }

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = unwrap<NotificationSettingsResponse>(await apiClient.get('/notifications/settings'))
      setSettings(response.settings)
      setAvailableTypes(response.availableTypes)
      setAvailableChannels(response.availableChannels)
    } catch (error) {
      toast.error('Ошибка при загрузке настроек уведомлений')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void loadSettings()
    }
  }, [loadSettings, open])

  const saveSettings = async () => {
    setSaving(true)
    try {
      await apiClient.put('/notifications/settings', { settings })
      toast.success('Настройки уведомлений сохранены')
      onClose()
    } catch (error) {
      toast.error('Ошибка при сохранении настроек')
    } finally {
      setSaving(false)
    }
  }

  const sendTestNotification = async (channel: ChannelKey) => {
    setTesting(channel)
    try {
      const payload: TestNotificationPayload = {
        type: 'SYSTEM_ERROR',
        channels: [channel],
        priority: 'LOW',
      }

      const result = unwrap<{ success: boolean }>(await apiClient.post('/notifications/test', payload))

      if (result.success) {
        toast.success(`Тестовое уведомление отправлено через ${channelLabels[channel].label}`)
      } else {
        toast.warn('Не удалось отправить тестовое уведомление')
      }
    } catch (error) {
      toast.error('Ошибка при отправке тестового уведомления')
    } finally {
      setTesting(null)
    }
  }

  const handleChannelToggle = (channel: ChannelKey, enabled: boolean) => {
    const key = channel.toLowerCase() as keyof NotificationSettings
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled,
      },
    }))
  }

  const handleTypeToggle = (channel: ChannelKey, type: string, enabled: boolean) => {
    const channelKey = channel.toLowerCase() as keyof NotificationSettings
    setSettings(prev => {
      const currentTypes = prev[channelKey].types
      const newTypes = enabled
        ? [...currentTypes, type]
        : currentTypes.filter(t => t !== type)

      return {
        ...prev,
        [channelKey]: {
          ...prev[channelKey],
          types: newTypes,
        },
      }
    })
  }

  const getCurrentChannel = () => CHANNEL_KEYS[activeTab]

  const getCurrentSettings = () => {
    const channel = getCurrentChannel()
    return settings[channel.toLowerCase() as keyof NotificationSettings]
  }

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <NotificationsActive />
          Настройки уведомлений
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box mb={2}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            {CHANNEL_KEYS.map((channel, index) => (
              <Tab
                key={channel}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    {channelLabels[channel].icon}
                    {channelLabels[channel].label}
                  </Box>
                }
                id={`channel-tab-${index}`}
                aria-controls={`channel-panel-${index}`}
              />
            ))}
          </Tabs>
        </Box>

        <Card>
          <CardContent>
            {(() => {
              const channel = getCurrentChannel()
              const channelSettings = getCurrentSettings()
              const channelInfo = channelLabels[channel]

              return (
                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {channelInfo.label} уведомления
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {channelInfo.description}
                      </Typography>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={channelSettings.enabled}
                          onChange={(e) => handleChannelToggle(channel, e.target.checked)}
                        />
                      }
                      label="Включить"
                    />
                  </Box>

                  {channelSettings.enabled && (
                    <Box>
                      <Divider sx={{ mb: 2 }} />
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="subtitle1">
                          Типы уведомлений
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={testing === channel ? <CircularProgress size={16} /> : <Science />}
                          onClick={() => sendTestNotification(channel)}
                          disabled={testing === channel}
                        >
                          Тест
                        </Button>
                      </Box>

                      <FormGroup>
                        {availableTypes.map(type => (
                          <FormControlLabel
                            key={type}
                            control={
                              <Checkbox
                                checked={getCurrentSettings().types.includes(type)}
                                onChange={(_, checked) => handleTypeToggle(getCurrentChannel(), type, checked)}
                              />
                            }
                            label={
                              <Box display="flex" alignItems="center" gap={1}>
                                {notificationTypeLabels[type] || type}
                                {type === 'SYSTEM_ERROR' && (
                                  <Chip label="Критично" color="error" size="small" />
                                )}
                                {type === 'ORDER_CREATED' && (
                                  <Chip label="Высокий" color="warning" size="small" />
                                )}
                              </Box>
                            }
                          />
                        ))}
                      </FormGroup>
                    </Box>
                  )}

                  {!channelSettings.enabled && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      {channel === 'EMAIL' && 'Для получения email уведомлений укажите адрес электронной почты в профиле.'}
                      {channel === 'TELEGRAM' && 'Уведомления будут отправляться в ваш Telegram.'}
                      {channel === 'PUSH' && 'Требуется разрешение на показ уведомлений в браузере.'}
                      {channel === 'SOCKET' && 'Real-time уведомления показываются прямо в админ панели.'}
                    </Alert>
                  )}
                </Box>
              )
            })()}
          </CardContent>
        </Card>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Отмена
        </Button>
        <Button onClick={saveSettings} variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={16} /> : 'Сохранить'}
        </Button>
        <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
        <Button
          onClick={() => sendTestNotification(getCurrentChannel())}
          variant="outlined"
          disabled={saving || Boolean(testing)}
        >
          {testing === getCurrentChannel() ? <CircularProgress size={16} /> : 'Отправить тест'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default NotificationSettings