import React, { useState, useRef, useCallback } from 'react'
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Typography,
  useTheme,
  Chip,
  alpha,
} from '@mui/material'
import {
  Delete,
  Edit,
  Archive,
  Star,
  Share,
  Check,
  Close,
} from '@mui/icons-material'

interface SwipeAction {
  icon: React.ReactNode
  label: string
  color: string
  backgroundColor: string
  onAction: () => void
}

interface SwipeableCardProps {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  onSwipeStart?: () => void
  onSwipeEnd?: () => void
  disabled?: boolean
  threshold?: number
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeStart,
  onSwipeEnd,
  disabled = false,
  threshold = 100,
}) => {
  const theme = useTheme()
  const [dragState, setDragState] = useState({
    isDragging: false,
    startX: 0,
    currentX: 0,
    offset: 0,
  })
  const [revealedSide, setRevealedSide] = useState<'left' | 'right' | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()

  const maxOffset = Math.max(leftActions.length, rightActions.length) * 80

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return
    
    const touch = e.touches[0]
    setDragState({
      isDragging: true,
      startX: touch.clientX,
      currentX: touch.clientX,
      offset: 0,
    })
    onSwipeStart?.()
  }, [disabled, onSwipeStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.isDragging || disabled) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - dragState.startX
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaX))

    setDragState(prev => ({
      ...prev,
      currentX: touch.clientX,
      offset: clampedOffset,
    }))

    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${clampedOffset}px)`
    }
  }, [dragState.isDragging, dragState.startX, disabled, maxOffset])

  const handleTouchEnd = useCallback(() => {
    if (!dragState.isDragging || disabled) return

    const { offset } = dragState
    const absOffset = Math.abs(offset)

    let finalOffset = 0
    let revealed: 'left' | 'right' | null = null

    if (absOffset > threshold) {
      if (offset > 0 && leftActions.length > 0) {
        finalOffset = Math.min(leftActions.length * 80, maxOffset)
        revealed = 'left'
      } else if (offset < 0 && rightActions.length > 0) {
        finalOffset = -Math.min(rightActions.length * 80, maxOffset)
        revealed = 'right'
      }
    }

    // Animate to final position
    const animate = () => {
      if (cardRef.current) {
        const current = parseFloat(cardRef.current.style.transform.replace(/[^-\d.]/g, '')) || 0
        const diff = finalOffset - current
        
        if (Math.abs(diff) < 1) {
          cardRef.current.style.transform = `translateX(${finalOffset}px)`
          setRevealedSide(revealed)
          setDragState({
            isDragging: false,
            startX: 0,
            currentX: 0,
            offset: finalOffset,
          })
          onSwipeEnd?.()
        } else {
          const newOffset = current + diff * 0.2
          cardRef.current.style.transform = `translateX(${newOffset}px)`
          animationRef.current = requestAnimationFrame(animate)
        }
      }
    }
    animate()
  }, [dragState, disabled, threshold, leftActions.length, rightActions.length, maxOffset, onSwipeEnd])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    
    setDragState({
      isDragging: true,
      startX: e.clientX,
      currentX: e.clientX,
      offset: 0,
    })
    onSwipeStart?.()
  }, [disabled, onSwipeStart])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || disabled) return

    const deltaX = e.clientX - dragState.startX
    const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaX))

    setDragState(prev => ({
      ...prev,
      currentX: e.clientX,
      offset: clampedOffset,
    }))

    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${clampedOffset}px)`
    }
  }, [dragState.isDragging, dragState.startX, disabled, maxOffset])

  const handleMouseUp = useCallback(() => {
    if (!dragState.isDragging || disabled) return
    handleTouchEnd()
  }, [dragState.isDragging, disabled, handleTouchEnd])

  React.useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp])

  const resetPosition = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'translateX(0px)'
      setRevealedSide(null)
      setDragState({
        isDragging: false,
        startX: 0,
        currentX: 0,
        offset: 0,
      })
    }
  }, [])

  const handleActionClick = useCallback((action: SwipeAction) => {
    action.onAction()
    resetPosition()
  }, [resetPosition])

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => {
    if (actions.length === 0) return null

    return (
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [side]: 0,
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 0,
        }}
      >
        {actions.map((action, index) => (
          <Box
            key={index}
            sx={{
              width: 80,
              backgroundColor: action.backgroundColor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: alpha(action.backgroundColor, 0.8),
              },
              '&:active': {
                backgroundColor: alpha(action.backgroundColor, 0.6),
              }
            }}
            onClick={() => handleActionClick(action)}
          >
            <Box sx={{ color: action.color, mb: 0.5 }}>
              {action.icon}
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: action.color,
                fontSize: '0.7rem',
                textAlign: 'center',
                lineHeight: 1.2,
              }}
            >
              {action.label}
            </Typography>
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
        userSelect: 'none',
        touchAction: 'pan-y', // Allow vertical scrolling but handle horizontal
      }}
    >
      {/* Left Actions */}
      {renderActions(leftActions, 'left')}
      
      {/* Right Actions */}
      {renderActions(rightActions, 'right')}

      {/* Main Card */}
      <Card
        ref={cardRef}
        sx={{
          position: 'relative',
          zIndex: 1,
          cursor: dragState.isDragging ? 'grabbing' : 'grab',
          transition: dragState.isDragging ? 'none' : 'transform 0.3s ease',
          willChange: 'transform',
          borderRadius: 2,
          ...(disabled && {
            cursor: 'default',
          })
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        elevation={dragState.isDragging ? 4 : 1}
      >
        <CardContent sx={{ position: 'relative' }}>
          {children}
          
          {/* Swipe Indicator */}
          {(revealedSide || Math.abs(dragState.offset) > 20) && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                opacity: 0.6,
              }}
            >
              <Chip
                size="small"
                label={revealedSide === 'left' ? 'Свайп влево' : 'Свайп вправо'}
                sx={{
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Tap to close overlay when actions are revealed */}
      {revealedSide && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            backgroundColor: 'transparent',
          }}
          onClick={resetPosition}
        />
      )}
    </Box>
  )
}

// Predefined action sets for common use cases
export const swipeActions = {
  edit: {
    icon: <Edit />,
    label: 'Изменить',
    color: '#fff',
    backgroundColor: '#1976d2', // theme.palette.primary.main default
    onAction: () => {},
  },
  delete: {
    icon: <Delete />,
    label: 'Удалить',
    color: '#fff',
    backgroundColor: '#d32f2f', // theme.palette.error.main default
    onAction: () => {},
  },
  archive: {
    icon: <Archive />,
    label: 'Архив',
    color: '#fff',
    backgroundColor: '#ed6c02', // theme.palette.warning.main default
    onAction: () => {},
  },
  favorite: {
    icon: <Star />,
    label: 'Избранное',
    color: '#fff',
    backgroundColor: '#2e7d32', // theme.palette.success.main default
    onAction: () => {},
  },
  share: {
    icon: <Share />,
    label: 'Поделиться',
    color: '#fff',
    backgroundColor: '#0288d1', // theme.palette.info.main default
    onAction: () => {},
  },
  approve: {
    icon: <Check />,
    label: 'Одобрить',
    color: '#fff',
    backgroundColor: '#2e7d32', // theme.palette.success.main default
    onAction: () => {},
  },
  reject: {
    icon: <Close />,
    label: 'Отклонить',
    color: '#fff',
    backgroundColor: '#d32f2f', // theme.palette.error.main default
    onAction: () => {},
  },
}

export default SwipeableCard
