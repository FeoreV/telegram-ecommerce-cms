import React from 'react'
import { Chip } from '@mui/material'

type Variant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface StatusChipProps {
  label: React.ReactNode
  variant?: Variant
  size?: 'small' | 'medium'
}

const StatusChip: React.FC<StatusChipProps> = ({ label, variant = 'neutral', size = 'small' }) => {
  return (
    <Chip label={label} size={size} color={variant === 'neutral' ? undefined : (variant as any)} variant={variant === 'neutral' ? 'outlined' : 'filled'} sx={{ borderRadius: 1.5 }} />
  )
}

export default StatusChip


