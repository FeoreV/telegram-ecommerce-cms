import {
    AdminPanelSettings,
    Block,
    Business,
    CheckCircle,
    Delete,
    Edit,
    History,
    LockOpen,
    MoreVert,
    Person,
    PersonAdd,
    Refresh,
    Search,
    ShoppingCart,
    Store as StoreIcon,
    Visibility,
    Warning
} from '@mui/icons-material'
import {
    Alert,
    Avatar,
    Badge,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    Grid,
    IconButton,
    InputAdornment,
    InputLabel,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Select,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Typography
} from '@mui/material'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../contexts/AuthContext'
import { userService } from '../services/userService'
import { User } from '../types'

interface UserWithStats extends User {
  _count: {
    orders: number
    ownedStores: number
    managedStores: number
  }
  stores: {
    owned: Array<{ id: string; name: string; slug: string }>
    admin: Array<{ id: string; name: string; slug: string }>
    vendor: Array<{ id: string; name: string; slug: string }>
  }
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null)
  const [detailsDialog, setDetailsDialog] = useState(false)
  const [banDialog, setBanDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [roleEditDialog, setRoleEditDialog] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [statistics, setStatistics] = useState<any>(null)
  const [detailedUserInfo, setDetailedUserInfo] = useState<any>(null)
  const [userActivity, setUserActivity] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [activityTab, setActivityTab] = useState(0)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [menuUser, setMenuUser] = useState<UserWithStats | null>(null)

  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    role: 'all' as 'all' | 'OWNER' | 'ADMIN' | 'VENDOR' | 'CUSTOMER',
    search: '',
    isActive: undefined as boolean | undefined
  })

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  useEffect(() => {
    loadUsers()
    loadStatistics()
  }, [filters])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await userService.getUsers({
        ...filters,
        role: filters.role === 'all' ? undefined : filters.role
      })
      // Type assertion since API returns users with stats
      setUsers((response.items || []) as UserWithStats[])
      setPagination(response.pagination || pagination)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при загрузке пользователей')
    } finally {
      setLoading(false)
    }
  }

  const loadStatistics = async () => {
    try {
      const stats = await userService.getRoleStatistics()
      setStatistics(stats)
    } catch (error) {
      console.error('Failed to load statistics:', error)
    }
  }

  const loadUserDetails = async (userId: string) => {
    try {
      const response = await userService.getUserDetailed(userId)
      setDetailedUserInfo(response.user)
      const activityResponse = await userService.getUserActivity(userId, 1, 20)
      setUserActivity(activityResponse.activities || [])
    } catch (error: any) {
      toast.error('Ошибка при загрузке деталей пользователя')
    }
  }

  const handleBanUser = async () => {
    if (!selectedUser) return
    try {
      await userService.banUser(selectedUser.id, banReason)
      toast.success('Пользователь заблокирован')
      setBanDialog(false)
      setBanReason('')
      setSelectedUser(null)
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при блокировке пользователя')
    }
  }

  const handleUnbanUser = async (userId: string) => {
    try {
      await userService.unbanUser(userId)
      toast.success('Пользователь разблокирован')
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при разблокировке')
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    try {
      await userService.deleteUser(selectedUser.id)
      toast.success('Пользователь удален')
      setDeleteDialog(false)
      setSelectedUser(null)
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при удалении пользователя')
    }
  }

  const handleRoleUpdate = async () => {
    if (!selectedUser || !selectedRole) return
    try {
      await userService.updateRole(selectedUser.id, selectedRole)
      toast.success('Роль пользователя обновлена')
      setRoleEditDialog(false)
      setSelectedUser(null)
      setSelectedRole('')
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при обновлении роли')
    }
  }

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await userService.banUser(userId)
      } else {
        await userService.unbanUser(userId)
      }
      loadUsers()
    } catch (error: any) {
      toast.error('Ошибка при изменении статуса')
    }
  }

  const handleBulkAction = async (action: 'ban' | 'unban' | 'delete') => {
    if (selectedUsers.length === 0) {
      toast.warning('Выберите пользователей')
      return
    }

    const confirmMessage =
      action === 'ban' ? 'Вы уверены, что хотите заблокировать выбранных пользователей?' :
      action === 'unban' ? 'Вы уверены, что хотите разблокировать выбранных пользователей?' :
      'Вы уверены, что хотите удалить выбранных пользователей? Это действие необратимо!'

    if (!window.confirm(confirmMessage)) return

    try {
      await userService.bulkUserAction(action, selectedUsers)
      toast.success(`Массовое действие выполнено успешно`)
      setSelectedUsers([])
      loadUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при выполнении массового действия')
    }
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(users.map(u => u.id).filter(id => id !== currentUser?.id))
    }
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, user: UserWithStats) => {
    setAnchorEl(event.currentTarget)
    setMenuUser(user)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setMenuUser(null)
  }

  const handleViewDetails = (user: UserWithStats) => {
    setSelectedUser(user)
    loadUserDetails(user.id)
    setDetailsDialog(true)
    handleMenuClose()
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'error'
      case 'ADMIN': return 'warning'
      case 'VENDOR': return 'info'
      case 'CUSTOMER': return 'success'
      default: return 'default'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Владелец'
      case 'ADMIN': return 'Администратор'
      case 'VENDOR': return 'Продавец'
      case 'CUSTOMER': return 'Клиент'
      default: return role
    }
  }

  const formatUserName = (user: UserWithStats) => {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim()
    return name || user.username || `User ${user.telegramId}`
  }

  const canModifyUser = (user: UserWithStats) => {
    if (!currentUser) return false
    if (user.id === currentUser.id) return false
    if (currentUser.role === 'ADMIN' && user.role === 'OWNER') return false
    return true
  }

  if (!currentUser || !['OWNER', 'ADMIN'].includes(currentUser.role)) {
    return (
      <Box p={3}>
        <Alert severity="error">
          У вас нет прав доступа к управлению пользователями
        </Alert>
      </Box>
    )
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Управление пользователями
        </Typography>
        <Box display="flex" gap={2}>
          {selectedUsers.length > 0 && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Block />}
                onClick={() => handleBulkAction('ban')}
              >
                Заблокировать ({selectedUsers.length})
              </Button>
              <Button
                variant="outlined"
                color="success"
                startIcon={<LockOpen />}
                onClick={() => handleBulkAction('unban')}
              >
                Разблокировать ({selectedUsers.length})
              </Button>
              {currentUser.role === 'OWNER' && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => handleBulkAction('delete')}
                >
                  Удалить ({selectedUsers.length})
                </Button>
              )}
            </>
          )}
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadUsers}
          >
            Обновить
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      {statistics && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
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
                      {statistics.summary?.totalUsers || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Всего пользователей
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar
                    sx={{
                      bgcolor: theme => theme.palette.mode === 'dark' ? 'success.dark' : 'success.light',
                      color: theme => theme.palette.success.contrastText,
                      border: theme => `1px solid ${theme.palette.success.main}`,
                    }}
                  >
                    <CheckCircle />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {statistics.summary?.activeUsers || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Активных
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar
                    sx={{
                      bgcolor: theme => theme.palette.mode === 'dark' ? 'error.dark' : 'error.light',
                      color: theme => theme.palette.error.contrastText,
                      border: theme => `1px solid ${theme.palette.error.main}`,
                    }}
                  >
                    <Block />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {statistics.summary?.inactiveUsers || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Заблокированных
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar
                    sx={{
                      bgcolor: theme => theme.palette.mode === 'dark' ? 'info.dark' : 'info.light',
                      color: theme => theme.palette.info.contrastText,
                      border: theme => `1px solid ${theme.palette.info.main}`,
                    }}
                  >
                    <PersonAdd />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {statistics.summary?.recentRegistrations || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Новых за неделю
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Поиск по имени, username, Telegram ID..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Роль</InputLabel>
              <Select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value as any, page: 1 }))}
                label="Роль"
              >
                <MenuItem value="all">Все роли</MenuItem>
                <MenuItem value="OWNER">Владелец</MenuItem>
                <MenuItem value="ADMIN">Администратор</MenuItem>
                <MenuItem value="VENDOR">Продавец</MenuItem>
                <MenuItem value="CUSTOMER">Клиент</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select
                value={filters.isActive === undefined ? 'all' : filters.isActive ? 'active' : 'inactive'}
                onChange={(e) => {
                  const value = e.target.value
                  setFilters(prev => ({
                    ...prev,
                    isActive: value === 'all' ? undefined : value === 'active',
                    page: 1
                  }))
                }}
                label="Статус"
              >
                <MenuItem value="all">Все статусы</MenuItem>
                <MenuItem value="active">Активные</MenuItem>
                <MenuItem value="inactive">Заблокированные</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setFilters({
                  page: 1,
                  limit: 20,
                  role: 'all',
                  search: '',
                  isActive: undefined
                })
              }}
            >
              Сбросить
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Users Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedUsers.length === users.filter(u => u.id !== currentUser?.id).length && users.length > 0}
                    indeterminate={selectedUsers.length > 0 && selectedUsers.length < users.filter(u => u.id !== currentUser?.id).length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Пользователь</TableCell>
                <TableCell>Роль</TableCell>
                <TableCell>Telegram ID</TableCell>
                <TableCell>Магазины</TableCell>
                <TableCell>Заказы</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Дата регистрации</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : (!users || users.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary">
                      Пользователи не найдены
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.id}
                    sx={{
                      bgcolor: !user.isActive ? 'action.disabledBackground' : undefined,
                      opacity: !user.isActive ? 0.6 : 1
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        disabled={user.id === currentUser.id}
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar>
                          {formatUserName(user).charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="medium">
                            {formatUserName(user)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            @{user.username || 'no_username'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getRoleLabel(user.role)}
                        color={getRoleColor(user.role) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {user.telegramId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {user.stores?.owned?.map(store => (
                          <Chip
                            key={store.id}
                            label={store.name}
                            size="small"
                            color="error"
                            icon={<Business />}
                          />
                        ))}
                        {user.stores?.admin?.map(store => (
                          <Chip
                            key={store.id}
                            label={store.name}
                            size="small"
                            color="warning"
                            icon={<AdminPanelSettings />}
                          />
                        ))}
                        {user.stores?.vendor?.map(store => (
                          <Chip
                            key={store.id}
                            label={store.name}
                            size="small"
                            color="info"
                            icon={<StoreIcon />}
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Badge badgeContent={user._count?.orders || 0} color="primary">
                        <ShoppingCart fontSize="small" />
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Chip label="Активен" color="success" size="small" />
                      ) : (
                        <Chip label="Заблокирован" color="error" size="small" icon={<Block />} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(user.createdAt), 'dd.MM.yyyy', { locale: ru })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuClick(e, user)}
                        disabled={!canModifyUser(user)}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Box display="flex" justifyContent="center" p={2} gap={1}>
            <Button
              disabled={pagination.page === 1}
              onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Назад
            </Button>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
              Страница {pagination.page} из {pagination.totalPages}
            </Typography>
            <Button
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Вперед
            </Button>
          </Box>
        )}
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (menuUser) handleViewDetails(menuUser)
        }}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          <ListItemText>Просмотр деталей</ListItemText>
        </MenuItem>

        {currentUser.role === 'OWNER' && (
          <MenuItem onClick={() => {
            setSelectedUser(menuUser)
            setSelectedRole(menuUser?.role || '')
            setRoleEditDialog(true)
            handleMenuClose()
          }}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>Изменить роль</ListItemText>
          </MenuItem>
        )}

        <Divider />

        {menuUser?.isActive ? (
          <MenuItem onClick={() => {
            setSelectedUser(menuUser)
            setBanDialog(true)
            handleMenuClose()
          }}>
            <ListItemIcon>
              <Block fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Заблокировать</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => {
            if (menuUser) handleUnbanUser(menuUser.id)
            handleMenuClose()
          }}>
            <ListItemIcon>
              <LockOpen fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Разблокировать</ListItemText>
          </MenuItem>
        )}

        {currentUser.role === 'OWNER' && (
          <MenuItem onClick={() => {
            setSelectedUser(menuUser)
            setDeleteDialog(true)
            handleMenuClose()
          }}>
            <ListItemIcon>
              <Delete fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Удалить</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* User Details Dialog */}
      <Dialog
        open={detailsDialog}
        onClose={() => setDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Детальная информация о пользователе
        </DialogTitle>
        <DialogContent>
          {detailedUserInfo && (
            <>
              <Tabs value={activityTab} onChange={(_, v) => setActivityTab(v)} sx={{ mb: 2 }}>
                <Tab label="Основная информация" />
                <Tab label="Статистика" />
                <Tab label="Активность" />
              </Tabs>

              <TabPanel value={activityTab} index={0}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Avatar sx={{ width: 64, height: 64 }}>
                        {formatUserName(detailedUserInfo).charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="h6">
                          {formatUserName(detailedUserInfo)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          @{detailedUserInfo.username || 'no_username'} • {detailedUserInfo.telegramId}
                        </Typography>
                        <Chip
                          label={getRoleLabel(detailedUserInfo.role)}
                          color={getRoleColor(detailedUserInfo.role) as any}
                          size="small"
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Email</Typography>
                    <Typography variant="body2">{detailedUserInfo.email || 'Не указан'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Телефон</Typography>
                    <Typography variant="body2">{detailedUserInfo.phone || 'Не указан'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Дата регистрации</Typography>
                    <Typography variant="body2">
                      {format(new Date(detailedUserInfo.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Последний вход</Typography>
                    <Typography variant="body2">
                      {detailedUserInfo.lastLoginAt
                        ? format(new Date(detailedUserInfo.lastLoginAt), 'dd.MM.yyyy HH:mm', { locale: ru })
                        : 'Никогда'}
                    </Typography>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={activityTab} index={1}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h5">{detailedUserInfo.statistics?.totalOrders || 0}</Typography>
                        <Typography variant="caption" color="text.secondary">Всего заказов</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h5">{detailedUserInfo.statistics?.totalStores || 0}</Typography>
                        <Typography variant="caption" color="text.secondary">Магазинов</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h5">{detailedUserInfo.statistics?.activeSessions || 0}</Typography>
                        <Typography variant="caption" color="text.secondary">Активных сессий</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h5">{detailedUserInfo.statistics?.recentActivity || 0}</Typography>
                        <Typography variant="caption" color="text.secondary">Действий за неделю</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={activityTab} index={2}>
                {userActivity.length > 0 ? (
                  <List>
                    {userActivity.map((activity, index) => (
                      <React.Fragment key={activity.id}>
                        <ListItem>
                          <ListItemIcon>
                            <History />
                          </ListItemIcon>
                          <ListItemText
                            primary={activity.action}
                            secondary={`${activity.store?.name || 'Система'} • ${format(new Date(activity.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}`}
                          />
                        </ListItem>
                        {index < userActivity.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Typography color="text.secondary" align="center">
                    Нет активности
                  </Typography>
                )}
              </TabPanel>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(false)}>
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ban Dialog */}
      <Dialog
        open={banDialog}
        onClose={() => setBanDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Warning color="error" />
            Заблокировать пользователя
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Вы уверены, что хотите заблокировать пользователя <strong>{selectedUser && formatUserName(selectedUser)}</strong>?
            Все активные сессии будут завершены.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Причина блокировки (необязательно)"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Укажите причину блокировки..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBanDialog(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleBanUser}
            variant="contained"
            color="error"
          >
            Заблокировать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Delete color="error" />
            Удалить пользователя
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Вы уверены, что хотите удалить пользователя <strong>{selectedUser && formatUserName(selectedUser)}</strong>?
            Это действие необратимо!
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Пользователь будет удален вместе со всеми связанными данными (кроме заказов).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleDeleteUser}
            variant="contained"
            color="error"
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Edit Dialog */}
      <Dialog
        open={roleEditDialog}
        onClose={() => setRoleEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Изменить роль пользователя: {selectedUser && formatUserName(selectedUser)}
        </DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <FormControl fullWidth>
              <InputLabel>Роль</InputLabel>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                label="Роль"
              >
                <MenuItem value="CUSTOMER">Клиент</MenuItem>
                <MenuItem value="VENDOR">Продавец</MenuItem>
                <MenuItem value="ADMIN">Администратор</MenuItem>
                <MenuItem value="OWNER">Владелец</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 2 }}>
              После изменения роли пользователю будут предоставлены соответствующие права доступа.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleEditDialog(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleRoleUpdate}
            variant="contained"
            disabled={!selectedRole}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UsersPage
