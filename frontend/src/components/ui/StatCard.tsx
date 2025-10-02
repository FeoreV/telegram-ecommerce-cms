import React from 'react'
import { Card, CardContent, Box, Typography, Skeleton } from '@mui/material'
import { TrendingUp, TrendingDown } from '@mui/icons-material'

interface StatCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
    label?: string
  }
  loading?: boolean
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  trend, 
  loading, 
  color = 'primary' 
}) => {
  if (loading) {
    return (
      <Card elevation={0} sx={{ border: theme => `1px solid ${theme.palette.divider}`, height: '100%' }}>
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
    )
  }

  return (
    <Card elevation={0} sx={{ border: theme => `1px solid ${theme.palette.divider}`, height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box flex={1}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight={600} color="text.primary">
              {value}
            </Typography>
            {trend && (
              <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                {trend.isPositive ? (
                  <TrendingUp color="success" sx={{ fontSize: 16 }} />
                ) : (
                  <TrendingDown color="error" sx={{ fontSize: 16 }} />
                )}
                <Typography 
                  variant="body2" 
                  color={trend.isPositive ? 'success.main' : 'error.main'}
                  fontWeight={500}
                >
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </Typography>
                {trend.label && (
                  <Typography variant="body2" color="text.secondary">
                    {trend.label}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
          {icon && (
            <Box sx={{ 
              color: theme => theme.palette[color].contrastText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 1.5,
              bgcolor: theme => theme.palette.mode === 'dark'
                ? theme.palette[color].dark
                : theme.palette[color].light,
              border: theme => `1px solid ${theme.palette[color].main}`,
              '& > *': { fontSize: 24 }
            }}>
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default StatCard
