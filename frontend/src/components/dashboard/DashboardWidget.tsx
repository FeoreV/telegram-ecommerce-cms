import {
    Delete,
    DragIndicator,
    Fullscreen,
    FullscreenExit,
    MoreVert,
    Refresh,
    Settings,
    VisibilityOff,
} from '@mui/icons-material'
import {
    Avatar,
    Box,
    Card,
    CardContent,
    CardHeader,
    Chip,
    IconButton,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from '@mui/material'
import React, { ReactNode } from 'react'

export interface DashboardWidgetProps {
  id: string
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  loading?: boolean
  error?: string | null
  showRefresh?: boolean
  showSettings?: boolean
  showToggleVisibility?: boolean
  showFullscreen?: boolean
  onRefresh?: () => void
  onSettings?: () => void
  onToggleVisibility?: () => void
  onRemove?: () => void
  onFullscreen?: () => void
  isFullscreen?: boolean
  className?: string
  headerAction?: ReactNode
  size?: 'small' | 'medium' | 'large'
  status?: 'success' | 'warning' | 'error' | 'info'
  lastUpdated?: Date
  isDragging?: boolean
}

const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  id,
  title,
  subtitle,
  icon,
  children,
  loading = false,
  error = null,
  showRefresh = true,
  showSettings = false,
  showToggleVisibility = false,
  showFullscreen = false,
  onRefresh,
  onSettings,
  onToggleVisibility,
  onRemove,
  onFullscreen,
  isFullscreen = false,
  className,
  headerAction,
  size = 'medium',
  status,
  lastUpdated,
  isDragging = false,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const menuOpen = Boolean(anchorEl)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleMenuClose()
    onRefresh?.()
  }

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleMenuClose()
    onSettings?.()
  }

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleMenuClose()
    onToggleVisibility?.()
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleMenuClose()
    onRemove?.()
  }

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleMenuClose()
    onFullscreen?.()
  }

  const getStatusColor = () => {
    switch (status) {
      case 'success': return '#4caf50'
      case 'warning': return '#ff9800'
      case 'error': return '#f44336'
      case 'info': return '#2196f3'
      default: return 'transparent'
    }
  }

  const getSizeHeight = () => {
    switch (size) {
      case 'small': return 200
      case 'large': return 400
      case 'medium':
      default: return 300
    }
  }

  return (
    <Card
      className={className}
      sx={{
        height: isFullscreen ? '100vh' : getSizeHeight(),
        display: 'flex',
        flexDirection: 'column',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 1300 : 'auto',
        transform: isDragging ? 'rotate(2deg) scale(1.02)' : 'none',
        transition: 'all 0.2s ease-in-out',
        boxShadow: isDragging ? 4 : status ? `0 0 0 2px ${getStatusColor()}` : 1,
        opacity: isDragging ? 0.8 : 1,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <CardHeader
        avatar={icon && (
          <Avatar
            sx={{
              bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
              color: theme => theme.palette.primary.contrastText,
              border: theme => `1px solid ${theme.palette.primary.main}`,
            }}
          >
            {icon}
          </Avatar>
        )}
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6" noWrap>
              {title}
            </Typography>
            {status && (
              <Chip
                size="small"
                label={status}
                color={status as any}
              />
            )}
            <Box className="dashboard-widget__drag-handle" sx={{ cursor: 'grab', ml: 'auto' }}>
              <DragIndicator color="action" />
            </Box>
          </Box>
        }
        subheader={subtitle}
        action={
          <Box display="flex" alignItems="center" gap={1}>
            {headerAction}

            {lastUpdated && (
              <Tooltip title={`Последнее обновление: ${lastUpdated.toLocaleTimeString()}`}>
                <Chip
                  size="small"
                  label={lastUpdated.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  variant="outlined"
                />
              </Tooltip>
            )}

            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVert />
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              onClick={(e) => e.stopPropagation()}
            >
              {showRefresh && onRefresh && (
                <MenuItem onClick={handleRefresh}>
                  <Refresh sx={{ mr: 1 }} />
                  Обновить
                </MenuItem>
              )}

              {showSettings && onSettings && (
                <MenuItem onClick={handleSettings}>
                  <Settings sx={{ mr: 1 }} />
                  Настройки
                </MenuItem>
              )}

              {showFullscreen && onFullscreen && (
                <MenuItem onClick={handleFullscreen}>
                  {isFullscreen ? <FullscreenExit sx={{ mr: 1 }} /> : <Fullscreen sx={{ mr: 1 }} />}
                  {isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}
                </MenuItem>
              )}

              {showToggleVisibility && onToggleVisibility && (
                <MenuItem onClick={handleToggleVisibility}>
                  <VisibilityOff sx={{ mr: 1 }} />
                  Скрыть виджет
                </MenuItem>
              )}

              {onRemove && (
                <MenuItem onClick={handleRemove} sx={{ color: 'error.main' }}>
                  <Delete sx={{ mr: 1 }} />
                  Удалить
                </MenuItem>
              )}
            </Menu>
          </Box>
        }
        sx={{
          pb: 1,
          '& .MuiCardHeader-content': {
            overflow: 'hidden'
          }
        }}
      />

      <CardContent sx={{ flex: 1, overflow: 'auto', pt: 0 }}>
        {error ? (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="100%"
            color="error.main"
          >
            <Typography variant="body2" color="inherit">
              {error}
            </Typography>
          </Box>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

export default DashboardWidget
