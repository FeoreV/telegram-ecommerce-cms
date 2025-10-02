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
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Avatar,
  Divider,
} from '@mui/material'
import {
  Person,
  Telegram,
  Email,
  Phone,
  AdminPanelSettings,
  Store,
  ShoppingCart,
  Business,
} from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { User } from '../../types'
import { userService, CreateUserRequest, UpdateUserRequest } from '../../services/userService'
import { toast } from 'react-toastify'
import { useAuth } from '../../contexts/AuthContext'

const schema = yup.object({
  telegramId: yup.string().required('Telegram ID обязателен'),
  username: yup.string().optional(),
  firstName: yup.string().required('Имя обязательно').min(2, 'Минимум 2 символа'),
  lastName: yup.string().required('Фамилия обязательна').min(2, 'Минимум 2 символа'),
  email: yup.string().email('Неверный формат email').optional(),
  phone: yup.string().optional(),
  role: yup.string().required('Роль обязательна'),
  isActive: yup.boolean().default(true),
})

type UserFormData = {
  telegramId: string
  username?: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  role: 'ADMIN' | 'VENDOR' | 'CUSTOMER'
  isActive: boolean
}

interface UserDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  user?: User | null
}

const UserDialog: React.FC<UserDialogProps> = ({
  open,
  onClose,
  onSuccess,
  user,
}) => {
  const { user: currentUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const isEdit = !!user
  const canManageRoles = currentUser?.role === 'OWNER'

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<any>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      telegramId: '',
      username: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'CUSTOMER',
      isActive: true,
    },
  })

  const watchedRole = watch('role')

  useEffect(() => {
    if (user && open) {
      reset({
        telegramId: user.telegramId,
        username: user.username || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role as 'ADMIN' | 'VENDOR' | 'CUSTOMER',
        isActive: user.isActive,
      })
    } else if (!user && open) {
      reset({
        telegramId: '',
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'CUSTOMER',
        isActive: true,
      })
    }
  }, [user, open, reset])

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      if (isEdit && user) {
        const updateData: UpdateUserRequest = {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          role: data.role,
          isActive: data.isActive,
        }
        await userService.updateUser(user.id, updateData)
        toast.success('Пользователь обновлен!')
      } else {
        const createData: CreateUserRequest = {
          telegramId: data.telegramId,
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          role: data.role,
        }
        await userService.createUser(createData)
        toast.success('Пользователь создан!')
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при сохранении пользователя')
    } finally {
      setLoading(false)
    }
  }

  const getRoleInfo = (role: string) => {
    const roleConfig = {
      OWNER: {
        label: 'Владелец',
        color: 'error' as const,
        icon: <Business />,
        description: 'Полный доступ ко всем функциям системы'
      },
      ADMIN: {
        label: 'Администратор',
        color: 'primary' as const,
        icon: <AdminPanelSettings />,
        description: 'Управление заказами, товарами и пользователями'
      },
      VENDOR: {
        label: 'Продавец',
        color: 'secondary' as const,
        icon: <Store />,
        description: 'Управление товарами и заказами своих магазинов'
      },
      CUSTOMER: {
        label: 'Покупатель',
        color: 'default' as const,
        icon: <ShoppingCart />,
        description: 'Может создавать заказы через Telegram бот'
      },
    }

    return roleConfig[role as keyof typeof roleConfig] || roleConfig.CUSTOMER
  }

  const currentRoleInfo = getRoleInfo(watchedRole)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar
            sx={{
              bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
              color: theme => theme.palette.primary.contrastText,
              border: theme => `1px solid ${theme.palette.primary.main}`,
            }}
          >
            <Person />
          </Avatar>
          <Box>
            <Typography variant="h6">
              {isEdit ? 'Редактировать пользователя' : 'Создать нового пользователя'}
            </Typography>
            {isEdit && (
              <Typography variant="body2" color="text.secondary">
                ID: {user?.id}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Telegram Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary">
                Информация Telegram
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="telegramId"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Telegram ID"
                    fullWidth
                    error={!!errors.telegramId}
                    helperText={(errors.telegramId?.message as string) || 'Уникальный числовой ID пользователя в Telegram'}
                    margin="normal"
                    required
                    disabled={isEdit}
                    InputProps={{
                      startAdornment: <Telegram sx={{ mr: 1, color: 'action.active' }} />,
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="username"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Username Telegram"
                    fullWidth
                    margin="normal"
                    helperText="@username в Telegram (без @)"
                    InputProps={{
                      startAdornment: (
                        <Typography variant="body1" sx={{ mr: 0.5, color: 'action.active' }}>
                          @
                        </Typography>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            {/* Personal Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
                Персональная информация
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Имя"
                    fullWidth
                    error={!!errors.firstName}
                    helperText={errors.firstName?.message as string}
                    margin="normal"
                    required
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Фамилия"
                    fullWidth
                    error={!!errors.lastName}
                    helperText={errors.lastName?.message as string}
                    margin="normal"
                    required
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Email"
                    type="email"
                    fullWidth
                    error={!!errors.email}
                    helperText={errors.email?.message as string}
                    margin="normal"
                    InputProps={{
                      startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />,
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Телефон"
                    fullWidth
                    margin="normal"
                    helperText="Номер телефона для связи"
                    InputProps={{
                      startAdornment: <Phone sx={{ mr: 1, color: 'action.active' }} />,
                    }}
                  />
                )}
              />
            </Grid>

            {/* Role and Status */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
                Роль и статус
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} md={8}>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth margin="normal" error={!!errors.role}>
                    <InputLabel>Роль пользователя *</InputLabel>
                    <Select 
                      {...field} 
                      label="Роль пользователя *"
                      disabled={!canManageRoles || (isEdit && user?.role === 'OWNER')}
                    >
                      <MenuItem value="CUSTOMER">
                        <Box display="flex" alignItems="center" gap={1}>
                          <ShoppingCart />
                          Покупатель
                        </Box>
                      </MenuItem>
                      <MenuItem value="VENDOR">
                        <Box display="flex" alignItems="center" gap={1}>
                          <Store />
                          Продавец
                        </Box>
                      </MenuItem>
                      <MenuItem value="ADMIN">
                        <Box display="flex" alignItems="center" gap={1}>
                          <AdminPanelSettings />
                          Администратор
                        </Box>
                      </MenuItem>
                    </Select>
                    {errors.role && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                        {errors.role?.message as string}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Пользователь активен"
                    sx={{ mt: 2 }}
                  />
                )}
              />
            </Grid>

            {/* Role Description */}
            <Grid item xs={12}>
              <Alert severity="info" icon={currentRoleInfo.icon}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    <Chip
                      label={currentRoleInfo.label}
                      color={currentRoleInfo.color}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    Права доступа
                  </Typography>
                  <Typography variant="body2">
                    {currentRoleInfo.description}
                  </Typography>
                </Box>
              </Alert>
            </Grid>

            {!canManageRoles && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  <Typography variant="body2">
                    У вас нет прав для изменения ролей пользователей. Только владелец может управлять ролями.
                  </Typography>
                </Alert>
              </Grid>
            )}

            {isEdit && user?.role === 'OWNER' && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  <Typography variant="body2">
                    Роль владельца не может быть изменена. Владелец имеет максимальные права в системе.
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* Additional Info for Edit Mode */}
            {isEdit && user && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom color="primary" sx={{ mt: 2 }}>
                  Дополнительная информация
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box display="flex" gap={2} flexWrap="wrap">
                  <Chip
                    label={`Создан: ${new Date(user.createdAt).toLocaleDateString('ru-RU')}`}
                    variant="outlined"
                    size="small"
                  />
                  <Chip
                    label={`ID: ${user.id.substring(0, 8)}...`}
                    variant="outlined"
                    size="small"
                  />
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Сохранение...' : isEdit ? 'Обновить' : 'Создать'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default UserDialog
