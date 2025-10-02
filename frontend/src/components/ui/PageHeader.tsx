import React from 'react'
import { Box, Typography, Breadcrumbs } from '@mui/material'

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; onClick?: () => void }>
  actions?: React.ReactNode
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, breadcrumbs, actions }) => {
  return (
    <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        {breadcrumbs && (
          <Breadcrumbs sx={{ mb: 0.5 }}>
            {breadcrumbs.map((b, i) => (
              <Typography key={i} color="text.secondary" onClick={b.onClick} sx={{ cursor: b.onClick ? 'pointer' : 'default' }}>
                {b.label}
              </Typography>
            ))}
          </Breadcrumbs>
        )}
        <Typography variant="h4">{title}</Typography>
        {subtitle && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: 'flex', gap: 1 }}>{actions}</Box>}
    </Box>
  )
}

export default PageHeader


