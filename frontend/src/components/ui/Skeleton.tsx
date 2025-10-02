import React from 'react'
import { Box, BoxProps, keyframes } from '@mui/material'

const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`

interface SkeletonProps extends BoxProps {
  variant?: 'text' | 'rectangular' | 'circular'
  animation?: 'pulse' | 'wave' | false
  height?: number | string
  width?: number | string
}

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  animation = 'wave',
  height,
  width,
  sx = {},
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'text':
        return {
          height: height || '1.2em',
          borderRadius: '4px',
        }
      case 'circular':
        return {
          borderRadius: '50%',
          height: height || 40,
          width: width || height || 40,
        }
      case 'rectangular':
        return {
          borderRadius: '4px',
          height: height || 140,
          width: width || '100%',
        }
      default:
        return {}
    }
  }

  const getAnimationStyles = () => {
    if (animation === 'wave') {
      return {
        background: `linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)`,
        backgroundSize: '200px 100%',
        animation: `${shimmer} 1.5s ease-in-out infinite`,
      }
    } else if (animation === 'pulse') {
      return {
        backgroundColor: '#f0f0f0',
        animation: 'pulse 1.5s ease-in-out infinite',
        '@keyframes pulse': {
          '0%': {
            opacity: 1,
          },
          '50%': {
            opacity: 0.4,
          },
          '100%': {
            opacity: 1,
          },
        },
      }
    } else {
      return {
        backgroundColor: '#f0f0f0',
      }
    }
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'block',
        width: width || '100%',
        ...getVariantStyles(),
        ...getAnimationStyles(),
        ...sx,
      }}
      {...props}
    />
  )
}

// Pre-built skeleton components for common use cases
export const SkeletonText: React.FC<{ lines?: number; width?: string | number }> = ({ 
  lines = 1, 
  width 
}) => (
  <Box>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        variant="text"
        width={index === lines - 1 ? '60%' : width}
        sx={{ mb: 0.5 }}
      />
    ))}
  </Box>
)

export const SkeletonCard: React.FC<{ 
  hasImage?: boolean 
  hasAction?: boolean
  imageHeight?: number
}> = ({ 
  hasImage = true, 
  hasAction = true,
  imageHeight = 200 
}) => (
  <Box>
    {hasImage && (
      <Skeleton variant="rectangular" height={imageHeight} sx={{ mb: 2 }} />
    )}
    <SkeletonText lines={2} />
    <Box sx={{ mt: 1, mb: 1 }}>
      <Skeleton variant="text" width="40%" />
    </Box>
    {hasAction && (
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Skeleton variant="rectangular" width={80} height={36} />
        <Skeleton variant="rectangular" width={100} height={36} />
      </Box>
    )}
  </Box>
)

export const SkeletonTable: React.FC<{ 
  rows?: number 
  columns?: number 
}> = ({ 
  rows = 5, 
  columns = 4 
}) => (
  <Box>
    {/* Table header */}
    <Box sx={{ display: 'flex', gap: 2, mb: 2, pb: 1, borderBottom: '1px solid #e0e0e0' }}>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} variant="text" width="25%" height={20} />
      ))}
    </Box>
    
    {/* Table rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <Box key={rowIndex} sx={{ display: 'flex', gap: 2, mb: 1, alignItems: 'center' }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton 
            key={colIndex} 
            variant="text" 
            width={colIndex === 0 ? '20%' : '25%'} 
            height={16}
          />
        ))}
      </Box>
    ))}
  </Box>
)

export const SkeletonList: React.FC<{ 
  items?: number 
  avatar?: boolean
  action?: boolean
}> = ({ 
  items = 5, 
  avatar = true,
  action = false 
}) => (
  <Box>
    {Array.from({ length: items }).map((_, index) => (
      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        {avatar && <Skeleton variant="circular" width={40} height={40} />}
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="80%" height={20} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width="60%" height={16} />
        </Box>
        {action && <Skeleton variant="rectangular" width={80} height={32} />}
      </Box>
    ))}
  </Box>
)

export const SkeletonDashboard: React.FC = () => (
  <Box>
    {/* Dashboard header */}
    <Box sx={{ mb: 3 }}>
      <Skeleton variant="text" width="30%" height={32} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="50%" height={20} />
    </Box>

    {/* Stats cards */}
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 3 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Box key={index} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={16} />
            </Box>
          </Box>
        </Box>
      ))}
    </Box>

    {/* Charts area */}
    <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 3, mb: 3 }}>
      <Box>
        <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
      <Box>
        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    </Box>

    {/* Table */}
    <Box>
      <Skeleton variant="text" width="30%" height={24} sx={{ mb: 2 }} />
      <SkeletonTable rows={8} columns={5} />
    </Box>
  </Box>
)

export const SkeletonOrderCard: React.FC = () => (
  <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, mb: 2 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="40%" height={20} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="60%" height={16} />
      </Box>
      <Skeleton variant="rectangular" width={80} height={24} />
    </Box>
    
    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="30%" height={16} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="50%" height={16} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="40%" height={16} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="60%" height={16} />
      </Box>
    </Box>
    
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
      <Skeleton variant="rectangular" width={80} height={32} />
      <Skeleton variant="rectangular" width={100} height={32} />
    </Box>
  </Box>
)

export default Skeleton
