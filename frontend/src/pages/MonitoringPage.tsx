import React, { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  ButtonGroup,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Stack,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  ShowChart as ShowChartIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  OpenInNew as OpenInNewIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import styles from './MonitoringPage.module.css'

interface Dashboard {
  id: string
  title: string
  description: string
  uid: string
  icon: React.ReactNode
}

interface MetricsSummary {
  uptime: number
  totalRequests: number
  averageResponseTime: number
  errorRate: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    rss: number
  }
}

const MonitoringPage: React.FC = () => {
  const [selectedDashboard, setSelectedDashboard] = useState<string>('backend-overview')
  const [grafanaUrl, setGrafanaUrl] = useState<string>('http://localhost:3030')
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [customUrl, setCustomUrl] = useState<string>('')
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const dashboards: Dashboard[] = [
    {
      id: 'backend-overview',
      title: 'Backend Overview',
      description: 'Общий обзор производительности API',
      uid: 'botrt-backend-overview',
      icon: <ShowChartIcon />,
    },
    {
      id: 'business-metrics',
      title: 'Business Metrics',
      description: 'Бизнес-метрики и аналитика',
      uid: 'botrt-business-metrics',
      icon: <SpeedIcon />,
    },
    {
      id: 'prometheus',
      title: 'Prometheus',
      description: 'Прямой доступ к Prometheus',
      uid: 'prometheus',
      icon: <StorageIcon />,
    },
  ]

  // Load Grafana URL from localStorage
  useEffect(() => {
    const savedUrl = localStorage.getItem('grafana_url')
    if (savedUrl) {
      setGrafanaUrl(savedUrl)
    }
  }, [])

  // Fetch metrics summary
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('authToken')
        
        if (!token) {
          setError('Пожалуйста, войдите в систему для просмотра метрик')
          setLoading(false)
          return
        }

        const response = await fetch('/api/metrics', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          setMetrics(data)
          setError(null)
        } else if (response.status === 401) {
          setError('Сессия истекла. Пожалуйста, войдите снова')
        } else {
          throw new Error('Failed to fetch metrics')
        }
      } catch (err) {
        setError('Не удалось загрузить метрики')
        console.error('Error fetching metrics:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [])

  const handleSaveUrl = () => {
    if (customUrl) {
      setGrafanaUrl(customUrl)
      localStorage.setItem('grafana_url', customUrl)
      setSettingsOpen(false)
      setCustomUrl('')
    }
  }

  const getIframeUrl = () => {
    const dashboard = dashboards.find((d) => d.id === selectedDashboard)

    if (selectedDashboard === 'prometheus') {
      return 'http://localhost:9090/graph'
    }

    if (dashboard) {
      return `${grafanaUrl}/d/${dashboard.uid}?orgId=1&refresh=10s&kiosk=tv&theme=dark`
    }

    return grafanaUrl
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  return (
    <Container maxWidth="xl" className={styles.container}>
      <Box className={styles.header}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            📊 Мониторинг системы
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Производительность, метрики и аналитика в реальном времени
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Tooltip title="Обновить">
            <IconButton onClick={() => window.location.reload()} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Настройки">
            <IconButton onClick={() => setSettingsOpen(true)} color="primary">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Metrics Summary Cards */}
      {metrics && !loading && (
        <Grid container spacing={3} className={styles.metricsGrid}>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.metricCard}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <SpeedIcon color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Uptime
                    </Typography>
                    <Typography variant="h6">{formatUptime(metrics.uptime)}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.metricCard}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <ShowChartIcon color="success" fontSize="large" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Requests
                    </Typography>
                    <Typography variant="h6">{metrics.totalRequests.toLocaleString()}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.metricCard}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <MemoryIcon color="info" fontSize="large" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Avg Response Time
                    </Typography>
                    <Typography variant="h6">{metrics.averageResponseTime.toFixed(2)} ms</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card className={styles.metricCard}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <WarningIcon color={metrics.errorRate > 5 ? 'error' : 'warning'} fontSize="large" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Error Rate
                    </Typography>
                    <Typography variant="h6">{metrics.errorRate.toFixed(2)}%</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}. Убедитесь, что backend запущен и доступен.
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>✅ Мониторинг настроен!</strong> Prometheus и Grafana автоматически запускаются вместе с Docker.
        <br />
        📊 Grafana: <a href="http://localhost:3030" target="_blank" rel="noopener noreferrer">http://localhost:3030</a> (admin/admin)
        {' • '}
        📈 Prometheus: <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer">http://localhost:9090</a>
      </Alert>

      {/* Dashboard Selector */}
      <Paper className={styles.dashboardSelector}>
        <Typography variant="h6" gutterBottom>
          Выберите дашборд
        </Typography>
        <ButtonGroup variant="outlined" fullWidth className={styles.buttonGroup}>
          {dashboards.map((dashboard) => (
            <Button
              key={dashboard.id}
              variant={selectedDashboard === dashboard.id ? 'contained' : 'outlined'}
              onClick={() => setSelectedDashboard(dashboard.id)}
              startIcon={dashboard.icon}
            >
              {dashboard.title}
            </Button>
          ))}
        </ButtonGroup>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {dashboards.find((d) => d.id === selectedDashboard)?.description}
        </Typography>
      </Paper>

      {/* Grafana Iframe */}
      <Paper className={styles.iframeContainer}>
        <Box className={styles.iframeHeader}>
          <Typography variant="h6">
            {dashboards.find((d) => d.id === selectedDashboard)?.title}
          </Typography>
          <Tooltip title="Открыть в новой вкладке">
            <IconButton
              size="small"
              onClick={() => window.open(getIframeUrl(), '_blank')}
              color="primary"
            >
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <iframe src={getIframeUrl()} title="Monitoring Dashboard" className={styles.iframe} />
      </Paper>

      {/* Quick Links */}
      <Paper className={styles.quickLinks}>
        <Typography variant="h6" gutterBottom>
          📌 Быстрые ссылки
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={() => window.open('http://localhost:3030', '_blank')}
            >
              Grafana Dashboard
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={() => window.open('http://localhost:9090', '_blank')}
            >
              Prometheus
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={() => window.open('/metrics', '_blank')}
            >
              Raw Metrics
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              onClick={() => window.open('/api/metrics', '_blank')}
            >
              JSON Metrics API
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>⚙️ Настройки Grafana</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Grafana URL"
            type="text"
            fullWidth
            variant="outlined"
            placeholder="http://localhost:3030"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            helperText={`Текущий URL: ${grafanaUrl}`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Отмена</Button>
          <Button onClick={handleSaveUrl} variant="contained" disabled={!customUrl}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default MonitoringPage
