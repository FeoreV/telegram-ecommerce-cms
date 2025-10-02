import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Badge,
} from '@mui/material'
import {
  Notifications,
  VolumeUp,
  VolumeOff,
  PlayArrow,
  Settings,
  PriorityHigh,
  Schedule,
  Close,
  NotificationImportant,
  Info,
  Warning,
  Error,
} from '@mui/icons-material'
import { toast } from 'react-toastify'

interface NotificationRule {
  id: string
  name: string
  description: string
  eventType: 'new_order' | 'payment_confirmed' | 'order_rejected' | 'order_shipped' | 'order_delivered' | 'high_value_order' | 'urgent_order'
  enabled: boolean
  soundEnabled: boolean
  soundFile: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  conditions: {
    minAmount?: number
    storeIds?: string[]
    timeRestriction?: {
      start: string
      end: string
    }
  }
  actions: {
    showToast: boolean
    playSound: boolean
    showBadge: boolean
    browserNotification: boolean
  }
}

interface OrderNotificationSettingsProps {
  open: boolean
  onClose: () => void
}

const OrderNotificationSettings: React.FC<OrderNotificationSettingsProps> = ({
  open,
  onClose,
}) => {
  const defaultSettings = {
    globalEnabled: true,
    masterVolume: 70,
    doNotDisturbEnabled: false,
    doNotDisturbStart: '22:00',
    doNotDisturbEnd: '08:00',
    browserNotificationsEnabled: false,
  }

  const [settings, setSettings] = useState(defaultSettings)

  const defaultRules: NotificationRule[] = [
    {
      id: '1',
      name: 'Новый заказ',
      description: 'Уведомление о каждом новом заказе',
      eventType: 'new_order',
      enabled: true,
      soundEnabled: true,
      soundFile: 'new-order.mp3',
      priority: 'medium',
      conditions: {},
      actions: {
        showToast: true,
        playSound: true,
        showBadge: true,
        browserNotification: true,
      }
    },
    {
      id: '2',
      name: 'Крупный заказ',
      description: 'Заказы на сумму свыше 10,000 ₽',
      eventType: 'high_value_order',
      enabled: true,
      soundEnabled: true,
      soundFile: 'high-value.mp3',
      priority: 'high',
      conditions: {
        minAmount: 10000
      },
      actions: {
        showToast: true,
        playSound: true,
        showBadge: true,
        browserNotification: true,
      }
    },
    {
      id: '3',
      name: 'Срочный заказ',
      description: 'Заказы, требующие быстрой обработки',
      eventType: 'urgent_order',
      enabled: true,
      soundEnabled: true,
      soundFile: 'urgent.mp3',
      priority: 'urgent',
      conditions: {},
      actions: {
        showToast: true,
        playSound: true,
        showBadge: true,
        browserNotification: true,
      }
    },
    {
      id: '4',
      name: 'Оплата подтверждена',
      description: 'Уведомление при подтверждении оплаты',
      eventType: 'payment_confirmed',
      enabled: true,
      soundEnabled: false,
      soundFile: 'payment.mp3',
      priority: 'low',
      conditions: {},
      actions: {
        showToast: true,
        playSound: false,
        showBadge: false,
        browserNotification: false,
      }
    },
    {
      id: '5',
      name: 'Заказ отклонен',
      description: 'Уведомление при отклонении заказа',
      eventType: 'order_rejected',
      enabled: true,
      soundEnabled: true,
      soundFile: 'rejected.mp3',
      priority: 'medium',
      conditions: {},
      actions: {
        showToast: true,
        playSound: true,
        showBadge: true,
        browserNotification: false,
      }
    }
  ]

  const [rules, setRules] = useState<NotificationRule[]>(defaultRules)

  useEffect(() => {
    if (!open) {
      return
    }

    try {
      const savedSettings = localStorage.getItem('notificationSettings')
      const parsedSettings = savedSettings ? JSON.parse(savedSettings) : null
      if (parsedSettings) {
        setSettings({ ...defaultSettings, ...parsedSettings })
      }
    } catch (error) {
      console.error('Failed to parse notification settings from storage:', error)
      setSettings(defaultSettings)
    }

    try {
      const savedRules = localStorage.getItem('notificationRules')
      const parsedRules = savedRules ? JSON.parse(savedRules) : null
      if (parsedRules && Array.isArray(parsedRules)) {
        setRules(parsedRules)
        return
      }
    } catch (error) {
      console.error('Failed to parse notification rules from storage:', error)
    }

    setRules(defaultRules)
  }, [defaultRules, defaultSettings, open])

  const handleSave = () => {
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(settings))
      localStorage.setItem('notificationRules', JSON.stringify(rules))
      toast.success('Настройки уведомлений сохранены')
      onClose()
    } catch (error) {
      console.error('Failed to persist notification settings:', error)
      toast.error('Не удалось сохранить настройки уведомлений')
    }
  }

  const handleRuleToggle = (ruleId: string, field: keyof NotificationRule, value: boolean) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId 
        ? { ...rule, [field]: value }
        : rule
    ))
  }

  const handleRuleActionToggle = (ruleId: string, action: keyof NotificationRule['actions'], value: boolean) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId 
        ? { ...rule, actions: { ...rule.actions, [action]: value } }
        : rule
    ))
  }

  const testSound = (soundFile: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Тестовое уведомление')
      utterance.rate = 2
      utterance.pitch = 1.5
      utterance.volume = settings.masterVolume / 100
      speechSynthesis.cancel()
      speechSynthesis.speak(utterance)
      return
    }

    toast.info(`Тест звука: ${soundFile}`)
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <Error color="error" />
      case 'high': return <Warning color="warning" />
      case 'medium': return <Info color="info" />
      default: return <NotificationImportant />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error'
      case 'high': return 'warning'
      case 'medium': return 'info'
      default: return 'default'
    }
  }

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setSettings(prev => ({ ...prev, browserNotificationsEnabled: true }))
        toast.success('Разрешения на уведомления получены')
      } else {
        toast.error('Разрешения на уведомления отклонены')
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle display="flex" alignItems="center" gap={1}>
        <Notifications />
        Настройки уведомлений о заказах
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Global Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <Settings />
            Общие настройки
          </Typography>

          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography>Включить уведомления</Typography>
            <Switch
              checked={settings.globalEnabled}
              onChange={(e) => setSettings(prev => ({ ...prev, globalEnabled: e.target.checked }))}
            />
          </Box>

          <Box mb={3}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography>Громкость звуков</Typography>
              <Chip label={`${settings.masterVolume}%`} size="small" />
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <VolumeOff />
              <Slider
                value={settings.masterVolume}
                onChange={(e, value) => setSettings(prev => ({ ...prev, masterVolume: value as number }))}
                disabled={!settings.globalEnabled}
                sx={{ flex: 1 }}
              />
              <VolumeUp />
            </Box>
          </Box>

          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box>
              <Typography>Режим "Не беспокоить"</Typography>
              <Typography variant="body2" color="text.secondary">
                {settings.doNotDisturbStart} - {settings.doNotDisturbEnd}
              </Typography>
            </Box>
            <Switch
              checked={settings.doNotDisturbEnabled}
              onChange={(e) => setSettings(prev => ({ ...prev, doNotDisturbEnabled: e.target.checked }))}
            />
          </Box>

          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography>Браузерные уведомления</Typography>
              <Typography variant="body2" color="text.secondary">
                Показывать уведомления даже при свернутом окне
              </Typography>
            </Box>
            {settings.browserNotificationsEnabled ? (
              <Chip label="Активно" color="success" />
            ) : (
              <Button
                size="small"
                variant="outlined"
                onClick={requestBrowserPermission}
              >
                Разрешить
              </Button>
            )}
          </Box>
        </Paper>

        {/* Notification Rules */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <PriorityHigh />
            Правила уведомлений
          </Typography>

          <List>
            {rules.map((rule, index) => (
              <React.Fragment key={rule.id}>
                <ListItem sx={{ alignItems: 'flex-start', px: 0 }}>
                  <Box display="flex" alignItems="flex-start" gap={2} width="100%">
                    <Avatar sx={{ mt: 1 }}>
                      {getPriorityIcon(rule.priority)}
                    </Avatar>
                    
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {rule.name}
                        </Typography>
                        <Chip
                          label={rule.priority.toUpperCase()}
                          color={getPriorityColor(rule.priority) as any}
                          size="small"
                        />
                        {rule.enabled && (
                          <Badge color="success" variant="dot" />
                        )}
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {rule.description}
                      </Typography>

                      <Box display="flex" flexWrap="wrap" gap={2}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={rule.enabled}
                              onChange={(e) => handleRuleToggle(rule.id, 'enabled', e.target.checked)}
                              size="small"
                            />
                          }
                          label="Включено"
                        />

                        <FormControlLabel
                          control={
                            <Switch
                              checked={rule.actions.showToast}
                              onChange={(e) => handleRuleActionToggle(rule.id, 'showToast', e.target.checked)}
                              size="small"
                              disabled={!rule.enabled}
                            />
                          }
                          label="Тост"
                        />

                        <FormControlLabel
                          control={
                            <Switch
                              checked={rule.actions.playSound}
                              onChange={(e) => handleRuleActionToggle(rule.id, 'playSound', e.target.checked)}
                              size="small"
                              disabled={!rule.enabled}
                            />
                          }
                          label="Звук"
                        />

                        <FormControlLabel
                          control={
                            <Switch
                              checked={rule.actions.showBadge}
                              onChange={(e) => handleRuleActionToggle(rule.id, 'showBadge', e.target.checked)}
                              size="small"
                              disabled={!rule.enabled}
                            />
                          }
                          label="Значок"
                        />

                        {rule.actions.playSound && (
                          <Tooltip title="Тест звука">
                            <IconButton
                              size="small"
                              onClick={() => testSound(rule.soundFile)}
                              disabled={!settings.globalEnabled}
                            >
                              <PlayArrow />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </ListItem>
                {index < rules.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>

        <Alert severity="info" sx={{ mt: 2 }}>
          Настройки уведомлений сохраняются локально в браузере. При работе с несколькими устройствами настройте каждое отдельно.
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Отмена
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<Settings />}
        >
          Сохранить настройки
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default OrderNotificationSettings
