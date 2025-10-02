import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
} from '@mui/material'
import {
  Error as ErrorIcon,
  Refresh,
  Home,
  Warning,
  Wifi,
  CloudOff,
} from '@mui/icons-material'
import { ErrorFallbackProps } from './ErrorBoundary'

interface CustomErrorFallbackProps extends ErrorFallbackProps {
  type?: 'network' | 'permission' | 'notfound' | 'server' | 'generic'
  title?: string
  message?: string
  actions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: 'contained' | 'outlined' | 'text'
  }>
}

const ErrorFallback: React.FC<CustomErrorFallbackProps> = ({
  error,
  resetError,
  errorId,
  type = 'generic',
  title,
  message,
  actions,
}) => {
  const getErrorConfig = () => {
    switch (type) {
      case 'network':
        return {
          icon: <Wifi sx={{ fontSize: 64, color: 'warning.main' }} />,
          title: title || 'Проблемы с сетью',
          message: message || 'Не удается подключиться к серверу. Проверьте подключение к интернету.',
          severity: 'warning' as const,
        }
      case 'permission':
        return {
          icon: <Warning sx={{ fontSize: 64, color: 'error.main' }} />,
          title: title || 'Недостаточно прав',
          message: message || 'У вас нет прав для выполнения этого действия.',
          severity: 'error' as const,
        }
      case 'notfound':
        return {
          icon: <Typography sx={{ fontSize: 64 }}>🔍</Typography>,
          title: title || 'Страница не найдена',
          message: message || 'Запрашиваемая страница не существует или была перемещена.',
          severity: 'info' as const,
        }
      case 'server':
        return {
          icon: <CloudOff sx={{ fontSize: 64, color: 'error.main' }} />,
          title: title || 'Ошибка сервера',
          message: message || 'На сервере произошла ошибка. Мы уже работаем над её устранением.',
          severity: 'error' as const,
        }
      default:
        return {
          icon: <ErrorIcon sx={{ fontSize: 64, color: 'error.main' }} />,
          title: title || 'Произошла ошибка',
          message: message || 'Что-то пошло не так. Попробуйте обновить страницу или повторить попытку позже.',
          severity: 'error' as const,
        }
    }
  }

  const config = getErrorConfig()

  const defaultActions = [
    {
      label: 'Попробовать снова',
      icon: <Refresh />,
      onClick: resetError,
      variant: 'contained' as const,
    },
    {
      label: 'На главную',
      icon: <Home />,
      onClick: () => { window.location.href = '/' },
      variant: 'outlined' as const,
    },
  ]

  const finalActions = actions || defaultActions

  return (
    <Box
      sx={{
        p: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            {config.icon}
          </Box>
          
          <Typography variant="h5" gutterBottom>
            {config.title}
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph>
            {config.message}
          </Typography>

          {error && (
            <Alert severity={config.severity} sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                <strong>Детали ошибки:</strong> {error.message}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Chip 
                  label={`ID: ${errorId}`} 
                  size="small" 
                  variant="outlined" 
                />
              </Box>
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {finalActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'contained'}
                startIcon={action.icon}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default ErrorFallback
