import {
    Close,
    ContentCopy,
    QrCode,
    Refresh,
    Telegram,
    Timer,
} from '@mui/icons-material'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Link,
    Paper,
    Tooltip,
    Typography,
} from '@mui/material'
import { QRCodeSVG } from 'qrcode.react'
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { authService } from '../../services/authService'

interface QRAuthDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (token: string, user: unknown) => void
  title?: string
  description?: string
}

const QRAuthDialog: React.FC<QRAuthDialogProps> = ({
  open,
  onClose,
  onSuccess,
  title = 'Вход через QR код',
  description = 'Отсканируйте QR код в мобильном приложении Telegram'
}) => {
  const [qrData, setQrData] = useState<{
    sessionId: string
    deepLink: string
    qrData: string
    expiresAt: string
    expiresIn: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [checkInterval, setCheckInterval] = useState<NodeJS.Timeout | null>(null)
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null)

  const cleanup = useCallback(() => {
    if (checkInterval) {
      clearInterval(checkInterval)
      setCheckInterval(null)
    }
    if (countdownInterval) {
      clearInterval(countdownInterval)
      setCountdownInterval(null)
    }
  }, [checkInterval, countdownInterval, setCheckInterval, setCountdownInterval])

  const generateQR = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await authService.generateQRAuth()
      setQrData(response)
      setTimeLeft(response.expiresIn)
    } catch (error: unknown) {
      const errorMessage = (error as any).response?.data?.message || 'Ошибка генерации QR кода';
      setError(errorMessage)
      toast.error('Не удалось создать QR код для входа')
    } finally {
      setLoading(false)
    }
  }, [])

  const startCountdown = useCallback(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          cleanup()
          setError('QR код истёк. Создайте новый для входа')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setCountdownInterval(interval)
  }, [cleanup, setCountdownInterval])

  const startStatusCheck = useCallback(() => {
    if (!qrData) return

    const interval = setInterval(async () => {
      if (!qrData.sessionId) return

      setChecking(true)
      try {
        const status = await authService.checkQRAuth(qrData.sessionId)

        if (status.completed && status.telegramId) {
          // Authentication completed, now perform login
          const loginResponse = await authService.login(
            status.telegramId,
            undefined,
            undefined,
            undefined,
            { sessionId: qrData.sessionId }
          )

          cleanup()
          toast.success('Успешный вход через QR код!')
          onSuccess(loginResponse.accessToken, loginResponse.user)
        }
      } catch (error: unknown) {
        if ((error as any).response?.status === 404 || (error as any).response?.status === 410) {
          // Session expired or not found
          cleanup()
          setError('Сессия истекла или не найдена')
        }
      } finally {
        setChecking(false)
      }
    }, 2000) // Check every 2 seconds

    setCheckInterval(interval)
  }, [cleanup, onSuccess, qrData, setCheckInterval])

  // Generate QR code when dialog opens
  useEffect(() => {
    if (open && !qrData && !loading) {
      generateQR()
    }
  }, [open, loading, qrData, generateQR])

  // Cleanup intervals when dialog closes
  useEffect(() => {
    if (!open) {
      cleanup()
    }
  }, [open, cleanup])

  // Start countdown and check interval when QR data is available
  useEffect(() => {
    if (qrData && open) {
      startCountdown()
      startStatusCheck()
    }

    return () => {
      cleanup()
    }
  }, [qrData, open, cleanup, startCountdown, startStatusCheck])

  const handleRefresh = () => {
    cleanup()
    setQrData(null)
    setError(null)
    setTimeLeft(0)
    generateQR()
  }

  const handleCopyLink = () => {
    if (qrData?.deepLink) {
      navigator.clipboard.writeText(qrData.deepLink)
      toast.success('Ссылка скопирована в буфер обмена')
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleClose = () => {
    cleanup()
    setQrData(null)
    setError(null)
    setTimeLeft(0)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <QrCode />
            <Typography variant="h6">{title}</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {description}
        </Typography>

        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Попробовать снова
            </Button>
          }>
            {error}
          </Alert>
        )}

        {qrData && !error && (
          <Box textAlign="center">
            <Paper elevation={2} sx={{ p: 3, mb: 2, display: 'inline-block' }}>
              <QRCodeSVG
                value={qrData.qrData}
                size={200}
                level="M"
                includeMargin
              />
            </Paper>

            <Box display="flex" justifyContent="center" gap={1} mb={2}>
              {timeLeft > 0 && (
                <Chip
                  icon={<Timer />}
                  label={`${formatTime(timeLeft)}`}
                  color={timeLeft < 60 ? 'warning' : 'info'}
                  size="small"
                />
              )}

              {checking && (
                <Chip
                  icon={<CircularProgress size={16} />}
                  label="Ожидание..."
                  color="primary"
                  size="small"
                />
              )}
            </Box>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              Или откройте ссылку в Telegram:
            </Typography>

            <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={2}>
              <Link
                href={qrData.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textDecoration: 'none' }}
              >
                <Button
                  variant="outlined"
                  startIcon={<Telegram />}
                  size="small"
                >
                  Открыть в Telegram
                </Button>
              </Link>

              <Tooltip title="Скопировать ссылку">
                <IconButton onClick={handleCopyLink} size="small">
                  <ContentCopy />
                </IconButton>
              </Tooltip>
            </Box>

            <Alert severity="info" sx={{ textAlign: 'left' }}>
              <Typography variant="body2">
                <strong>Инструкция:</strong>
              </Typography>
              <Typography variant="body2" component="ol" sx={{ pl: 2, mb: 0 }}>
                <li>Отсканируйте QR код камерой телефона</li>
                <li>Или нажмите &quot;Открыть в Telegram&quot;</li>
                <li>Подтвердите вход в нашем боте</li>
                <li>Вы будете автоматически авторизованы</li>
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Отмена
        </Button>

        {qrData && (
          <Button
            onClick={handleRefresh}
            startIcon={<Refresh />}
            disabled={loading}
          >
            Обновить QR
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default QRAuthDialog
