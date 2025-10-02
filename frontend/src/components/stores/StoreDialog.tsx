import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  Chip,
  Checkbox,
  FormControlLabel,
  Divider,
  Collapse,
  CircularProgress,
  InputAdornment,
} from '@mui/material'
import { ExpandMore, CheckCircle, Error, SmartToy } from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { Store } from '../../types'
import { storeService, CreateStoreRequest, UpdateStoreRequest } from '../../services/storeService'
import { apiClient } from '../../services/apiClient'
import { toast } from 'react-toastify'
import BotPreviewCard from './BotPreviewCard'

const currencies = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'RUB', label: 'RUB (₽)' },
  { value: 'UAH', label: 'UAH (₴)' },
]

const schema = yup.object({
  name: yup.string().required('Название обязательно').min(2, 'Минимум 2 символа'),
  slug: yup
    .string()
    .required('Slug обязателен')
    .matches(/^[a-z0-9-]+$/, 'Только строчные буквы, цифры и дефисы')
    .min(2, 'Минимум 2 символа'),
  description: yup.string().required('Описание обязательно').min(1, 'Описание не может быть пустым'),
  status: yup.string().oneOf(['ACTIVE', 'INACTIVE', 'SUSPENDED'], 'Недопустимый статус').optional(),
  currency: yup
    .string()
    .required('Валюта обязательна')
    .oneOf(['USD', 'EUR', 'RUB', 'UAH'], 'Недопустимая валюта'),
  domain: yup.string().optional(),
  contactInfo: yup.object().shape({
    phone: yup.string().optional(),
    email: yup.string().email('Неверный формат email').optional(),
    address: yup.string().optional(),
  }).optional(),
  settings: yup.object().shape({
    paymentInstructions: yup.string().optional(),
    termsOfService: yup.string().optional(),
  }).optional(),
  createBot: yup.boolean().optional(),
  botToken: yup.string().when('createBot', {
    is: true,
    then: (schema) => schema.required('Токен бота обязателен').matches(
      /^\d+:[A-Za-z0-9_-]+$/,
      'Неверный формат токена'
    ),
    otherwise: (schema) => schema.optional()
  }),
  botUsername: yup.string().when('createBot', {
    is: true,
    then: (schema) => schema.optional().matches(
      /^[a-zA-Z][a-zA-Z0-9_]*bot$/i,
      'Имя должно заканчиваться на "bot"'
    ),
    otherwise: (schema) => schema.optional()
  }),
})

const transliterationMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const generateSlug = (value: string) => {
  if (!value) return '';

  const lower = value.toLowerCase();
  const transliterated = lower
    .split('')
    .map((char) => transliterationMap[char] ?? char)
    .join('');

  return transliterated
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
};

type FormData = {
  name: string
  slug: string
  description: string
  status?: string
  currency: string
  domain?: string
  contactInfo?: {
    phone?: string
    email?: string
    address?: string
  }
  settings?: {
    paymentInstructions?: string
    termsOfService?: string
  }
  createBot?: boolean
  botToken?: string
  botUsername?: string
}

interface StoreDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  store?: Store | null
}

