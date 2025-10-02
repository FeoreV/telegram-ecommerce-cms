import React from 'react'
import { Card, CardHeader, CardContent, CardActions, Box } from '@mui/material'

interface SectionCardProps {
  title?: React.ReactNode
  subheader?: React.ReactNode
  action?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
  dense?: boolean
}

const SectionCard: React.FC<SectionCardProps> = ({ title, subheader, action, footer, children, dense }) => {
  return (
    <Card elevation={0} sx={{ border: theme => `1px solid ${theme.palette.divider}` }}>
      {(title || action) && (
        <CardHeader titleTypographyProps={{ variant: 'h6' }} title={title} subheader={subheader} action={action} sx={{ pb: 0 }} />
      )}
      <CardContent sx={{ pt: title ? 1.5 : 2, pb: footer ? 1 : 2, ...(dense ? { py: 1.5 } : {}) }}>{children}</CardContent>
      {footer && <CardActions sx={{ px: 2, pb: 2 }}><Box sx={{ ml: 'auto' }}>{footer}</Box></CardActions>}
    </Card>
  )
}

export default SectionCard
