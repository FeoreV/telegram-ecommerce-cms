import { useEffect, useRef, useCallback, useState } from 'react'

interface PerformanceMetrics {
  renderTime: number
  componentCount: number
  memoryUsage: number
  fps: number
  loadTime: number
}

interface PerformanceConfig {
  trackRenders?: boolean
  trackMemory?: boolean
  trackFPS?: boolean
  sampleInterval?: number
  warningThresholds?: {
    renderTime?: number
    memoryUsage?: number
    fps?: number
  }
}

export const usePerformanceMonitor = (
  componentName: string,
  config: PerformanceConfig = {}
) => {
  const {
    trackRenders = true,
    trackMemory = true,
    trackFPS = true,
    sampleInterval = 1000,
    warningThresholds = {
      renderTime: 16, // 60fps = 16ms per frame
      memoryUsage: 50 * 1024 * 1024, // 50MB
      fps: 55
    }
  } = config

  const renderStartTime = useRef<number>(0)
  const renderCount = useRef<number>(0)
  const fpsCounter = useRef<number>(0)
  const lastFPSCheck = useRef<number>(Date.now())
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    componentCount: 0,
    memoryUsage: 0,
    fps: 60,
    loadTime: 0
  })
  const [warnings, setWarnings] = useState<string[]>([])

  // Track render performance
  const startRender = useCallback(() => {
    if (trackRenders) {
      renderStartTime.current = performance.now()
    }
  }, [trackRenders])

  const endRender = useCallback(() => {
    if (trackRenders && renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current
      renderCount.current++
      
      setMetrics(prev => ({ ...prev, renderTime }))
      
      // Check for render performance warnings
      if (warningThresholds.renderTime && renderTime > warningThresholds.renderTime) {
        setWarnings(prev => [
          ...prev.filter(w => !w.includes('slow render')),
          `${componentName}: Slow render detected (${renderTime.toFixed(2)}ms)`
        ])
      }
    }
  }, [trackRenders, componentName, warningThresholds.renderTime])

  // Track memory usage
  const updateMemoryUsage = useCallback(() => {
    if (trackMemory && 'memory' in performance) {
      const memory = (performance as any).memory
      const memoryUsage = memory.usedJSHeapSize
      
      setMetrics(prev => ({ ...prev, memoryUsage }))
      
      if (warningThresholds.memoryUsage && memoryUsage > warningThresholds.memoryUsage) {
        setWarnings(prev => [
          ...prev.filter(w => !w.includes('high memory')),
          `${componentName}: High memory usage detected (${(memoryUsage / 1024 / 1024).toFixed(2)}MB)`
        ])
      }
    }
  }, [trackMemory, componentName, warningThresholds.memoryUsage])

  // Track FPS
  const updateFPS = useCallback(() => {
    if (trackFPS) {
      fpsCounter.current++
      const now = Date.now()
      
      if (now - lastFPSCheck.current >= 1000) {
        const fps = fpsCounter.current
        fpsCounter.current = 0
        lastFPSCheck.current = now
        
        setMetrics(prev => ({ ...prev, fps }))
        
        if (warningThresholds.fps && fps < warningThresholds.fps) {
          setWarnings(prev => [
            ...prev.filter(w => !w.includes('low FPS')),
            `${componentName}: Low FPS detected (${fps}fps)`
          ])
        }
      }
      
      requestAnimationFrame(updateFPS)
    }
  }, [trackFPS, componentName, warningThresholds.fps])

  // Performance observer for navigation timing
  useEffect(() => {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            const loadTime = navEntry.loadEventEnd - navEntry.loadEventStart
            setMetrics(prev => ({ ...prev, loadTime }))
          }
        })
      })
      
      observer.observe({ entryTypes: ['navigation'] })
      
      return () => observer.disconnect()
    }
  }, [])

  // Set up monitoring intervals
  useEffect(() => {
    const interval = setInterval(() => {
      updateMemoryUsage()
    }, sampleInterval)

    if (trackFPS) {
      updateFPS()
    }

    return () => {
      clearInterval(interval)
    }
  }, [updateMemoryUsage, updateFPS, sampleInterval, trackFPS])

  // Component counter
  useEffect(() => {
    setMetrics(prev => ({ ...prev, componentCount: prev.componentCount + 1 }))
    
    return () => {
      setMetrics(prev => ({ ...prev, componentCount: Math.max(0, prev.componentCount - 1) }))
    }
  }, [])

  // Clear old warnings
  useEffect(() => {
    const timeout = setTimeout(() => {
      setWarnings([])
    }, 10000) // Clear warnings after 10 seconds
    
    return () => clearTimeout(timeout)
  }, [warnings])

  const getPerformanceReport = useCallback(() => {
    return {
      component: componentName,
      metrics,
      warnings,
      recommendations: generateRecommendations(metrics, warnings),
      timestamp: new Date().toISOString()
    }
  }, [componentName, metrics, warnings])

  const logPerformance = useCallback((level: 'info' | 'warn' | 'error' = 'info') => {
    const report = getPerformanceReport()
    
    if (level === 'warn' || warnings.length > 0) {
      console.warn(`Performance Warning [${componentName}]:`, report)
    } else if (level === 'error') {
      console.error(`Performance Error [${componentName}]:`, report)
    } else {
      console.log(`Performance Info [${componentName}]:`, report)
    }
  }, [getPerformanceReport, componentName, warnings])

  return {
    metrics,
    warnings,
    startRender,
    endRender,
    getPerformanceReport,
    logPerformance,
    clearWarnings: () => setWarnings([])
  }
}

