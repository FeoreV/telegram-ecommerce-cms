import React, { useEffect, useRef, useState } from 'react'
import { Box, BoxProps } from '@mui/material'

interface FadeInViewProps extends BoxProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  threshold?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade'
}

const FadeInView: React.FC<FadeInViewProps> = ({
  children,
  delay = 0,
  duration = 0.6,
  threshold = 0.1,
  direction = 'up',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay)
          observer.unobserve(entry.target)
        }
      },
      { threshold }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => observer.disconnect()
  }, [delay, threshold])

  const getTransform = () => {
    if (isVisible) return 'translate(0, 0)'
    
    switch (direction) {
      case 'up': return 'translate(0, 30px)'
      case 'down': return 'translate(0, -30px)'
      case 'left': return 'translate(30px, 0)'
      case 'right': return 'translate(-30px, 0)'
      case 'fade': return 'translate(0, 0)'
      default: return 'translate(0, 30px)'
    }
  }

  return (
    <Box
      ref={elementRef}
      {...props}
      sx={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transition: `all ${duration}s cubic-bezier(0.4, 0, 0.2, 1)`,
        ...props.sx,
      }}
    >
      {children}
    </Box>
  )
}

export default FadeInView
