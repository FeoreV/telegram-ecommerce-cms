import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Typography,
  Box,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  Autocomplete,
  Divider,
} from '@mui/material'
import {
  Person,
  PersonAdd,
  PersonRemove,
  Search,
  AdminPanelSettings,
  SupervisorAccount,
  Email,
  Phone,
  Badge,
  Group,
} from '@mui/icons-material'
import { Store, User } from '../../types'
import { storeService } from '../../services/storeService'
import { userService } from '../../services/userService'
import { toast } from 'react-toastify'

interface StoreAdminManagementProps {
  store: Store
  open: boolean
  onClose: () => void
  onRefresh: () => void
}

interface AdminCandidate {
  id: string
  telegramId: string
  firstName: string
  lastName: string
  username?: string
  email?: string
  phone?: string
  role: string
  isActive: boolean
}

const StoreAdminManagement: React.FC<StoreAdminManagementProps> = ({
  store,
  open,
  onClose,
  onRefresh,
}) => {
  const [currentAdmins, setCurrentAdmins] = useState(store.admins || [])
  const [searchTerm, setSearchTerm] = useState('')
  const [candidates, setCandidates] = useState<AdminCandidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<AdminCandidate | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setCurrentAdmins(store.admins || [])
      if (searchTerm.length > 2) {
        searchUsers()
      }
    }
  }, [open, store.admins, searchTerm])

  const searchUsers = async () => {
    setSearchLoading(true)
    try {
      // Search users via API
      const response = await userService.searchUsers({
        search: searchTerm,
        isActive: true,
        limit: 50
      })

      // Filter out users who are already admins
      const existingAdminIds = currentAdmins.map(admin => admin.user.id)
      const filtered = response.items.filter(user => !existingAdminIds.includes(user.id))

      setCandidates(filtered as AdminCandidate[])
    } catch (error: any) {
      console.error('Error searching users:', error)
      toast.error('Ошибка при поиске пользователей')
      setCandidates([])
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAddAdmin = async (user: AdminCandidate) => {
    setLoading(true)
    try {
      await storeService.addStoreAdmin(store.id, user.id)
      toast.success(`${user.firstName} ${user.lastName} добавлен как администратор`)
      
      // Update local state
      const newAdmin = {
        id: Date.now().toString(),
        user: {
          id: user.id,
          telegramId: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role as any,
          isActive: user.isActive,
          createdAt: new Date().toISOString(),
        }
      }
      
      setCurrentAdmins(prev => [...prev, newAdmin])
      setCandidates(prev => prev.filter(c => c.id !== user.id))
      setSelectedCandidate(null)
      setSearchTerm('')
      onRefresh()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при добавлении администратора')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAdmin = async (adminId: string, userName: string) => {
    setLoading(true)
    try {
      const admin = currentAdmins.find(a => a.id === adminId)
      if (!admin) return

      await storeService.removeStoreAdmin(store.id, admin.user.id)
      toast.success(`${userName} удален из администраторов`)
      
      // Update local state
      setCurrentAdmins(prev => prev.filter(a => a.id !== adminId))
      onRefresh()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при удалении администратора')
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <SupervisorAccount color="primary" />
      case 'ADMIN':
        return <AdminPanelSettings color="secondary" />
      case 'VENDOR':
        return <Badge color="info" />
      default:
        return <Person />
    }
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      OWNER: 'Владелец',
      ADMIN: 'Администратор',
      VENDOR: 'Продавец',
      CUSTOMER: 'Покупатель',
    }
    return labels[role] || role
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default'> = {
      OWNER: 'primary',
      ADMIN: 'secondary',
      VENDOR: 'info',
      CUSTOMER: 'default',
    }
    return colors[role] || 'default'
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Group />
          Управление администраторами
        </Box>
        <Typography variant="body2" color="text.secondary">
          {store.name}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* Current Admins Section */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <SupervisorAccount />
            Текущие администраторы ({currentAdmins.length})
          </Typography>
          
          {currentAdmins.length === 0 ? (
            <Alert severity="info">
              У этого магазина пока нет дополнительных администраторов.
            </Alert>
          ) : (
            <List>
              {currentAdmins.map((admin, index) => (
                <React.Fragment key={admin.id}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        {getRoleIcon(admin.user.role)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1">
                            {admin.user.firstName} {admin.user.lastName}
                          </Typography>
                          <Chip 
                            label={getRoleLabel(admin.user.role)}
                            color={getRoleColor(admin.user.role)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          {admin.user.username && (
                            <Typography variant="body2" color="text.secondary">
                              @{admin.user.username}
                            </Typography>
                          )}
                          <Box display="flex" gap={2} alignItems="center" mt={0.5}>
                            {admin.user.email && (
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <Email fontSize="small" />
                                <Typography variant="caption">
                                  {admin.user.email}
                                </Typography>
                              </Box>
                            )}
                            {admin.user.phone && (
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <Phone fontSize="small" />
                                <Typography variant="caption">
                                  {admin.user.phone}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleRemoveAdmin(
                          admin.id, 
                          `${admin.user.firstName} ${admin.user.lastName}`
                        )}
                        disabled={loading}
                        color="error"
                      >
                        <PersonRemove />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < currentAdmins.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Add Admin Section */}
        <Box>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <PersonAdd />
            Добавить администратора
          </Typography>

          <TextField
            fullWidth
            placeholder="Поиск пользователей по имени, username или email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: searchLoading && (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ),
            }}
            margin="normal"
          />

          {searchTerm.length > 2 && candidates.length === 0 && !searchLoading && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Пользователи не найдены. Попробуйте изменить поисковый запрос.
            </Alert>
          )}

          {candidates.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Найденные пользователи:
              </Typography>
              <List>
                {candidates.map((candidate, index) => (
                  <React.Fragment key={candidate.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar>
                          {getRoleIcon(candidate.role)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body1">
                              {candidate.firstName} {candidate.lastName}
                            </Typography>
                            <Chip 
                              label={getRoleLabel(candidate.role)}
                              color={getRoleColor(candidate.role)}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            {candidate.username && (
                              <Typography variant="body2" color="text.secondary">
                                @{candidate.username}
                              </Typography>
                            )}
                            <Box display="flex" gap={2} alignItems="center" mt={0.5}>
                              {candidate.email && (
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <Email fontSize="small" />
                                  <Typography variant="caption">
                                    {candidate.email}
                                  </Typography>
                                </Box>
                              )}
                              {candidate.phone && (
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <Phone fontSize="small" />
                                  <Typography variant="caption">
                                    {candidate.phone}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PersonAdd />}
                          onClick={() => handleAddAdmin(candidate)}
                          disabled={loading}
                        >
                          Добавить
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < candidates.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}

          {searchTerm.length <= 2 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Введите минимум 3 символа для поиска пользователей.
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Готово
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default StoreAdminManagement
