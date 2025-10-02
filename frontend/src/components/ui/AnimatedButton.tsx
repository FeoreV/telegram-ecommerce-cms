import React, { useState } from 'react'
import { Button, ButtonProps, CircularProgress, Box } from '@mui/material'
import { keyframes } from '@mui/system'

const ripple = keyframes`
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
`

const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 currentColor;
  }
  70% {
    box-shadow: 0 0 0 10px transparent;
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
`

interface AnimatedButtonProps extends ButtonProps {
  loading?: boolean
  success?: boolean
  pulse?: boolean
  rippleEffect?: boolean
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  loading = false,
  success = false,
  pulse = false,
  rippleEffect = true,
  disabled,
  onClick,
  ...props
}) => {
  const [isClicked, setIsClicked] = useState(false)

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) return
    
    setIsClicked(true)
    setTimeout(() => setIsClicked(false), 300)
    
    if (onClick) {
      onClick(event)
    }
  }

  return (
    <Button
      {...props}
      disabled={loading || disabled}
      onClick={handleClick}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        ...(pulse && {
          animation: `${pulse} 2s infinite`,
        }),
        ...(isClicked && rippleEffect && {
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '5px',
            height: '5px',
            background: 'currentColor',
            opacity: 0.6,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            animation: `${ripple} 0.6s linear`,
          }
        }),
        '&:hover': {
          transform: loading ? 'none' : 'translateY(-2px)',
          boxShadow: loading ? 'none' : theme => theme.shadows[8],
        },
        '&:active': {
          transform: 'translateY(0px)',
        },
        ...props.sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          transition: 'opacity 0.2s ease-in-out',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading && (
          <CircularProgress
            size={16}
            sx={{
              color: 'inherit',
              mr: 1,
            }}
          />
        )}
        {success ? '✓' : children}
      </Box>
    </Button>
  )
}

export default AnimatedButton
