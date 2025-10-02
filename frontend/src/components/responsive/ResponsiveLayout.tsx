import React, { Suspense, lazy } from 'react'
import { useTheme, useMediaQuery, Box } from '@mui/material'
import { useResponsive } from '../../theme/responsive'
import LoadingSkeleton from '../ui/LoadingSkeleton'
import ErrorBoundary from '../error/ErrorBoundary'

// Lazy load mobile and desktop layouts
const MobileLayout = lazy(() => import('../mobile/MobileLayout'))
const DesktopLayout = lazy(() => import('../Layout'))

interface ResponsiveLayoutProps {
  children: React.ReactNode
}

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({ children }) => {
  const theme = useTheme()
  const { isMobile, isTablet, containerPadding } = useResponsive()

  // Use mobile layout for phones and small tablets
  const useMobileLayout = useMediaQuery(theme.breakpoints.down('md'))

  const LoadingFallback = () => (
    <Box sx={{ p: containerPadding }}>
      <LoadingSkeleton variant="stats" count={4} />
      <Box sx={{ mt: 3 }}>
        <LoadingSkeleton variant="table" count={5} />
      </Box>
    </Box>
  )

  return (
    <ErrorBoundary isolate>
      <Suspense fallback={<LoadingFallback />}>
        {useMobileLayout ? (
          <MobileLayout>{children}</MobileLayout>
        ) : (
          <DesktopLayout>{children}</DesktopLayout>
        )}
      </Suspense>
    </ErrorBoundary>
  )
}

export default ResponsiveLayout
