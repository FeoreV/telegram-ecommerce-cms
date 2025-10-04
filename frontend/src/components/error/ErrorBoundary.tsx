import {
    BugReport,
    Error as ErrorIcon,
    ExpandMore,
    Home,
    Refresh,
} from '@mui/icons-material'
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Typography,
} from '@mui/material'
import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: React.ComponentType<ErrorFallbackProps>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetOnPropsChange?: boolean
  isolate?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

export interface ErrorFallbackProps {
  error: Error | null
  errorInfo: ErrorInfo | null
  resetError: () => void
  errorId: string
}

class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      hasError: true,
      error,
      errorId,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // Log error to external service
    this.logErrorToService(error, errorInfo)

    // Call custom error handler
    this.props.onError?.(error, errorInfo)

    // Auto-reset after 30 seconds if isolate is true
    if (this.props.isolate) {
      this.resetTimeoutId = setTimeout(() => {
        this.resetError()
      }, 30000)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, children } = this.props
    const { hasError } = this.state

    if (hasError && prevProps.children !== children && resetOnPropsChange) {
      this.resetError()
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // SECURITY FIX: CWE-117 - Sanitize logs
    const { sanitizeForLog } = require('../../utils/sanitizer');
    // In a real application, you would send this to your error tracking service
    console.group('🚨 Error Boundary Caught An Error')
    console.error('Error:', sanitizeForLog(error.message))
    console.error('Error Info:', sanitizeForLog(JSON.stringify(errorInfo)))
    console.error('Component Stack:', sanitizeForLog(errorInfo.componentStack || ''))
    console.groupEnd()

    // Example: Send to external service
    // errorTrackingService.logError({
    //   error: error.message,
    //   stack: error.stack,
    //   componentStack: errorInfo.componentStack,
    //   errorId: this.state.errorId,
    //   timestamp: new Date().toISOString(),
    //   userAgent: navigator.userAgent,
    //   url: window.location.href,
    // })
  }

  resetError = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
      this.resetTimeoutId = null
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    })
  }

  handleRefresh = () => {
    this.resetError()
    window.location.reload()
  }

  handleGoHome = () => {
    this.resetError()
    window.location.href = '/'
  }

  render() {
    const { hasError, error, errorInfo, errorId } = this.state
    const { children, fallback: Fallback, isolate = false } = this.props

    if (hasError) {
      if (Fallback) {
        return <Fallback error={error} errorInfo={errorInfo} resetError={this.resetError} errorId={errorId} />
      }

      return (
        <Box
          sx={{
            p: isolate ? 2 : 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: isolate ? 200 : 400,
          }}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />

              <Typography variant="h5" gutterBottom>
                Упс! Что-то пошло не так
              </Typography>

              <Typography variant="body1" color="text.secondary" paragraph>
                Произошла неожиданная ошибка. Мы автоматически отправили отчет об ошибке нашей команде.
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={this.resetError}
                >
                  Попробовать снова
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={this.handleRefresh}
                >
                  Перезагрузить страницу
                </Button>

                {!isolate && (
                  <Button
                    variant="outlined"
                    startIcon={<Home />}
                    onClick={this.handleGoHome}
                  >
                    На главную
                  </Button>
                )}
              </Box>

              <Box sx={{ textAlign: 'left' }}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BugReport fontSize="small" />
                      <Typography variant="subtitle2">
                        Техническая информация
                      </Typography>
                      <Chip label={errorId} size="small" variant="outlined" />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Ошибка: {error?.name}
                      </Typography>
                      <Typography variant="body2" component="pre" sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: '0.8rem'
                      }}>
                        {error?.message}
                      </Typography>
                    </Alert>

                    {error?.stack && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Stack Trace:
                        </Typography>
                        <Typography
                          component="pre"
                          variant="body2"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            fontSize: '0.7rem',
                            backgroundColor: 'grey.100',
                            p: 1,
                            borderRadius: 1,
                            overflow: 'auto',
                            maxHeight: 200,
                          }}
                        >
                          {error.stack}
                        </Typography>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )
    }

    return children
  }
}

export default ErrorBoundary
