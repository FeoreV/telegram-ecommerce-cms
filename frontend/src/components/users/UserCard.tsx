import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Tooltip,
  Badge,
  Divider,
} from '@mui/material'
import {
  MoreVert,
  Edit,
  Delete,
  Block,
  CheckCircle,
  Person,
  AdminPanelSettings,
  Store,
  ShoppingCart,
  Business,
  Telegram,
  Email,
  Phone,
  History,
} from '@mui/icons-material'
import { User } from '../../types'
import { userService } from '../../services/userService'
import { toast } from 'react-toastify'
import { useAuth } from '../../contexts/AuthContext'

interface UserCardProps {
  user: User
  onEdit: (user: User) => void
  onRefresh: () => void
  compact?: boolean
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  onEdit,
  onRefresh,
  compact = false,
}) => {
  const { user: currentUser } = useAuth()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const canEdit = currentUser?.role === 'OWNER' || (currentUser?.role === 'ADMIN' && user.role !== 'OWNER')
  const canDelete = currentUser?.role === 'OWNER' && user.role !== 'OWNER'
  const canToggleStatus = canEdit && user.id !== currentUser?.id

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleEdit = () => {
    onEdit(user)
    handleMenuClose()
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await userService.deleteUser(user.id)
      toast.success('Пользователь удален')
      onRefresh()
      setDeleteDialogOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при удалении пользователя')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async () => {
    setLoading(true)
    try {
      await userService.toggleUserActive(user.id)
      toast.success(`Пользователь ${user.isActive ? 'деактивирован' : 'активирован'}`)
      onRefresh()
      handleMenuClose()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при изменении статуса')
    } finally {
      setLoading(false)
    }
  }

  const getRoleInfo = () => {
    const roleConfig = {
      OWNER: {
        label: 'Владелец',
        color: 'error' as const,
        icon: <Business fontSize="small" />,
        bgColor: '#ffebee'
      },
      ADMIN: {
        label: 'Администратор',
        color: 'primary' as const,
        icon: <AdminPanelSettings fontSize="small" />,
        bgColor: '#e3f2fd'
      },
      VENDOR: {
        label: 'Продавец',
        color: 'secondary' as const,
        icon: <Store fontSize="small" />,
        bgColor: '#f3e5f5'
      },
      CUSTOMER: {
        label: 'Покупатель',
        color: 'default' as const,
        icon: <ShoppingCart fontSize="small" />,
        bgColor: '#f5f5f5'
      },
    }

    return roleConfig[user.role] || roleConfig.CUSTOMER
  }

  const roleInfo = getRoleInfo()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getInitials = () => {
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  if (compact) {
    return (
      <Card sx={{ mb: 1, opacity: user.isActive ? 1 : 0.7 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: roleInfo.color + '.main', width: 40, height: 40 }}>
              {getInitials() || <Person />}
            </Avatar>
            <Box flex={1}>
              <Typography variant="subtitle1" fontWeight="medium">
                {user.firstName} {user.lastName}
                {!user.isActive && (
                  <Chip label="Неактивен" color="default" size="small" sx={{ ml: 1 }} />
                )}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  icon={roleInfo.icon}
                  label={roleInfo.label}
                  color={roleInfo.color}
                  size="small"
                />
                {user.username && (
                  <Typography variant="body2" color="text.secondary">
                    @{user.username}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box textAlign="right">
              <Typography variant="caption" color="text.secondary">
                ID: {user.telegramId}
              </Typography>
              {canEdit && (
                <IconButton onClick={handleMenuOpen} size="small">
                  <MoreVert />
                </IconButton>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 3,
          },
          opacity: user.isActive ? 1 : 0.7,
          bgcolor: user.isActive ? 'background.paper' : 'action.hover',
        }}
      >
        <CardContent sx={{ flex: 1, p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  user.isActive ? (
                    <CheckCircle sx={{ color: 'success.main', fontSize: 16 }} />
                  ) : (
                    <Block sx={{ color: 'error.main', fontSize: 16 }} />
                  )
                }
              >
                <Avatar 
                  sx={{ 
                    bgcolor: roleInfo.bgColor,
                    color: roleInfo.color + '.main',
                    width: 56, 
                    height: 56,
                    fontSize: '1.2rem',
                    fontWeight: 'bold'
                  }}
                >
                  {getInitials() || <Person />}
                </Avatar>
              </Badge>
              <Box>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {user.firstName} {user.lastName}
                </Typography>
                <Chip
                  icon={roleInfo.icon}
                  label={roleInfo.label}
                  color={roleInfo.color}
                  size="small"
                />
              </Box>
            </Box>
            {canEdit && (
              <IconButton onClick={handleMenuOpen} size="small">
                <MoreVert />
              </IconButton>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Contact Information */}
          <Box mb={2}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Контактная информация
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <Telegram fontSize="small" color="action" />
                <Typography variant="body2">
                  ID: {user.telegramId}
                  {user.username && ` (@${user.username})`}
                </Typography>
              </Box>
              {user.email && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Email fontSize="small" color="action" />
                  <Typography variant="body2" noWrap>
                    {user.email}
                  </Typography>
                </Box>
              )}
              {user.phone && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Phone fontSize="small" color="action" />
                  <Typography variant="body2">
                    {user.phone}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Status and Date */}
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <History fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Создан: {formatDate(user.createdAt)}
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center" gap={1}>
              {user.isActive ? (
                <CheckCircle fontSize="small" color="success" />
              ) : (
                <Block fontSize="small" color="error" />
              )}
              <Typography variant="caption" color={user.isActive ? 'success.main' : 'error.main'}>
                {user.isActive ? 'Активный пользователь' : 'Заблокирован'}
              </Typography>
            </Box>
          </Box>

          {/* Actions */}
          {canEdit && (
            <Box display="flex" gap={1} mt={3}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Edit />}
                onClick={handleEdit}
                fullWidth
              >
                Редактировать
              </Button>
              {canToggleStatus && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={user.isActive ? <Block /> : <CheckCircle />}
                  onClick={handleToggleActive}
                  disabled={loading}
                  color={user.isActive ? "error" : "success"}
                  fullWidth
                >
                  {user.isActive ? 'Заблокировать' : 'Активировать'}
                </Button>
              )}
            </Box>
          )}

          {/* Current User Badge */}
          {user.id === currentUser?.id && (
            <Box mt={2}>
              <Chip
                label="Это вы"
                color="primary"
                variant="outlined"
                size="small"
                icon={<Person />}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Context Menu */}
      {canEdit && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleEdit}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Редактировать
          </MenuItem>
          {canToggleStatus && (
            <MenuItem onClick={handleToggleActive} disabled={loading}>
              {user.isActive ? (
                <>
                  <Block fontSize="small" sx={{ mr: 1 }} />
                  Заблокировать
                </>
              ) : (
                <>
                  <CheckCircle fontSize="small" sx={{ mr: 1 }} />
                  Активировать
                </>
              )}
            </MenuItem>
          )}
          {canDelete && (
            <MenuItem 
              onClick={() => {
                setDeleteDialogOpen(true)
                handleMenuClose()
              }}
              sx={{ color: 'error.main' }}
            >
              <Delete fontSize="small" sx={{ mr: 1 }} />
              Удалить
            </MenuItem>
          )}
        </Menu>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Подтвердите удаление</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить пользователя "<strong>{user.firstName} {user.lastName}</strong>"?
          </Typography>
          <Typography color="error" sx={{ mt: 1 }}>
            Это действие необратимо. Все данные пользователя будут удалены.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default UserCard
