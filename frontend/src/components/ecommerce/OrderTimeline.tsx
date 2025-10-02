import React from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Avatar,
  Tooltip,
  Fade,
} from '@mui/material'
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab'
import {
  ShoppingCart,
  Payment,
  Inventory,
  LocalShipping,
  CheckCircle,
  Cancel,
  Schedule,
  Person,
  Store,
} from '@mui/icons-material'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import StatusChip from '../ui/StatusChip'

interface OrderEvent {
  id: string
  type: 'created' | 'payment_pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  title: string
  description?: string
  timestamp: string
  user?: {
    name: string
    role: string
  }
  metadata?: Record<string, any>
}

interface OrderTimelineProps {
  events: OrderEvent[]
  currentStatus: string
  compact?: boolean
  showUser?: boolean
  animated?: boolean
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({
  events,
  currentStatus,
  compact = false,
  showUser = true,
  animated = true,
}) => {
  const getEventIcon = (type: OrderEvent['type']) => {
    switch (type) {
      case 'created':
        return <ShoppingCart />
      case 'payment_pending':
        return <Schedule />
      case 'paid':
        return <Payment />
      case 'processing':
        return <Inventory />
      case 'shipped':
        return <LocalShipping />
      case 'delivered':
        return <CheckCircle />
      case 'cancelled':
        return <Cancel />
      default:
        return <Schedule />
    }
  }

  const getEventColor = (type: OrderEvent['type'], isCurrentStep: boolean) => {
    if (isCurrentStep) return 'primary'
    
    switch (type) {
      case 'created':
        return 'info'
      case 'payment_pending':
        return 'warning'
      case 'paid':
        return 'success'
      case 'processing':
        return 'info'
      case 'shipped':
        return 'primary'
      case 'delivered':
        return 'success'
      case 'cancelled':
        return 'error'
      default:
        return 'grey'
    }
  }

  const getStatusVariant = (type: OrderEvent['type']) => {
    switch (type) {
      case 'delivered':
        return 'success'
      case 'cancelled':
        return 'error'
      case 'payment_pending':
        return 'warning'
      case 'paid':
      case 'shipped':
        return 'info'
      default:
        return 'neutral'
    }
  }

  const formatEventTime = (timestamp: string) => {
    try {
      const date = parseISO(timestamp)
      return format(date, 'dd MMM, HH:mm', { locale: ru })
    } catch {
      return timestamp
    }
  }

  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            История заказа
          </Typography>
          <StatusChip 
            label={currentStatus} 
            variant={getStatusVariant(currentStatus as OrderEvent['type'])} 
          />
        </Box>

        <Timeline position={compact ? 'right' : 'alternate'}>
          {sortedEvents.map((event, index) => {
            const isCurrentStep = event.type === currentStatus
            const isLastItem = index === sortedEvents.length - 1
            const color = getEventColor(event.type, isCurrentStep)

            const timelineContent = (
              <Card 
                elevation={isCurrentStep ? 4 : 1}
                sx={{ 
                  mb: 2,
                  transform: isCurrentStep ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 0.3s ease-in-out',
                  border: isCurrentStep ? 2 : 0,
                  borderColor: isCurrentStep ? 'primary.main' : 'transparent',
                }}
              >
                <CardContent sx={{ p: compact ? 2 : 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {event.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatEventTime(event.timestamp)}
                    </Typography>
                  </Box>
                  
                  {event.description && (
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {event.description}
                    </Typography>
                  )}

                  {showUser && event.user && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Avatar sx={{ width: 24, height: 24 }}>
                        {event.user.role === 'CUSTOMER' ? <Person /> : <Store />}
                      </Avatar>
                      <Typography variant="caption">
                        {event.user.name} ({event.user.role === 'CUSTOMER' ? 'Клиент' : 'Администратор'})
                      </Typography>
                    </Box>
                  )}

                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {Object.entries(event.metadata).map(([key, value]) => (
                        <Chip 
                          key={key}
                          label={`${key}: ${value}`}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            )

            return (
              <TimelineItem key={event.id}>
                <TimelineSeparator>
                  <Tooltip title={event.title}>
                    <TimelineDot 
                      color={color as any}
                      variant={isCurrentStep ? 'filled' : 'outlined'}
                      sx={{ 
                        width: compact ? 32 : 40,
                        height: compact ? 32 : 40,
                        transform: isCurrentStep ? 'scale(1.2)' : 'scale(1)',
                        transition: 'all 0.3s ease-in-out',
                        boxShadow: isCurrentStep ? 4 : 0,
                      }}
                    >
                      {getEventIcon(event.type)}
                    </TimelineDot>
                  </Tooltip>
                  {!isLastItem && (
                    <TimelineConnector 
                      sx={{ 
                        bgcolor: isCurrentStep ? 'primary.main' : 'grey.300',
                        width: 2,
                      }} 
                    />
                  )}
                </TimelineSeparator>
                <TimelineContent sx={{ pb: 4 }}>
                  {animated ? (
                    <Fade in timeout={300 + index * 100}>
                      <div>{timelineContent}</div>
                    </Fade>
                  ) : (
                    timelineContent
                  )}
                </TimelineContent>
              </TimelineItem>
            )
          })}
        </Timeline>
      </CardContent>
    </Card>
  )
}

export default OrderTimeline
