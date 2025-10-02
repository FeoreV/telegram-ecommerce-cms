import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Grid,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material'
import {
  ExpandMore,
  Speed,
  Memory,
  Visibility,
  VisibilityOff,
  Refresh,
  Warning,
  CheckCircle,
} from '@mui/icons-material'
import { usePerformanceMonitor, useAppPerformanceMonitor } from '../../hooks/usePerformanceMonitor'

interface PerformanceMonitorProps {
  componentName?: string
  showInProduction?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  minimized?: boolean
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  componentName = 'App',
  showInProduction = false,
  position = 'bottom-right',
  minimized: initialMinimized = true,
}) => {
  const [minimized, setMinimized] = useState(initialMinimized)
  const [enabled, setEnabled] = useState(process.env.NODE_ENV === 'development' || showInProduction)
  
  const { metrics, warnings, getPerformanceReport, clearWarnings } = usePerformanceMonitor(componentName)
  const { vitals } = useAppPerformanceMonitor()

  // Auto-hide in production unless explicitly enabled
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !showInProduction) {
      setEnabled(false)
    }
  }, [showInProduction])

  if (!enabled) return null

  const getPositionStyles = () => {
    const base = {
      position: 'fixed' as const,
      zIndex: 9999,
      width: minimized ? 60 : 320,
      transition: 'all 0.3s ease-in-out',
    }

    switch (position) {
      case 'top-right':
        return { ...base, top: 16, right: 16 }
      case 'top-left':
        return { ...base, top: 16, left: 16 }
      case 'bottom-left':
        return { ...base, bottom: 16, left: 16 }
      default: // bottom-right
        return { ...base, bottom: 16, right: 16 }
    }
  }

  const getMetricColor = (metric: keyof typeof metrics, value: number) => {
    switch (metric) {
      case 'renderTime':
        return value > 16 ? 'error' : value > 10 ? 'warning' : 'success'
      case 'memoryUsage':
        return value > 50 * 1024 * 1024 ? 'error' : value > 25 * 1024 * 1024 ? 'warning' : 'success'
      case 'fps':
        return value < 30 ? 'error' : value < 50 ? 'warning' : 'success'
      default:
        return 'primary'
    }
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  const formatTime = (ms: number) => {
    return `${ms.toFixed(2)}ms`
  }

  if (minimized) {
    const hasIssues = warnings.length > 0 || metrics.renderTime > 16 || metrics.fps < 50
    
    return (
      <Card
        sx={{
          ...getPositionStyles(),
          cursor: 'pointer',
          '&:hover': { transform: 'scale(1.05)' }
        }}
        onClick={() => setMinimized(false)}
      >
        <CardContent sx={{ p: 1, textAlign: 'center', '&:last-child': { pb: 1 } }}>
          <Speed 
            color={hasIssues ? 'error' : 'success'} 
            sx={{ fontSize: 24 }} 
          />
          <Typography variant="caption" display="block">
            {Math.round(metrics.fps)}fps
          </Typography>
          {warnings.length > 0 && (
            <Chip
              label={warnings.length}
              color="error"
              size="small"
              sx={{ 
                position: 'absolute',
                top: -8,
                right: -8,
                width: 20,
                height: 20,
                fontSize: 10
              }}
            />
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={getPositionStyles()}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Speed />
            Performance Monitor
          </Typography>
          <Box>
            <Tooltip title="Refresh metrics">
              <IconButton size="small" onClick={() => window.location.reload()}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Minimize">
              <IconButton size="small" onClick={() => setMinimized(true)}>
                <VisibilityOff />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {warnings.length > 0 && (
          <Alert 
            severity="warning" 
            sx={{ mb: 2, fontSize: 12 }}
            action={
              <IconButton size="small" onClick={clearWarnings}>
                <CheckCircle />
              </IconButton>
            }
          >
            <Typography variant="caption">
              {warnings.length} performance warning{warnings.length > 1 ? 's' : ''}
            </Typography>
          </Alert>
        )}

        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Render Time
              </Typography>
              <Typography 
                variant="body2" 
                color={`${getMetricColor('renderTime', metrics.renderTime)}.main`}
                fontWeight={600}
              >
                {formatTime(metrics.renderTime)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                FPS
              </Typography>
              <Typography 
                variant="body2" 
                color={`${getMetricColor('fps', metrics.fps)}.main`}
                fontWeight={600}
              >
                {Math.round(metrics.fps)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Memory Usage
              </Typography>
              <Typography 
                variant="body2" 
                color={`${getMetricColor('memoryUsage', metrics.memoryUsage)}.main`}
                fontWeight={600}
              >
                {formatBytes(metrics.memoryUsage)}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min((metrics.memoryUsage / (100 * 1024 * 1024)) * 100, 100)}
                color={getMetricColor('memoryUsage', metrics.memoryUsage) as any}
                sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
              />
            </Box>
          </Grid>
        </Grid>

        <Accordion sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ p: 0, minHeight: 'auto' }}>
            <Typography variant="caption">
              Web Vitals & Details
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">LCP</Typography>
                <Typography variant="body2">{formatTime(vitals.LCP)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">FID</Typography>
                <Typography variant="body2">{formatTime(vitals.FID)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">CLS</Typography>
                <Typography variant="body2">{vitals.CLS.toFixed(3)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">TTFB</Typography>
                <Typography variant="body2">{formatTime(vitals.TTFB)}</Typography>
              </Grid>
            </Grid>

            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Components: {metrics.componentCount}
            </Typography>

            {warnings.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="error" display="block" gutterBottom>
                  Active Warnings:
                </Typography>
                {warnings.slice(0, 3).map((warning, index) => (
                  <Typography key={index} variant="caption" display="block" sx={{ fontSize: 10 }}>
                    • {warning}
                  </Typography>
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="caption">Monitor</Typography>}
          sx={{ mt: 1, ml: 0 }}
        />
      </CardContent>
    </Card>
  )
}

export default PerformanceMonitor
