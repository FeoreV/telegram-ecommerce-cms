import React, { useState } from 'react'
import { Box, Tooltip, Chip, Menu, MenuItem, Typography, Divider, Button } from '@mui/material'
import { Wifi, WifiOff, Settings, Notifications as NotificationsIcon, VolumeUp, VolumeOff, Replay } from '@mui/icons-material'
import { useSocket } from '../../contexts/SocketContext'
import type { ConnectionState } from '../../contexts/SocketContext'
import NotificationSettings from './NotificationSettings'
import styles from './ConnectionStatus.module.css'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import clsx from 'clsx'

const statusIcon: Record<ConnectionState, React.ReactElement> = {
  connecting: <Wifi />,
  connected: <Wifi />,
  disconnected: <WifiOff />,
  error: <WifiOff />,
}

const statusLabel: Record<ConnectionState, string> = {
  connecting: 'Подключение...',
  connected: 'Подключено',
  disconnected: 'Отключено',
  error: 'Ошибка подключения',
}

const statusTone: Record<ConnectionState, 'success' | 'warning' | 'error'> = {
  connected: 'success',
  connecting: 'warning',
  disconnected: 'warning',
  error: 'error',
}

const statusVariants: Record<ConnectionState, 'error' | 'success' | 'warning'> = {
  error: 'error',
  connected: 'success',
  connecting: 'warning',
  disconnected: 'warning'
}

const ConnectionStatus: React.FC = () => {
  const {
    status,
    connectionError,
    connectionAttempts,
    lastConnectedAt,
    soundEnabled,
    notificationsEnabled,
    reconnect,
    connected,
  } = useSocket()

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleSettingsOpen = () => {
    setSettingsOpen(true)
    handleMenuClose()
  }

  const isConnected = connected

  const currentVariant = connectionError
    ? statusVariants.error
    : statusVariants[status]

  const StatusIconComponent = statusIcon[status]

  const statusClass = styles[`connectionStatus--${status}`] ?? styles.connectionStatus
  const dotClass = styles[`connectionStatus__dot--${status}`] ?? styles.connectionStatus__dot
  const iconClass = styles[`connectionStatus__icon--${status}`] ?? styles.connectionStatus__icon
  const intensity = statusTone[status]
  const open = Boolean(anchorEl)

  const renderLastConnected = () => {
    if (!lastConnectedAt) return null
    return (
      <Typography variant="caption" className={styles.connectionStatus__details}>
        Был онлайн {formatDistanceToNow(lastConnectedAt, { addSuffix: true, locale: ru })}
      </Typography>
    )
  }

  return (
    <Box className={styles.connectionStatus}>
      <Tooltip title={`Real-time соединение: ${statusLabel[status]}`}>
        <button
          type="button"
          className={clsx(styles.connectionStatus__indicator, styles.connectionStatus__minimal)}
          onClick={handleMenuOpen}
        >
          <span className={clsx(styles.connectionStatus__dot, dotClass)} />
          <span className={clsx(styles.connectionStatus__icon, iconClass)}>
            {statusIcon[status]}
          </span>
          <span className={styles.connectionStatus__text}>{statusLabel[status]}</span>
        </button>
      </Tooltip>
      {renderLastConnected()}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          className: styles.connectionStatus__menu,
        }}
      >
        <MenuItem disabled className={styles.connectionStatus__menuHeader}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Статус подключения
            </Typography>
            <Chip
              label={statusLabel[status]}
              color={intensity}
              size="small"
              icon={StatusIconComponent}
            />
            {status !== 'connected' && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Попыток переподключения: {connectionAttempts}
              </Typography>
            )}
            {lastConnectedAt && (
              <Typography variant="caption" display="block">
                Был онлайн {formatDistanceToNow(lastConnectedAt, { addSuffix: true, locale: ru })}
              </Typography>
            )}
          </Box>
        </MenuItem>

        {connectionError && (
          <MenuItem disabled className={styles.connectionStatus__error}>
            <Typography variant="caption" color="error">
              Ошибка: {connectionError}
            </Typography>
          </MenuItem>
        )}

        <Divider />

        <MenuItem disabled className={styles.connectionStatus__quickSettings}>
          <Typography variant="subtitle2" gutterBottom>
            Быстрые настройки
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              label="Уведомления"
              color={notificationsEnabled ? 'primary' : 'default'}
              size="small"
              icon={<NotificationsIcon />}
              variant={notificationsEnabled ? 'filled' : 'outlined'}
            />
            <Chip
              label="Звук"
              color={soundEnabled ? 'primary' : 'default'}
              size="small"
              icon={soundEnabled ? <VolumeUp /> : <VolumeOff />}
              variant={soundEnabled ? 'filled' : 'outlined'}
            />
          </Box>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleSettingsOpen} className={styles.connectionStatus__settingsAction}>
          <Settings fontSize="small" />
          <Typography variant="body2">Настройки уведомлений</Typography>
        </MenuItem>

        {status !== 'connected' && (
          <MenuItem className={styles.connectionStatus__settingsAction}>
            <Button
              onClick={reconnect}
              startIcon={<Replay fontSize="small" />}
              size="small"
              variant="outlined"
            >
              Подключиться снова
            </Button>
          </MenuItem>
        )}
      </Menu>

      <NotificationSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Box>
  )
}

export default ConnectionStatus
