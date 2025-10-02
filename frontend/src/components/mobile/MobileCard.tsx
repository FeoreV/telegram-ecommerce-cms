import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  IconButton,
  Chip,
  Avatar,
  Collapse,
  SwipeableDrawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  Divider,
  ButtonBase,
} from '@mui/material'
import {
  ExpandMore,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  Share,
  Star,
  StarOutline,
  TouchApp,
} from '@mui/icons-material'
import { useResponsive } from '../../theme/responsive'

interface MobileCardAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
  destructive?: boolean
}

interface MobileCardProps {
  title: string
  subtitle?: string
  description?: string
  avatar?: React.ReactNode
  image?: string
  status?: {
    label: string
    color: 'success' | 'warning' | 'error' | 'info' | 'default'
  }
  actions?: MobileCardAction[]
  children?: React.ReactNode
  expandable?: boolean
  defaultExpanded?: boolean
  onTap?: () => void
  onLongPress?: () => void
  swipeActions?: {
    left?: MobileCardAction[]
    right?: MobileCardAction[]
  }
  dense?: boolean
  highlighted?: boolean
  interactive?: boolean
}

const MobileCard: React.FC<MobileCardProps> = ({
  title,
  subtitle,
  description,
  avatar,
  image,
  status,
  actions = [],
  children,
  expandable = false,
  defaultExpanded = false,
  onTap,
  onLongPress,
  swipeActions,
  dense = false,
  highlighted = false,
  interactive = true,
}) => {
  const theme = useTheme()
  const { isMobile } = useResponsive()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [actionsDrawerOpen, setActionsDrawerOpen] = useState(false)
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const [touchStartTime, setTouchStartTime] = useState<number>(0)

  const handleTouchStart = () => {
    setTouchStartTime(Date.now())
    if (onLongPress) {
      const timer = setTimeout(() => {
        onLongPress()
      }, 500) // 500ms long press
      setLongPressTimer(timer)
    }
  }

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }

    const touchDuration = Date.now() - touchStartTime
    if (touchDuration < 500 && onTap) {
      onTap()
    }
  }

  const handleExpandClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    setExpanded(!expanded)
  }

  const handleActionsClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    setActionsDrawerOpen(true)
  }

  const CardWrapper = interactive ? ButtonBase : 'div'

  return (
    <>
      <Card
        sx={{
          mb: dense ? 1 : 2,
          borderRadius: 2,
          overflow: 'hidden',
          transition: 'all 0.2s ease-in-out',
          border: highlighted ? 2 : 1,
          borderColor: highlighted ? 'primary.main' : 'divider',
          '&:active': interactive ? {
            transform: 'scale(0.98)',
          } : {},
          ...(isMobile && {
            mx: 0.5,
            boxShadow: 1,
          })
        }}
      >
        <CardWrapper
          component="div"
          sx={{
            width: '100%',
            textAlign: 'left',
            p: 0,
            borderRadius: 'inherit',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          disabled={!interactive}
        >
          {image && (
            <Box
              sx={{
                height: dense ? 120 : 160,
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
              }}
            >
              {status && (
                <Chip
                  label={status.label}
                  color={status.color}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                  }}
                />
              )}
            </Box>
          )}

          <CardContent sx={{ p: dense ? 1.5 : 2, pb: dense ? 1 : 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              {avatar && (
                <Avatar sx={{ width: dense ? 32 : 40, height: dense ? 32 : 40 }}>
                  {avatar}
                </Avatar>
              )}
              
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Typography 
                    variant={dense ? "subtitle2" : "h6"} 
                    fontWeight={600}
                    noWrap
                    sx={{ flex: 1, mr: 1 }}
                  >
                    {title}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {!image && status && (
                      <Chip
                        label={status.label}
                        color={status.color}
                        size="small"
                      />
                    )}
                    
                    {actions.length > 0 && (
                      <IconButton
                        size="small"
                        onClick={handleActionsClick}
                        sx={{ p: 0.5 }}
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    )}
                    
                    {expandable && (
                      <IconButton
                        size="small"
                        onClick={handleExpandClick}
                        sx={{
                          p: 0.5,
                          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s ease',
                        }}
                      >
                        <ExpandMore fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {subtitle && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    noWrap
                    sx={{ mb: description ? 0.5 : 0 }}
                  >
                    {subtitle}
                  </Typography>
                )}

                {description && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: dense ? 2 : 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {description}
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>

          {expandable && (
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <CardContent sx={{ pt: 0, px: dense ? 1.5 : 2, pb: dense ? 1.5 : 2 }}>
                {children}
              </CardContent>
            </Collapse>
          )}

          {!expandable && children && (
            <CardContent sx={{ pt: 0, px: dense ? 1.5 : 2, pb: dense ? 1.5 : 2 }}>
              {children}
            </CardContent>
          )}
        </CardWrapper>
      </Card>

      {/* Mobile Actions Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={actionsDrawerOpen}
        onClose={() => setActionsDrawerOpen(false)}
        onOpen={() => setActionsDrawerOpen(true)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '50vh',
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 4,
              bgcolor: 'grey.300',
              borderRadius: 2,
              mx: 'auto',
              mb: 2,
            }}
          />
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
        </Box>
        
        <Divider />
        
        <List sx={{ py: 1 }}>
          {actions.map((action, index) => (
            <ListItem
              key={index}
              onClick={() => {
                action.onClick()
                setActionsDrawerOpen(false)
              }}
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
                ...(action.destructive && {
                  color: 'error.main',
                })
              }}
            >
              <ListItemIcon sx={{ 
                color: action.color ? `${action.color}.main` : 'inherit',
                minWidth: 40
              }}>
                {action.icon}
              </ListItemIcon>
              <ListItemText 
                primary={action.label}
                sx={{
                  '& .MuiListItemText-primary': {
                    color: action.destructive ? 'error.main' : 'inherit'
                  }
                }}
              />
            </ListItem>
          ))}
        </List>
      </SwipeableDrawer>
    </>
  )
}

export default MobileCard
