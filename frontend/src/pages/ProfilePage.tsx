import {
    AccountCircle,
    Edit,
    Email,
    Person,
    Phone,
    Save,
    Security,
    Telegram
} from '@mui/icons-material'
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    Divider,
    Grid,
    Paper,
    TextField,
    Typography
} from '@mui/material'
import React, { useState } from 'react'
import { toast } from 'react-toastify'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../contexts/AuthContext'

const ProfilePage: React.FC = () => {
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const getRoleName = (role: string) => {
    const roleNames: Record<string, string> = {
      OWNER: 'Владелец',
      ADMIN: 'Администратор',
      VENDOR: 'Продавец',
      CUSTOMER: 'Покупатель',
    }
    return roleNames[role] || role
  }

  const getRoleColor = (role: string) => {
    const roleColors: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
      OWNER: 'error',
      ADMIN: 'primary',
      VENDOR: 'info',
      CUSTOMER: 'default',
    }
    return roleColors[role] || 'default'
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSaveProfile = async () => {
    try {
      // TODO: Implement API call to update profile
      toast.success('Профиль успешно обновлен')
      setIsEditing(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при обновлении профиля')
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Пароли не совпадают')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов')
      return
    }

    try {
      // TODO: Implement API call to change password
      toast.success('Пароль успешно изменен')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при изменении пароля')
    }
  }

  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Alert severity="error">Пользователь не найден</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Профиль пользователя"
        subtitle="Управление личной информацией и настройками"
        actions={
          !isEditing ? (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => setIsEditing(true)}
            >
              Редактировать
            </Button>
          ) : (
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                onClick={() => {
                  setIsEditing(false)
                  setFormData({
                    firstName: user?.firstName || '',
                    lastName: user?.lastName || '',
                    username: user?.username || '',
                    email: user?.email || '',
                    phone: user?.phone || '',
                  })
                }}
              >
                Отмена
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSaveProfile}
              >
                Сохранить
              </Button>
            </Box>
          )
        }
      />

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                margin: '0 auto 16px',
                fontSize: 48,
                bgcolor: 'primary.main',
              }}
            >
              {user.firstName?.[0] || user.username?.[0] || 'U'}
            </Avatar>

            <Typography variant="h5" gutterBottom>
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.username || 'Пользователь'}
            </Typography>

            <Chip
              label={getRoleName(user.role)}
              color={getRoleColor(user.role)}
              sx={{ mb: 2 }}
            />

            <Divider sx={{ my: 2 }} />

            <Box sx={{ textAlign: 'left' }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Person fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  ID: {user.id}
                </Typography>
              </Box>

              {user.telegramId && (
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Telegram fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Telegram ID: {user.telegramId}
                  </Typography>
                </Box>
              )}

              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <AccountCircle fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  Создан: {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Edit Profile Form */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Личная информация
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Имя"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Фамилия"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Имя пользователя"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  InputProps={{
                    startAdornment: <AccountCircle sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  InputProps={{
                    startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Телефон"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  InputProps={{
                    startAdornment: <Phone sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Change Password */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Безопасность
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Текущий пароль"
                  name="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  InputProps={{
                    startAdornment: <Security sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Новый пароль"
                  name="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  InputProps={{
                    startAdornment: <Security sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Подтвердите пароль"
                  name="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  InputProps={{
                    startAdornment: <Security sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleChangePassword}
                  disabled={
                    !passwordData.currentPassword ||
                    !passwordData.newPassword ||
                    !passwordData.confirmPassword
                  }
                >
                  Изменить пароль
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ProfilePage

