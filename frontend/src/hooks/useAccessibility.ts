import { useEffect, useState, useCallback } from 'react'

interface AccessibilityState {
  isHighContrast: boolean
  isReducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large'
  screenReader: boolean
}

interface AccessibilityActions {
  toggleHighContrast: () => void
  toggleReducedMotion: () => void
  setFontSize: (size: 'small' | 'medium' | 'large') => void
  announceToScreenReader: (message: string) => void
}

export const useAccessibility = (): AccessibilityState & AccessibilityActions => {
  const [state, setState] = useState<AccessibilityState>({
    isHighContrast: false,
    isReducedMotion: false,
    fontSize: 'medium',
    screenReader: false,
  })

  // Initialize from localStorage and system preferences
  useEffect(() => {
    const saved = localStorage.getItem('accessibility-preferences')
    let preferences: Partial<AccessibilityState> = {}

    if (saved) {
      try {
        preferences = JSON.parse(saved)
      } catch (error) {
        console.warn('Failed to parse accessibility preferences:', error)
      }
    }

    // Detect system preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches
    const screenReader = detectScreenReader()

    setState(prev => ({
      ...prev,
      isHighContrast: preferences.isHighContrast ?? prefersHighContrast,
      isReducedMotion: preferences.isReducedMotion ?? prefersReducedMotion,
      fontSize: preferences.fontSize ?? 'medium',
      screenReader,
    }))
  }, [])

  // Save preferences to localStorage
  useEffect(() => {
    const { screenReader, ...preferencesToSave } = state
    localStorage.setItem('accessibility-preferences', JSON.stringify(preferencesToSave))
  }, [state])

  // Apply accessibility settings to document
  useEffect(() => {
    const root = document.documentElement

    // High contrast
    if (state.isHighContrast) {
      root.classList.add('accessibility--high-contrast')
    } else {
      root.classList.remove('accessibility--high-contrast')
    }

    // Reduced motion
    if (state.isReducedMotion) {
      root.classList.add('accessibility--reduced-motion')
    } else {
      root.classList.remove('accessibility--reduced-motion')
    }

    // Font size
    root.classList.remove('accessibility__font-size--small', 'accessibility__font-size--medium', 'accessibility__font-size--large')
    root.classList.add(`accessibility__font-size--${state.fontSize}`)

    // Add corresponding CSS variables
    root.style.setProperty('--accessibility-font-size', getFontSizeValue(state.fontSize))
    root.style.setProperty('--accessibility-motion', state.isReducedMotion ? 'none' : 'auto')

  }, [state])

  const toggleHighContrast = useCallback(() => {
    setState(prev => ({ ...prev, isHighContrast: !prev.isHighContrast }))
  }, [])

  const toggleReducedMotion = useCallback(() => {
    setState(prev => ({ ...prev, isReducedMotion: !prev.isReducedMotion }))
  }, [])

  const setFontSize = useCallback((size: 'small' | 'medium' | 'large') => {
    setState(prev => ({ ...prev, fontSize: size }))
  }, [])

  const announceToScreenReader = useCallback((message: string) => {
    // Create or update aria-live region
    let announcer = document.getElementById('screen-reader-announcer')
    
    if (!announcer) {
      announcer = document.createElement('div')
      announcer.id = 'screen-reader-announcer'
      announcer.setAttribute('aria-live', 'polite')
      announcer.setAttribute('aria-atomic', 'true')
      announcer.style.position = 'absolute'
      announcer.style.left = '-10000px'
      announcer.style.width = '1px'
      announcer.style.height = '1px'
      announcer.style.overflow = 'hidden'
      document.body.appendChild(announcer)
    }

    // Clear and set new message
    announcer.textContent = ''
    setTimeout(() => {
      announcer!.textContent = message
    }, 100)
  }, [])

  return {
    ...state,
    toggleHighContrast,
    toggleReducedMotion,
    setFontSize,
    announceToScreenReader,
  }
}

// Helper functions
function detectScreenReader(): boolean {
  // Basic screen reader detection
  const userAgent = navigator.userAgent.toLowerCase()
  const screenReaderIndicators = [
    'jaws', 'nvda', 'sapi', 'guide', 'supernova', 'voxin', 'orca'
  ]
  
  return screenReaderIndicators.some(indicator => userAgent.includes(indicator)) ||
         window.speechSynthesis !== undefined ||
         'speechSynthesis' in window
}

function getFontSizeValue(size: 'small' | 'medium' | 'large'): string {
  switch (size) {
    case 'small': return '0.875rem'
    case 'medium': return '1rem'
    case 'large': return '1.125rem'
    default: return '1rem'
  }
}

// Accessibility keyboard navigation hook
export const useKeyboardNavigation = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip links navigation (Tab)
      if (event.key === 'Tab') {
        document.body.classList.add('accessibility--keyboard-navigation')
      }
      
      // Escape key to close modals/dropdowns
      if (event.key === 'Escape') {
        const activeElement = document.activeElement as HTMLElement
        if (activeElement && activeElement.blur) {
          activeElement.blur()
        }
      }
    }

    const handleMouseDown = () => {
      document.body.classList.remove('accessibility--keyboard-navigation')
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])
}

// Focus management hook
export const useFocusManagement = () => {
  const focusElement = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement
    if (element && element.focus) {
      element.focus()
    }
  }, [])

  const trapFocus = useCallback((containerSelector: string) => {
    const container = document.querySelector(containerSelector) as HTMLElement
    if (!container) return

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    firstElement?.focus()

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return { focusElement, trapFocus }
}

// ARIA announcements hook
export const useAriaAnnouncements = () => {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById('aria-announcer') || createAnnouncer(priority)
    
    // Clear and announce
    announcer.textContent = ''
    setTimeout(() => {
      announcer.textContent = message
    }, 100)
  }, [])

  const announceError = useCallback((error: string) => {
    announce(`Ошибка: ${error}`, 'assertive')
  }, [announce])

  const announceSuccess = useCallback((message: string) => {
    announce(`Успешно: ${message}`, 'polite')
  }, [announce])

  return { announce, announceError, announceSuccess }
}

function createAnnouncer(priority: 'polite' | 'assertive'): HTMLElement {
  const announcer = document.createElement('div')
  announcer.id = 'aria-announcer'
  announcer.setAttribute('aria-live', priority)
  announcer.setAttribute('aria-atomic', 'true')
  announcer.style.position = 'absolute'
  announcer.style.left = '-10000px'
  announcer.style.width = '1px'
  announcer.style.height = '1px'
  announcer.style.overflow = 'hidden'
  document.body.appendChild(announcer)
  return announcer
}
