import React from 'react'
import { Box, CircularProgress, Typography, Container, LinearProgress } from '@mui/material'

interface LoadingFallbackProps {
  message?: string
  size?: 'small' | 'medium' | 'large'
  variant?: 'circular' | 'linear' | 'dots'
  fullScreen?: boolean
  transparent?: boolean
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = 'Загрузка...',
  size = 'medium',
  variant = 'circular',
  fullScreen = false,
  transparent = false
}) => {
  const getSizeValue = () => {
    switch (size) {
      case 'small': return 24
      case 'medium': return 40
      case 'large': return 60
      default: return 40
    }
  }

  const renderLoader = () => {
    switch (variant) {
      case 'linear':
        return (
          <Box sx={{ width: '100%', maxWidth: 400 }}>
            <LinearProgress />
            {message && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                align="center" 
                sx={{ mt: 2 }}
              >
                {message}
              </Typography>
            )}
          </Box>
        )
      
      case 'dots':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                gap: 0.5,
                '& .loading__dot': {
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'primary.main',
                  animation: 'bounce 1.4s ease-in-out infinite both',
                  '&:nth-of-type(1)': { animationDelay: '-0.32s' },
                  '&:nth-of-type(2)': { animationDelay: '-0.16s' },
                },
                '@keyframes bounce': {
                  '0%, 80%, 100%': { 
                    transform: 'scale(0)',
                  },
                  '40%': { 
                    transform: 'scale(1)',
                  },
                }
              }}
            >
              <Box className="loading__dot" />
              <Box className="loading__dot" />
              <Box className="loading__dot" />
            </Box>
            {message && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                {message}
              </Typography>
            )}
          </Box>
        )
      
      default: // circular
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={getSizeValue()} />
            {message && (
              <Typography variant="body2" color="text.secondary" align="center">
                {message}
              </Typography>
            )}
          </Box>
        )
    }
  }

  const containerStyles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: fullScreen ? '100vh' : '200px',
    backgroundColor: transparent ? 'transparent' : 'background.paper',
    position: fullScreen ? 'fixed' as const : 'relative' as const,
    top: fullScreen ? 0 : 'auto',
    left: fullScreen ? 0 : 'auto',
    right: fullScreen ? 0 : 'auto',
    bottom: fullScreen ? 0 : 'auto',
    zIndex: fullScreen ? 9999 : 'auto',
  }

  return (
    <Box sx={containerStyles}>
      {renderLoader()}
    </Box>
  )
}

// Specialized loading components
export const PageLoader: React.FC<{ message?: string }> = ({ message }) => (
  <LoadingFallback 
    message={message || 'Загрузка страницы...'} 
    size="large" 
    fullScreen 
  />
)

export const ComponentLoader: React.FC<{ message?: string }> = ({ message }) => (
  <LoadingFallback 
    message={message || 'Загрузка...'} 
    size="medium" 
    transparent 
  />
)

export const InlineLoader: React.FC<{ message?: string }> = ({ message }) => (
  <LoadingFallback 
    message={message} 
    size="small" 
    variant="dots" 
    transparent 
  />
)

export const FormLoader: React.FC = () => (
  <Box sx={{ 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    borderRadius: 1,
  }}>
    <LoadingFallback 
      message="Сохранение..." 
      size="medium" 
      transparent 
    />
  </Box>
)

export default LoadingFallback
