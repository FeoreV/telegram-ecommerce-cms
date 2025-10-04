import {
    Add,
    Assessment,
    Dashboard,
    Inventory,
    Menu as MenuIcon,
    Notifications,
    Payment,
    People,
    Receipt,
    Settings,
    SmartToy,
    Store
} from '@mui/icons-material'
import {
    AppBar,
    Avatar,
    Badge,
    BottomNavigation,
    BottomNavigationAction,
    Box,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    SpeedDial,
    SpeedDialAction,
    SpeedDialIcon,
    SwipeableDrawer,
    Toolbar,
    Typography,
    useMediaQuery,
    useTheme
} from '@mui/material'
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useThemeMode } from '../../contexts/ThemeModeContext'
import ConnectionStatus from '../notifications/ConnectionStatus'

interface MobileLayoutProps {
  children: React.ReactNode
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { mode, toggleMode } = useThemeMode()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [speedDialOpen, setSpeedDialOpen] = useState(false)
  const [bottomNavValue, setBottomNavValue] = useState(0)

  // Main navigation items for bottom navigation
  const bottomNavItems = [
    { label: 'Главная', icon: <Dashboard />, path: '/dashboard', value: 0 },
    { label: 'Заказы', icon: <Receipt />, path: '/orders', value: 1 },
    { label: 'Товары', icon: <Inventory />, path: '/products', value: 2 },
    { label: 'Магазины', icon: <Store />, path: '/stores', value: 3 },
  ]

  // Additional menu items for drawer
  const drawerItems = [
    { text: 'Верификация оплат', icon: <Payment />, path: '/payments' },
    { text: 'Отчеты', icon: <Assessment />, path: '/reports' },
    ...(user?.role === 'OWNER' || user?.role === 'ADMIN'
      ? [{ text: 'Телеграм боты', icon: <SmartToy />, path: '/bots' }]
      : []
    ),
    ...(user?.role === 'OWNER'
      ? [{ text: 'Пользователи', icon: <People />, path: '/users' }]
      : []
    ),
  ]

  // Speed dial actions
  const speedDialActions = [
    { icon: <Add />, name: 'Добавить товар', onClick: () => navigate('/products?action=create') },
    { icon: <Store />, name: 'Создать магазин', onClick: () => navigate('/stores?action=create') },
    { icon: <Receipt />, name: 'Новый заказ', onClick: () => navigate('/orders?action=create') },
  ]

  // Update bottom nav value based on current path
  useEffect(() => {
    const currentItem = bottomNavItems.find(item => location.pathname.startsWith(item.path))
    if (currentItem) {
      setBottomNavValue(currentItem.value)
    }
  }, [location.pathname, bottomNavItems])

  const handleBottomNavChange = (event: React.SyntheticEvent, newValue: number) => {
    setBottomNavValue(newValue)
    const item = bottomNavItems[newValue]
    if (item) {
      navigate(item.path)
    }
  }

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event &&
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return
    }
    setDrawerOpen(open)
  }

  if (!isMobile) {
    return null // Use regular layout for desktop
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Mobile App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
        }}
        elevation={0}
      >
        <Toolbar sx={{ minHeight: '56px !important' }}>
          <IconButton
            edge="start"
            onClick={toggleDrawer(true)}
            sx={{ mr: 1 }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: '1.1rem' }}>
            {bottomNavItems.find(item => item.value === bottomNavValue)?.label || 'BotRT'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ConnectionStatus />

            <IconButton size="small">
              <Badge badgeContent={3} color="error">
                <Notifications />
              </Badge>
            </IconButton>

            <Avatar
              sx={{ width: 32, height: 32, ml: 1 }}
              onClick={toggleDrawer(true)}
            >
              {user?.firstName?.[0] || 'U'}
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <SwipeableDrawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
        onOpen={toggleDrawer(true)}
        disableSwipeToOpen={false}
        PaperProps={{
          sx: {
            width: 280,
            bgcolor: 'background.paper',
          }
        }}
      >
        <Box sx={{ pt: 7 }}>
          {/* User Profile Section */}
          <Box
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
              }
            }}
            onClick={() => {
              navigate('/profile')
              setDrawerOpen(false)
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 48, height: 48 }}>
                {user?.firstName?.[0] || 'U'}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {user?.firstName || user?.username || 'Пользователь'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.role === 'OWNER' ? 'Владелец' :
                   user?.role === 'ADMIN' ? 'Администратор' :
                   user?.role === 'VENDOR' ? 'Продавец' : 'Пользователь'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Main Navigation */}
          <List>
            {bottomNavItems.map((item) => (
              <ListItem
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setDrawerOpen(false)
                }}
                sx={{
                  cursor: 'pointer',
                  bgcolor: location.pathname.startsWith(item.path) ? 'action.selected' : 'transparent',
                  borderRadius: 1,
                  mx: 1,
                  mb: 0.5,
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItem>
            ))}
          </List>

          {/* Additional Menu Items */}
          {drawerItems.length > 0 && (
            <>
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="overline" color="text.secondary">
                  Дополнительно
                </Typography>
              </Box>
              <List dense>
                {drawerItems.map((item) => (
                  <ListItem
                    key={item.path}
                    onClick={() => {
                      navigate(item.path)
                      setDrawerOpen(false)
                    }}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 1,
                      mx: 1,
                      mb: 0.5,
                      bgcolor: location.pathname.startsWith(item.path) ? 'action.selected' : 'transparent',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {/* Settings */}
          <Box sx={{ px: 2, py: 1, mt: 'auto' }}>
            <Typography variant="overline" color="text.secondary">
              Настройки
            </Typography>
          </Box>
          <List dense>
            <ListItem
              onClick={() => {
                toggleMode()
                setDrawerOpen(false)
              }}
              sx={{ cursor: 'pointer', borderRadius: 1, mx: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Settings />
              </ListItemIcon>
              <ListItemText primary={`${mode === 'light' ? 'Тёмная' : 'Светлая'} тема`} />
            </ListItem>
          </List>
        </Box>
      </SwipeableDrawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: 7, // App bar height
          pb: 8, // Bottom navigation height
          px: 1,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
        }}
      >
        {children}
      </Box>

      {/* Bottom Navigation */}
      <BottomNavigation
        value={bottomNavValue}
        onChange={handleBottomNavChange}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: theme.zIndex.appBar,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            maxWidth: 'none',
            '&.Mui-selected': {
              color: 'primary.main',
            }
          }
        }}
      >
        {bottomNavItems.map((item) => (
          <BottomNavigationAction
            key={item.value}
            label={item.label}
            icon={item.icon}
            sx={{
              fontSize: '0.75rem',
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.75rem',
              }
            }}
          />
        ))}
      </BottomNavigation>

      {/* Speed Dial for Quick Actions */}
      <SpeedDial
        ariaLabel="Быстрые действия"
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          '& .MuiFab-primary': {
            width: 48,
            height: 48,
          }
        }}
        icon={<SpeedDialIcon />}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
        direction="up"
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => {
              action.onClick()
              setSpeedDialOpen(false)
            }}
            sx={{
              '& .MuiSpeedDialAction-fab': {
                width: 40,
                height: 40,
              }
            }}
          />
        ))}
      </SpeedDial>
    </Box>
  )
}

export default MobileLayout
