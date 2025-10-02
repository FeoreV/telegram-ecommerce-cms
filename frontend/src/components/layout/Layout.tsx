import React, { useState } from 'react'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  Switch,
} from '@mui/material'
import {
  Menu as MenuIcon,
  AccountCircle,
  Logout,
  Notifications,
  Settings,
  DarkMode,
  LightMode,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import ConnectionStatus from '../notifications/ConnectionStatus'
import NotificationCenter from '../notifications/NotificationCenter'
import OrderNotificationSettings from '../orders/OrderNotificationSettings'
import { useThemeMode } from '../../contexts/ThemeModeContext'
import { useResponsive } from '../../theme/responsive'
import styles from './Layout.module.css'
import { getRoutesForRole } from '../../routes/config'

const drawerWidth = 240

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const { isMobile, containerPadding } = useResponsive()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false)
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false)

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleProfileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleProfileClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    logout()
    setAnchorEl(null)
  }

  const accessibleRoutes = user?.role ? getRoutesForRole(user.role) : []

  const menuItems = accessibleRoutes
    .filter((route) => route.showInSidebar)
    .map(({ path, label, icon: Icon }) => ({
      path,
      text: label ?? path,
      Icon,
    }))

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Admin Panel
        </Typography>
      </Toolbar>
      <List className={styles.layout__navList}>
        {menuItems.map(({ path, text, Icon }) => (
          <ListItem
            key={text}
            onClick={() => {
              navigate(path)
              setMobileOpen(false)
            }}
            className={`${styles.layout__navItem} ${location.pathname === path ? styles['layout__navItem--active'] : ''}`}
          >
            {Icon && (
              <ListItemIcon className={styles.layout__navIcon}>
                <Icon />
              </ListItemIcon>
            )}
            <ListItemText primary={text} className={styles.layout__navText} />
          </ListItem>
        ))}
      </List>
    </div>
  )

  return (
    <Box className={styles.layout}>
      <AppBar
        position="fixed"
        elevation={0}
        className={`${styles.layout__appBar} ${!isMobile ? styles['layout__appBar--shifted'] : ''}`}
      >
        <Toolbar className={styles.layout__toolbar}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            className={styles.layout__menuButton}
            sx={{ display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" className={styles.layout__title}>
            Telegram Store Admin
          </Typography>
          <div className={styles.layout__userSection}>
            <ConnectionStatus />
            
            <IconButton
              color="inherit"
              onClick={() => setNotificationCenterOpen(true)}
              className={styles.layout__notificationButton}
            >
              <Badge badgeContent={3} color="error" className={styles.layout__notificationBadge}>
                <Notifications />
              </Badge>
            </IconButton>

            <Tooltip title={mode === 'dark' ? 'Темная тема' : 'Светлая тема'}>
              <IconButton color="inherit" onClick={toggleMode} className={styles.layout__themeToggle}>
                {mode === 'dark' ? <DarkMode /> : <LightMode />}
              </IconButton>
            </Tooltip>

            <Button
              color="inherit"
              onClick={handleProfileMenu}
              startIcon={<Avatar className={styles.layout__userAvatar}>{user?.firstName?.[0] || 'U'}</Avatar>}
            >
              {user?.firstName || user?.username || 'Пользователь'}
            </Button>
          </div>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileClose}
            className={styles.layout__profileMenu}
          >
            <MenuItem onClick={handleProfileClose} className={styles.layout__profileMenuItem}>
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              Профиль
            </MenuItem>
            <MenuItem
              onClick={() => {
                setNotificationSettingsOpen(true)
                setAnchorEl(null)
              }}
              className={styles.layout__profileMenuItem}
            >
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              Настройки уведомлений
            </MenuItem>
            <MenuItem onClick={handleLogout} className={styles.layout__profileMenuItem}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Выйти
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        className={styles.layout__drawer}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          className={styles.layout__drawerMobile}
          classes={{
            paper: styles.layout__drawerPaper
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
          }}
          classes={{
            paper: styles.layout__drawerPaper
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        className={`${styles.layout__content} ${!isMobile ? styles['layout__content--shifted'] : ''}`}
        sx={{
          p: containerPadding,
        }}
      >
        <Toolbar />
        {children}
      </Box>

      <NotificationCenter
        open={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />

      <OrderNotificationSettings
        open={notificationSettingsOpen}
        onClose={() => setNotificationSettingsOpen(false)}
      />
    </Box>
  )
}

export default Layout