const generateRecommendations = (metrics: PerformanceMetrics, warnings: string[]): string[] => {
  const recommendations: string[] = []
  
  if (metrics.renderTime > 16) {
    recommendations.push('Consider using React.memo() or useMemo() to optimize renders')
    recommendations.push('Check for unnecessary re-renders with React DevTools Profiler')
  }
  
  if (metrics.memoryUsage > 25 * 1024 * 1024) { // 25MB
    recommendations.push('Monitor for memory leaks, especially in event listeners and timers')
    recommendations.push('Consider implementing virtual scrolling for large lists')
  }
  
  if (metrics.fps < 55) {
    recommendations.push('Reduce DOM manipulations and use CSS animations when possible')
    recommendations.push('Consider using requestAnimationFrame for smooth animations')
  }
  
  if (metrics.componentCount > 100) {
    recommendations.push('Consider code splitting to reduce initial component load')
    recommendations.push('Implement lazy loading for components below the fold')
  }
  
  return recommendations
}

// Hook for monitoring overall app performance
export const useAppPerformanceMonitor = () => {
  const [vitals, setVitals] = useState<{
    CLS: number
    FID: number
    FCP: number
    LCP: number
    TTFB: number
  }>({
    CLS: 0,
    FID: 0,
    FCP: 0,
    LCP: 0,
    TTFB: 0
  })

  useEffect(() => {
    // Use web-vitals library if available
    const measureWebVitals = async () => {
      try {
        const { onCLS, onINP, onFCP, onLCP, onTTFB } = await import('web-vitals')
        
        onCLS(metric => setVitals(prev => ({ ...prev, CLS: metric.value })))
        onINP(metric => setVitals(prev => ({ ...prev, FID: metric.value })))
        onFCP(metric => setVitals(prev => ({ ...prev, FCP: metric.value })))
        onLCP(metric => setVitals(prev => ({ ...prev, LCP: metric.value })))
        onTTFB(metric => setVitals(prev => ({ ...prev, TTFB: metric.value })))
      } catch (error) {
        console.warn('Web Vitals not available:', error)
      }
    }

    measureWebVitals()
  }, [])

  return { vitals }
}
