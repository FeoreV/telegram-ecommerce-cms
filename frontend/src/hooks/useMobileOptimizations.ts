import { useEffect, useState, useCallback, useRef } from 'react'
import { useTheme, useMediaQuery } from '@mui/material'

interface MobileOptimizations {
  // Performance
  isLowEndDevice: boolean
  shouldReduceAnimations: boolean
  shouldLazyLoad: boolean
  
  // UI
  touchFriendlySize: number
  optimalSpacing: number
  maxItemsPerPage: number
  
  // Features
  supportsTouch: boolean
  supportsHover: boolean
  isOnline: boolean
  isMobile: boolean
  
  // Device info
  screenSize: 'small' | 'medium' | 'large'
  orientation: 'portrait' | 'landscape'
  deviceMemory: number
  connectionType: string
}

export const useMobileOptimizations = (): MobileOptimizations => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'))
  
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  
  // Detect low-end device
  const isLowEndDevice = useCallback(() => {
    // Check device memory (if available)
    const memory = (navigator as any).deviceMemory
    if (memory && memory < 4) return true
    
    // Check CPU cores (if available)
    const cores = navigator.hardwareConcurrency
    if (cores && cores < 4) return true
    
    // Check user agent for low-end devices
    const userAgent = navigator.userAgent.toLowerCase()
    const lowEndKeywords = ['android 4', 'android 5', 'android 6', 'iphone 5', 'iphone 6']
    if (lowEndKeywords.some(keyword => userAgent.includes(keyword))) return true
    
    return false
  }, [])

  // Get connection type
  const getConnectionType = useCallback(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      return connection.effectiveType || connection.type || 'unknown'
    }
    return 'unknown'
  }, [])

  // Get device memory
  const getDeviceMemory = useCallback(() => {
    return (navigator as any).deviceMemory || 4 // Default to 4GB
  }, [])

  // Check touch support
  const supportsTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Check hover support
  const supportsHover = useMediaQuery('(hover: hover)')

  // Determine screen size
  const getScreenSize = useCallback((): 'small' | 'medium' | 'large' => {
    const width = window.innerWidth
    if (width < 600) return 'small'
    if (width < 1200) return 'medium'
    return 'large'
  }, [])

  // Update orientation
  const updateOrientation = useCallback(() => {
    setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape')
  }, [])

  // Handle online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Handle orientation change
  useEffect(() => {
    updateOrientation()
    window.addEventListener('resize', updateOrientation)
    window.addEventListener('orientationchange', updateOrientation)
    
    return () => {
      window.removeEventListener('resize', updateOrientation)
      window.removeEventListener('orientationchange', updateOrientation)
    }
  }, [updateOrientation])

  const shouldReduceAnimations = isLowEndDevice() || getConnectionType() === 'slow-2g'
  const shouldLazyLoad = isMobile || isLowEndDevice()
  
  // Touch-friendly sizes
  const touchFriendlySize = isMobile ? 48 : 40 // Minimum 48px for touch targets
  const optimalSpacing = isMobile ? 16 : 12
  
  // Pagination optimization
  const maxItemsPerPage = (() => {
    if (isLowEndDevice()) return 10
    if (isMobile) return 20
    if (isTablet) return 30
    return 50
  })()

  return {
    // Performance
    isLowEndDevice: isLowEndDevice(),
    shouldReduceAnimations,
    shouldLazyLoad,
    
    // UI
    touchFriendlySize,
    optimalSpacing,
    maxItemsPerPage,
    
    // Features
    supportsTouch,
    supportsHover,
    isOnline,
    isMobile,
    
    // Device info
    screenSize: getScreenSize(),
    orientation,
    deviceMemory: getDeviceMemory(),
    connectionType: getConnectionType(),
  }
}

// Hook for lazy loading with intersection observer
export const useLazyLoading = (threshold = 0.1) => {
  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => observer.disconnect()
  }, [threshold])

  return { isVisible, elementRef }
}

// Hook for optimal image loading
export const useOptimalImages = () => {
  const { isLowEndDevice, connectionType } = useMobileOptimizations()
  
  const getOptimalImageSize = useCallback((baseWidth: number) => {
    // Reduce image size for low-end devices or slow connections
    if (isLowEndDevice || connectionType === 'slow-2g') {
      return Math.floor(baseWidth * 0.5)
    }
    if (connectionType === '2g' || connectionType === '3g') {
      return Math.floor(baseWidth * 0.75)
    }
    return baseWidth
  }, [isLowEndDevice, connectionType])

  const getImageFormat = useCallback(() => {
    // Use WebP for modern browsers, fallback to JPEG
    const supportsWebP = (() => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
    })()
    
    return supportsWebP ? 'webp' : 'jpeg'
  }, [])

  return { getOptimalImageSize, getImageFormat }
}

// Hook for touch gestures
export const useTouchGestures = () => {
  const [gestureState, setGestureState] = useState({
    isSwipingLeft: false,
    isSwipingRight: false,
    isSwipingUp: false,
    isSwipingDown: false,
    swipeDistance: 0,
  })

  const handleTouchStart = useCallback((startX: number, startY: number) => {
    return {
      startX,
      startY,
      startTime: Date.now(),
    }
  }, [])

  const handleTouchMove = useCallback((
    currentX: number, 
    currentY: number, 
    startX: number, 
    startY: number
  ) => {
    const deltaX = currentX - startX
    const deltaY = currentY - startY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    const threshold = 50 // Minimum distance for swipe
    
    if (distance > threshold) {
      const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI
      
      setGestureState({
        isSwipingLeft: angle > -45 && angle < 45 && deltaX > 0,
        isSwipingRight: (angle > 135 || angle < -135) && deltaX < 0,
        isSwipingUp: angle > 45 && angle < 135 && deltaY > 0,
        isSwipingDown: angle > -135 && angle < -45 && deltaY < 0,
        swipeDistance: distance,
      })
    }
  }, [])

  const resetGestures = useCallback(() => {
    setGestureState({
      isSwipingLeft: false,
      isSwipingRight: false,
      isSwipingUp: false,
      isSwipingDown: false,
      swipeDistance: 0,
    })
  }, [])

  return {
    gestureState,
    handleTouchStart,
    handleTouchMove,
    resetGestures,
  }
}

export default useMobileOptimizations
