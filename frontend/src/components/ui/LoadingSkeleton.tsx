import React from 'react'
import { Skeleton, Card, CardContent, Box, Grid } from '@mui/material'

interface LoadingSkeletonProps {
  variant?: 'card' | 'table' | 'stats' | 'chart'
  count?: number
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ variant = 'card', count = 1 }) => {
  const renderCardSkeleton = () => (
    <Card elevation={0} sx={{ border: theme => `1px solid ${theme.palette.divider}` }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box flex={1}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        </Box>
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
        <Box display="flex" gap={1} mt={2}>
          <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 0.5 }} />
          <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 0.5 }} />
        </Box>
      </CardContent>
    </Card>
  )

  const renderTableSkeleton = () => (
    <Card elevation={0} sx={{ border: theme => `1px solid ${theme.palette.divider}` }}>
      <CardContent sx={{ p: 0 }}>
        {Array.from({ length: count }).map((_, i) => (
          <Box key={i} sx={{ p: 2, borderBottom: i < count - 1 ? theme => `1px solid ${theme.palette.divider}` : 'none' }}>
            <Box display="flex" alignItems="center" gap={2}>
              <Skeleton variant="circular" width={32} height={32} />
              <Box flex={1}>
                <Skeleton variant="text" width="70%" />
                <Skeleton variant="text" width="50%" />
              </Box>
              <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 0.5 }} />
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  )

  const renderStatsSkeleton = () => (
    <Grid container spacing={3}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid item xs={12} sm={6} md={3} key={i}>
          <Card elevation={0} sx={{ border: theme => `1px solid ${theme.palette.divider}` }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box flex={1}>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
                  <Skeleton variant="text" width="50%" height={20} sx={{ mt: 1 }} />
                </Box>
                <Skeleton variant="circular" width={40} height={40} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )

  const renderChartSkeleton = () => (
    <Card elevation={0} sx={{ border: theme => `1px solid ${theme.palette.divider}` }}>
      <CardContent>
        <Skeleton variant="text" width="30%" sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </CardContent>
    </Card>
  )

  switch (variant) {
    case 'table':
      return renderTableSkeleton()
    case 'stats':
      return renderStatsSkeleton()
    case 'chart':
      return renderChartSkeleton()
    case 'card':
    default:
      return (
        <Grid container spacing={3}>
          {Array.from({ length: count }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              {renderCardSkeleton()}
            </Grid>
          ))}
        </Grid>
      )
  }
}

export default LoadingSkeleton
