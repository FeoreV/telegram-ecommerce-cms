import React from 'react'
import { Box, Typography, Button } from '@mui/material'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, actionLabel, onAction, icon }) => {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 2, color: 'text.secondary' }}>
      <Box sx={{ fontSize: 48, mb: 1, opacity: 0.9 }}>{icon ?? '✨'}</Box>
      <Typography variant="h6" color="text.primary">{title}</Typography>
      {description && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
      {actionLabel && (
        <Button variant="contained" sx={{ mt: 2 }} onClick={onAction}>{actionLabel}</Button>
      )}
    </Box>
  )
}

export default EmptyState


