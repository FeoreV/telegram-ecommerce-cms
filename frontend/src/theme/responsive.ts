import { useTheme, useMediaQuery } from '@mui/material'

export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
  xxl: 1920,
}

export const useResponsive = () => {
  const theme = useTheme()
  
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'))
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'))
  const isXLarge = useMediaQuery(theme.breakpoints.up('xl'))
  
  const columns = {
    xs: 1,
    sm: isMobile ? 1 : 2,
    md: isTablet ? 2 : 3,
    lg: isDesktop ? 4 : 3,
    xl: isXLarge ? 6 : 4,
  }
  
  // Enhanced responsive values for mobile optimization
  const containerPadding = isMobile ? 1 : (isTablet ? 2 : 3) // Optimized for mobile: 8px, 16px, 24px
  const cardSpacing = isMobile ? 1 : (isTablet ? 2 : 2) // Tighter spacing on mobile
  const headerHeight = isMobile ? 56 : 64 // Standard mobile app bar height
  const bottomNavHeight = isMobile ? 56 : 0 // Bottom navigation for mobile
  const touchTargetSize = isMobile ? 48 : 40 // Minimum touch target size
  const maxWidth = isMobile ? '100%' : (isTablet ? '768px' : '1200px')
  
  // Typography scales for mobile
  const fontScales = {
    h1: isMobile ? '2rem' : '2.5rem',
    h2: isMobile ? '1.75rem' : '2rem',
    h3: isMobile ? '1.5rem' : '1.75rem',
    h4: isMobile ? '1.25rem' : '1.5rem',
    h5: isMobile ? '1.1rem' : '1.25rem',
    h6: isMobile ? '1rem' : '1.1rem',
    body1: isMobile ? '0.95rem' : '1rem',
    body2: isMobile ? '0.875rem' : '0.875rem',
    button: isMobile ? '0.9rem' : '0.875rem',
  }

  return {
    isMobile,
    isTablet,
    isDesktop,
    isXLarge,
    columns,
    spacing: isMobile ? 2 : 3,
    cardSpacing,
    containerPadding,
    headerHeight,
    bottomNavHeight,
    touchTargetSize,
    maxWidth,
    fontScales,
  }
}

export const getResponsiveValue = <T>(
  mobile: T,
  tablet: T,
  desktop: T,
  current: 'mobile' | 'tablet' | 'desktop'
): T => {
  switch (current) {
    case 'mobile': return mobile
    case 'tablet': return tablet
    case 'desktop': return desktop
    default: return desktop
  }
}

export const responsiveStyles = {
  hideOnMobile: { xs: 'none', sm: 'block' },
  hideOnDesktop: { xs: 'block', md: 'none' },
  mobileStack: { xs: 'column', sm: 'row' },
  responsiveGrid: {
    xs: 12,
    sm: 6,
    md: 4,
    lg: 3,
  },
  responsiveCardGrid: {
    xs: 12,
    sm: 6,
    md: 4,
    lg: 3,
    xl: 2,
  }
}