const StoreDialog: React.FC<StoreDialogProps> = ({
  open,
  onClose,
  onSuccess,
  store,
}) => {
  const [loading, setLoading] = useState(false)
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [botTokenValidating, setBotTokenValidating] = useState(false)
  const [botTokenValid, setBotTokenValid] = useState<boolean | null>(null)
  const [botInfo, setBotInfo] = useState<{ username?: string; firstName?: string } | null>(null)
  const isEdit = !!store

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<any>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      status: 'ACTIVE',
      currency: 'USD',
      domain: '',
      contactInfo: {
        phone: '',
        email: '',
        address: '',
      },
      settings: {
        paymentInstructions: '',
        termsOfService: '',
      },
      createBot: false,
      botToken: '',
      botUsername: '',
    },
  })

  const watchedSlug = watch('slug')
  const watchedName = watch('name')
  const watchedCreateBot = watch('createBot')
  const watchedBotToken = watch('botToken')

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEdit && watchedName && !watchedSlug) {
      const generated = generateSlug(watchedName);
      if (generated) {
        setValue('slug', generated, { shouldDirty: true });
      }
    }
  }, [watchedName, isEdit, watchedSlug, setValue]);

  // Check slug availability
  useEffect(() => {
    if (watchedSlug && watchedSlug.length > 1) {
      const checkSlug = async () => {
        setSlugChecking(true)
        try {
          const available = await storeService.checkSlugAvailability(
            watchedSlug,
            isEdit ? store?.id : undefined
          )
          setSlugAvailable(available)
        } catch (error) {
          console.error('Error checking slug:', error)
          setSlugAvailable(null)
        } finally {
          setSlugChecking(false)
        }
      }

      const timeoutId = setTimeout(checkSlug, 500)
      return () => clearTimeout(timeoutId)
    } else {
      setSlugAvailable(null)
    }
  }, [watchedSlug, isEdit, store?.id])

  // Validate bot token in real-time
  useEffect(() => {
    if (watchedCreateBot && watchedBotToken && /^\d+:[A-Za-z0-9_-]+$/.test(watchedBotToken)) {
      const timeoutId = setTimeout(async () => {
        setBotTokenValidating(true)
        setBotTokenValid(null)
        setBotInfo(null)
        
        try {
          // Validate token through Telegram API
          const response = await fetch(`https://api.telegram.org/bot${watchedBotToken}/getMe`)
          const data = await response.json()
          
          if (data.ok && data.result) {
            setBotTokenValid(true)
            setBotInfo({
              username: data.result.username,
              firstName: data.result.first_name
            })
            
            // Auto-fill bot username if not already set
            const currentBotUsername = watch('botUsername')
            if (!currentBotUsername && data.result.username) {
              setValue('botUsername', data.result.username)
            }
          } else {
            setBotTokenValid(false)
            setBotInfo(null)
          }
        } catch (error) {
          console.error('Error validating bot token:', error)
          setBotTokenValid(false)
          setBotInfo(null)
        } finally {
          setBotTokenValidating(false)
        }
      }, 1000)

      return () => clearTimeout(timeoutId)
    } else {
      setBotTokenValid(null)
      setBotInfo(null)
      setBotTokenValidating(false)
    }
  }, [watchedBotToken, watchedCreateBot, setValue, watch])

  // Load store data for editing
  useEffect(() => {
    if (store && open) {
      reset({
        name: store.name,
        slug: store.slug,
        description: store.description || '',
        status: store.status || 'ACTIVE',
        currency: store.currency,
        domain: store.domain || '',
        contactInfo: {
          phone: store.contactInfo?.phone || '',
          email: store.contactInfo?.email || '',
          address: store.contactInfo?.address || '',
        },
        settings: {
          paymentInstructions: store.settings?.paymentInstructions || '',
          termsOfService: store.settings?.termsOfService || '',
        },
      })
    } else if (!store && open) {
      reset({
        name: '',
        slug: '',
        description: '',
        status: 'ACTIVE',
        currency: 'USD',
        domain: '',
        contactInfo: {
          phone: '',
          email: '',
          address: '',
        },
        settings: {
          paymentInstructions: '',
          termsOfService: '',
        },
      })
    }
  }, [store, open, reset])

  const onSubmit = async (data: any) => {
    const normalizedSlug = generateSlug(data.slug);
    if (!normalizedSlug) {
      toast.error('Укажите корректный URL магазина (slug)');
      return;
    }

    if (!slugAvailable && !isEdit) {
      toast.error('Этот URL занят, выберите другой');
      return;
    }

    setLoading(true)
    try {
      if (isEdit && store) {
        const updateData: UpdateStoreRequest = {
          name: data.name,
          description: data.description,
          status: data.status,
          currency: (data.currency || 'USD').toUpperCase(),
          domain: data.domain,
          contactInfo: data.contactInfo,
          settings: data.settings,
        }
        // Only include slug if it changed
        if (normalizedSlug !== store.slug) {
          updateData.slug = normalizedSlug
        }
        await storeService.updateStore(store.id, updateData)
        toast.success('Магазин обновлен!')
      } else {
        const createData: CreateStoreRequest = {
          name: data.name,
          slug: normalizedSlug,
          description: data.description,
          status: data.status,
          currency: (data.currency || 'USD').toUpperCase(),
          domain: data.domain,
          contactInfo: data.contactInfo,
          settings: data.settings,
        }
        console.log('Submitting store creation data:', createData)
        const createdStore = await storeService.createStore(createData)

        // Create bot if requested
        if (data.createBot && data.botToken && createdStore?.id) {
          try {
            await apiClient.post('/bots', {
              storeId: createdStore.id,
              botToken: data.botToken,
              botUsername: data.botUsername || undefined,
            })
            toast.success('Магазин и бот успешно созданы!')
          } catch (botError: any) {
            // Store was created, but bot creation failed
            console.error('Bot creation failed:', botError)
            toast.warning(`Магазин создан, но не удалось создать бота: ${botError.response?.data?.message || 'Проверьте токен бота'}`)
          }
        } else {
          toast.success('Магазин создан!')
        }
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при сохранении магазина')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEdit ? 'Редактировать магазин' : 'Создать новый магазин'}
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Название магазина"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message as string}
                    margin="normal"
                    autoFocus
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Статус</InputLabel>
                    <Select {...field} label="Статус">
                      <MenuItem value="ACTIVE">Активный</MenuItem>
                      <MenuItem value="INACTIVE">Неактивный</MenuItem>
                      <MenuItem value="SUSPENDED">Заблокирован</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Валюта</InputLabel>
                    <Select {...field} label="Валюта">
                      {currencies.map((currency) => (
                        <MenuItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="slug"
                control={control}
                render={({ field }) => (
                  <Box>
                    <TextField
                      {...field}
                      label="URL (slug)"
                      fullWidth
                      error={!!errors.slug || slugAvailable === false}
                      helperText={
                        (errors.slug?.message as string) ||
                        (slugChecking && 'Проверка доступности...') ||
                        (slugAvailable === false && 'Этот URL уже занят') ||
                        (slugAvailable === true && 'URL доступен') ||
                        'Используется в URL: your-domain.com/stores/your-slug'
                      }
                      margin="normal"
                      InputProps={{
                        endAdornment: (
                          <Box>
                            {slugChecking && <Chip label="Проверка..." size="small" />}
                            {slugAvailable === true && <Chip label="Доступен" color="success" size="small" />}
                            {slugAvailable === false && <Chip label="Занят" color="error" size="small" />}
                          </Box>
                        ),
                      }}
                    />
                  </Box>
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Описание"
                    fullWidth
                    multiline
                    rows={3}
                    margin="normal"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="domain"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Домен/Поддомен (необязательно)"
                    placeholder="mystore.example.com"
                    fullWidth
                    error={!!errors.domain}
                    helperText={
                      errors.domain?.message as string ||
                      'Кастомный домен для вашего магазина (необязательно)'
                    }
                    margin="normal"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Контактная информация
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="contactInfo.phone"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Телефон"
                    fullWidth
                    margin="normal"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="contactInfo.email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Email"
                    type="email"
                    fullWidth
                    margin="normal"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="contactInfo.address"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Адрес"
                    fullWidth
                    margin="normal"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Настройки
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="settings.paymentInstructions"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Инструкции по оплате"
                    fullWidth
                    multiline
                    rows={3}
                    margin="normal"
                    helperText="Инструкции для покупателей о том, как совершить оплату"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="settings.termsOfService"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Условия использования"
                    fullWidth
                    multiline
                    rows={3}
                    margin="normal"
                  />
                )}
              />
            </Grid>

            {/* Bot Creation Section - Only show for new stores */}
            {!isEdit && (
              <>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    🤖 Telegram бот (необязательно)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Создайте Telegram бота для вашего магазина сразу при создании
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="createBot"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Checkbox {...field} checked={field.value || false} />}
                        label="Создать Telegram бота для этого магазина"
                      />
                    )}
                  />
                </Grid>

                <Collapse in={watchedCreateBot}>
                  <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid item xs={12}>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          <strong>Как получить токен бота:</strong>
                          <br />
                          1. Откройте @BotFather в Telegram
                          <br />
                          2. Отправьте команду /newbot
                          <br />
                          3. Следуйте инструкциям для создания бота
                          <br />
                          4. Скопируйте полученный токен и вставьте ниже
                        </Typography>
                      </Alert>
                    </Grid>

                    <Grid item xs={12}>
                      <Controller
                        name="botToken"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Токен бота"
                            placeholder="1234567890:ABCdefGhIJklmNOpqRStuvwXYz"
                            fullWidth
                            required={watchedCreateBot}
                            error={!!errors.botToken || botTokenValid === false}
                            helperText={
                              errors.botToken?.message as string ||
                              (botTokenValid === false ? "Неверный токен бота" :
                               botTokenValid === true && botInfo ? `Найден бот: @${botInfo.username} (${botInfo.firstName})` :
                               "Токен получите у @BotFather в Telegram")
                            }
                            InputProps={{
                              style: { fontFamily: 'monospace', fontSize: '0.9rem' },
                              endAdornment: watchedCreateBot && watchedBotToken && (
                                <InputAdornment position="end">
                                  {botTokenValidating ? (
                                    <CircularProgress size={20} />
                                  ) : botTokenValid === true ? (
                                    <CheckCircle color="success" />
                                  ) : botTokenValid === false ? (
                                    <Error color="error" />
                                  ) : null}
                                </InputAdornment>
                              )
                            }}
                          />
                        )}
                      />
                      
                      {/* Bot Info Preview */}
                      {botTokenValid === true && botInfo && (
                        <Box sx={{ mt: 1, p: 2, bgcolor: 'success.light', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SmartToy color="success" />
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              Бот найден: @{botInfo.username}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {botInfo.firstName} • Токен валиден
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Bot Preview Card */}
                      <BotPreviewCard 
                        botInfo={botInfo} 
                        isVisible={botTokenValid === true && !!botInfo}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Controller
                        name="botUsername"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Имя пользователя бота (необязательно)"
                            placeholder="my_shop_bot"
                            fullWidth
                            error={!!errors.botUsername}
                            helperText={
                              errors.botUsername?.message as string ||
                              "Если не указано, будет получено автоматически. Должно заканчиваться на 'bot'"
                            }
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Collapse>
              </>
            )}
          </Grid>

          {!isEdit && slugAvailable === false && (
            <Alert severity="error" sx={{ mt: 2 }}>
              URL уже используется. Выберите другой URL для вашего магазина.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              loading || 
              (!isEdit && slugAvailable === false) ||
              (watchedCreateBot && watchedBotToken && botTokenValid !== true)
            }
          >
            {loading ? 'Сохранение...' : isEdit ? 'Обновить' : 'Создать'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default StoreDialog
