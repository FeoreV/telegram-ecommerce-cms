import React from 'react'
import { Box, Backdrop, CircularProgress, Typography, Fade } from '@mui/material'
import { keyframes } from '@mui/system'

const spinnerPulse = keyframes`
  0% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
`

const dotBounce = keyframes`
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
`

interface LoadingOverlayProps {
  open: boolean
  message?: string
  variant?: 'circular' | 'dots' | 'pulse'
  backdrop?: boolean
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  open,
  message = 'Загрузка...',
  variant = 'circular',
  backdrop = true,
}) => {
  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  width: 8,
                  height: 8,
                  backgroundColor: 'primary.main',
                  borderRadius: '50%',
                  animation: `${dotBounce} 1.4s infinite ease-in-out both`,
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </Box>
        )
      case 'pulse':
        return (
          <Box
            sx={{
              width: 40,
              height: 40,
              backgroundColor: 'primary.main',
              borderRadius: '50%',
              animation: `${spinnerPulse} 1s infinite ease-in-out`,
            }}
          />
        )
      default:
        return <CircularProgress size={40} thickness={4} />
    }
  }

  const content = (
    <Fade in={open} timeout={300}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          p: 3,
          borderRadius: 2,
          backgroundColor: backdrop ? 'background.paper' : 'transparent',
          boxShadow: backdrop ? 4 : 0,
        }}
      >
        {renderLoader()}
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {message}
        </Typography>
      </Box>
    </Fade>
  )

  if (backdrop) {
    return (
      <Backdrop
        open={open}
        sx={{
          zIndex: theme => theme.zIndex.modal + 1,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {content}
      </Backdrop>
    )
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        zIndex: 1,
      }}
    >
      {content}
    </Box>
  )
}

export default LoadingOverlay
