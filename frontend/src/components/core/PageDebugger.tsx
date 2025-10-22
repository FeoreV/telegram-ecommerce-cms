import { CheckCircle, Error as ErrorIcon, ExpandMore, Warning } from '@mui/icons-material'
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    Paper,
    Typography,
} from '@mui/material'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '../../contexts/AuthContext'

type Status = 'idle' | 'success' | 'error' | 'warning'

interface AuthDebugInfo {
  status: Status
  user: {
    id: string
    role: string
    telegramId: string
    firstName?: string | null
  } | null
  hasToken: boolean
}

interface ApiDebugInfo {
  status: Status
  message: string
  details?: {
    baseURL: string
    message?: string
    code?: string
    status?: number
  }
}

interface PermissionDebugInfo {
  pageName: string
  userRole?: string
  canAccess: boolean
}

interface ErrorDebugInfo {
  message: string
  stack?: string
}

interface DiagnosticsState {
  auth: AuthDebugInfo | null
  api: ApiDebugInfo | null
  permissions: PermissionDebugInfo | null
  error: ErrorDebugInfo | null
}

interface PageDebuggerProps {
  pageName: string
  children: React.ReactNode
}

const defaultDiagnostics: DiagnosticsState = {
  auth: null,
  api: null,
  permissions: null,
  error: null,
}

const BASE_ROLES = ['OWNER', 'ADMIN', 'VENDOR']

const PageDebugger: React.FC<PageDebuggerProps> = ({ pageName, children }) => {
  const { user } = useAuth()
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>(defaultDiagnostics)
  const [loading, setLoading] = useState(true)
  const [forceDebug, setForceDebug] = useState(false)

  const healthCheckUrl = useMemo(() => {
    const rawBase = (import.meta as ImportMeta).env?.VITE_API_URL ?? 'localhost/api'
    const normalized = String(rawBase).replace(/\/$/, '')
    return `${normalized}/health`
  }, [])

  const runDiagnostics = useCallback(async () => {
    setLoading(true)
    const result: DiagnosticsState = {
      auth: null,
      api: null,
      permissions: null,
      error: null,
    }

    try {
      result.auth = {
        status: user ? 'success' : 'error',
        user: user
          ? {
              id: user.id,
              role: user.role,
              telegramId: user.telegramId,
              firstName: user.firstName,
            }
          : null,
        hasToken: Boolean(localStorage.getItem('authToken')),
      }

      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 5000)
        const response = await fetch(healthCheckUrl, { signal: controller.signal })
        window.clearTimeout(timeoutId)

        if (response.ok) {
          result.api = {
            status: 'success',
            message: 'API подключение работает',
          }
        } else {
          throw new Error(`HTTP ${response.status}`)
        }
      } catch (error: unknown) {
        const message = (error as Error)?.message ?? 'Неизвестная ошибка'
        result.api = {
          status: 'error',
          message: `API ошибка: ${message}. Убедитесь, что backend запущен по адресу ${healthCheckUrl}.`,
          details: {
            baseURL: healthCheckUrl,
            message,
            code: (error as any)?.code,
            status: (error as any)?.response?.status,
          },
        }
      }

      result.permissions = {
        pageName,
        userRole: user?.role,
        canAccess: checkPagePermissions(pageName, user?.role),
      }
    } catch (error: unknown) {
      result.error = {
        message: (error as Error)?.message ?? 'Неизвестная ошибка',
        stack: (error as Error)?.stack,
      }
    }

    setDiagnostics(result)
    setLoading(false)
  }, [healthCheckUrl, pageName, user])

  useEffect(() => {
    runDiagnostics()
  }, [runDiagnostics])

  const checkPagePermissions = (page: string, role?: string) => {
    if (!role) {
      return false
    }

    if (!BASE_ROLES.includes(role)) {
      return false
    }

    switch (page) {
      case 'users':
        return role === 'OWNER'
      case 'bots':
        return role === 'OWNER' || role === 'ADMIN'
      default:
        return true
    }
  }

  const getStatusIcon = (status?: Status | null) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" />
      case 'error':
        return <ErrorIcon color="error" />
      case 'warning':
        return <Warning color="warning" />
      default:
        return <CircularProgress size={20} />
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Диагностика страницы...</Typography>
      </Box>
    )
  }

  const hasErrors =
    diagnostics.auth?.status === 'error' ||
    diagnostics.api?.status === 'error' ||
    diagnostics.permissions?.canAccess === false

  if (hasErrors || forceDebug) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity={hasErrors ? 'error' : 'info'} sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {hasErrors
              ? `Обнаружены проблемы на странице "${pageName}"`
              : `Диагностика страницы "${pageName}"`}
          </Typography>
          <Typography>
            {hasErrors
              ? 'Найдены ошибки, которые могут привести к белому экрану. См. диагностику ниже.'
              : 'Диагностическая информация для отладки страницы.'}
          </Typography>
        </Alert>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getStatusIcon(diagnostics.auth?.status)}
              <Typography>Аутентификация</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Пользователь авторизован"
                  secondary={diagnostics.auth?.user ? 'Да' : 'Нет'}
                />
                <Chip
                  label={diagnostics.auth?.user ? diagnostics.auth.user.role : 'Не авторизован'}
                  color={diagnostics.auth?.user ? 'success' : 'error'}
                  size="small"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Токен в localStorage"
                  secondary={diagnostics.auth?.hasToken ? 'Найден' : 'Отсутствует'}
                />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getStatusIcon(diagnostics.api?.status)}
              <Typography>API подключение</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" gutterBottom>
              {diagnostics.api?.message}
            </Typography>
            {diagnostics.api?.details && (
              <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                <Typography variant="caption" component="pre">
                  {JSON.stringify(diagnostics.api.details, null, 2)}
                </Typography>
              </Paper>
            )}
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography>Права доступа</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              <ListItem>
                <ListItemText primary="Страница" secondary={diagnostics.permissions?.pageName} />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Роль пользователя"
                  secondary={diagnostics.permissions?.userRole || 'Неизвестно'}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Доступ разрешен"
                  secondary={diagnostics.permissions?.canAccess ? 'Да' : 'Нет'}
                />
                <Chip
                  label={diagnostics.permissions?.canAccess ? 'Разрешено' : 'Запрещено'}
                  color={diagnostics.permissions?.canAccess ? 'success' : 'error'}
                  size="small"
                />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>

        <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button onClick={runDiagnostics} variant="outlined">
            Повторить диагностику
          </Button>
          <Button onClick={() => window.location.reload()} variant="contained">
            Перезагрузить страницу
          </Button>
          {!hasErrors && (
            <Button onClick={() => setForceDebug(false)} variant="outlined" color="secondary">
              Скрыть отладку
            </Button>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <>
      {children}
      {import.meta.env.MODE === 'development' && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            zIndex: 9999,
          }}
        >
          <Button
            size="small"
            variant="outlined"
            onClick={() => setForceDebug(true)}
            sx={{
              minWidth: 'auto',
              fontSize: '0.7rem',
              opacity: 0.7,
              '&:hover': { opacity: 1 },
            }}
          >
            Debug
          </Button>
        </Box>
      )}
    </>
  )
}

export default PageDebugger
